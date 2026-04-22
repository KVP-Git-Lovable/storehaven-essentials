import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function resolveVariables(
  mapping: Record<string, string> | undefined,
  contact: any,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!mapping || typeof mapping !== "object") return out;
  for (const [key, source] of Object.entries(mapping)) {
    if (source == null) continue;
    if (typeof source !== "string") {
      out[key] = String(source);
      continue;
    }
    // Replace tokens like {customer_name}, {phone}, etc. against the contact row
    const resolved = source.replace(/\{(\w+)\}/g, (_m, field) => {
      const v = contact?.[field];
      return v == null ? "" : String(v);
    });
    // If literal token without braces, also try direct field lookup
    out[key] = resolved || (contact?.[source] != null ? String(contact[source]) : "");
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Resolve a single active sender — first from whatsapp_config, then from
    // the most recent inbound message (Twilio's `To` value), then env var.
    const { data: cfg } = await supabase
      .from("whatsapp_config")
      .select("sender_number")
      .limit(1)
      .maybeSingle();
    let fromNumber: string | null = cfg?.sender_number || null;
    if (!fromNumber) {
      // Fallback: env var override (lets ops set a default sender without DB write)
      const envFrom = Deno.env.get("WHATSAPP_FROM_NUMBER");
      if (envFrom && /^\+[1-9]\d{1,14}$/.test(envFrom)) fromNumber = envFrom;
    }

    const { data: activeJourneys } = await supabase
      .from("journeys").select("*").eq("status", "active");

    if (!activeJourneys || activeJourneys.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let messagesSent = 0;

    for (const journey of activeJourneys) {
      const canvas = journey.canvas_data as any;
      if (!canvas?.nodes || !canvas?.edges) continue;

      const { data: enrollments } = await supabase
        .from("journey_enrollments")
        .select("*, journey_contacts(*)")
        .eq("journey_id", journey.id)
        .eq("status", "active")
        .lte("next_action_at", new Date().toISOString());

      if (!enrollments) continue;

      for (const enrollment of enrollments) {
        const currentNode = canvas.nodes.find((n: any) => n.id === enrollment.current_node_id);
        if (!currentNode) continue;

        const nodeType = currentNode.type;

        if (nodeType === "exit") {
          await supabase.from("journey_enrollments")
            .update({ status: "completed" })
            .eq("id", enrollment.id);
          processed++;
          continue;
        }

        if (nodeType === "delay") {
          const duration = currentNode.data?.duration || 1;
          const unit = currentNode.data?.unit || "days";
          const delayMs = unit === "hours" ? duration * 3600000 : duration * 86400000;
          const nextActionAt = new Date(enrollment.next_action_at!).getTime();
          if (Date.now() >= nextActionAt + delayMs) {
            const nextEdge = canvas.edges.find((e: any) => e.source === currentNode.id);
            if (nextEdge) {
              await supabase.from("journey_enrollments")
                .update({ current_node_id: nextEdge.target, next_action_at: new Date().toISOString() })
                .eq("id", enrollment.id);
            }
          }
          processed++;
          continue;
        }

        if (nodeType === "message") {
          const contact = enrollment.journey_contacts;
          const data = currentNode.data || {};
          const channel = data.channel || "whatsapp_template";
          const templateId = data.whatsapp_template_id;
          const variablesMap = data.template_variables || {};

          // Idempotency: try to claim this (enrollment, node) slot first
          const { error: claimErr } = await supabase
            .from("journey_message_log")
            .insert({
              journey_id: journey.id,
              enrollment_id: enrollment.id,
              node_id: currentNode.id,
              contact_id: enrollment.contact_id,
              channel,
              template_body: null,
              status: "sending",
            });

          if (claimErr) {
            // Conflict (already processed for this node) — just advance.
            const nextEdge = canvas.edges.find((e: any) => e.source === currentNode.id);
            if (nextEdge) {
              await supabase.from("journey_enrollments")
                .update({ current_node_id: nextEdge.target, next_action_at: new Date().toISOString() })
                .eq("id", enrollment.id);
            }
            processed++;
            continue;
          }

          let sendStatus = "failed";
          let errorMessage: string | null = null;
          let twilioSid: string | null = null;
          let renderedBody: string | null = null;

          try {
            if (channel !== "whatsapp_template") {
              throw new Error(`Unsupported channel: ${channel}`);
            }
            if (!templateId) throw new Error("Message node missing whatsapp_template_id");
            if (!fromNumber) throw new Error("No active WhatsApp sender configured (whatsapp_config.sender_number)");
            if (!contact?.phone) throw new Error("Contact phone missing");

            const variables = resolveVariables(variablesMap as Record<string, string>, contact);

            const resp = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Internal-Service-Key": serviceKey,
                "Authorization": `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                template_id: templateId,
                to_number: contact.phone,
                from_number: fromNumber,
                variables,
                allow_user_initiated: true,
                internal_caller: "process-journeys",
                journey_enrollment_id: enrollment.id,
              }),
            });
            const result = await resp.json();
            if (!resp.ok || !result?.success) {
              throw new Error(result?.error || `whatsapp-send failed (${resp.status})`);
            }
            sendStatus = "sent";
            twilioSid = result.twilio_message_sid || result.message_sid || null;
            renderedBody = JSON.stringify(variables);
            messagesSent++;
          } catch (e) {
            errorMessage = (e as Error).message;
            console.error(`Journey ${journey.id} enrollment ${enrollment.id} send failed:`, errorMessage);
          }

          await supabase.from("journey_message_log")
            .update({
              status: sendStatus,
              twilio_message_sid: twilioSid,
              error_message: errorMessage,
              template_body: renderedBody,
            })
            .eq("enrollment_id", enrollment.id)
            .eq("node_id", currentNode.id);

          if (sendStatus === "sent") {
            const nextEdge = canvas.edges.find((e: any) => e.source === currentNode.id);
            if (nextEdge) {
              await supabase.from("journey_enrollments")
                .update({ current_node_id: nextEdge.target, next_action_at: new Date().toISOString() })
                .eq("id", enrollment.id);
            }
          } else {
            // Mark enrollment failed to prevent infinite retry loops on the same node
            await supabase.from("journey_enrollments")
              .update({ status: "failed" })
              .eq("id", enrollment.id);
          }
          processed++;
          continue;
        }

        if (nodeType === "decision") {
          const condition = currentNode.data?.condition || "opened";
          const { data: events } = await supabase
            .from("journey_contact_events")
            .select("id")
            .eq("contact_id", enrollment.contact_id)
            .eq("event_type", condition)
            .limit(1);
          const hasEvent = events && events.length > 0;
          const handleId = hasEvent ? "yes" : "no";
          const nextEdge = canvas.edges.find(
            (e: any) => e.source === currentNode.id && (e.sourceHandle === handleId || (!e.sourceHandle && hasEvent))
          );
          if (nextEdge) {
            await supabase.from("journey_enrollments")
              .update({ current_node_id: nextEdge.target, next_action_at: new Date().toISOString() })
              .eq("id", enrollment.id);
          }
          processed++;
          continue;
        }

        // Entry / unknown -> advance
        const nextEdge = canvas.edges.find((e: any) => e.source === currentNode.id);
        if (nextEdge) {
          await supabase.from("journey_enrollments")
            .update({ current_node_id: nextEdge.target, next_action_at: new Date().toISOString() })
            .eq("id", enrollment.id);
        }
        processed++;
      }
    }

    return new Response(JSON.stringify({ processed, messagesSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("process-journeys error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
