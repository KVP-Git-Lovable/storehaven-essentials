import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getNested(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function resolveContactPath(contact: any, rawPath: string): string {
  if (!contact) return "";
  // Strip leading "contact." if present
  let path = rawPath.startsWith("contact.") ? rawPath.slice("contact.".length) : rawPath;

  // Aliases for common fields
  if (path === "name") {
    const n = contact.name;
    if (n != null && String(n).trim()) return String(n);
    const fn = contact.first_name ?? "";
    const ln = contact.last_name ?? "";
    const combined = `${fn} ${ln}`.trim();
    if (combined) return combined;
    // fallthrough to metadata.name
    const meta = getNested(contact.metadata, "name");
    return meta == null ? "" : String(meta);
  }

  // Direct column lookup
  const direct = getNested(contact, path);
  if (direct != null && direct !== "") return String(direct);

  // Fallback into metadata JSON
  // e.g. "city" -> metadata.city, "metadata.city" -> metadata.city
  if (path.startsWith("metadata.")) {
    const v = getNested(contact, path);
    return v == null ? "" : String(v);
  }
  const metaVal = getNested(contact.metadata, path);
  return metaVal == null ? "" : String(metaVal);
}

function resolveSingleToken(token: string, contact: any): string {
  // token is the inner content of {{...}} or {...}
  const trimmed = token.trim();
  return resolveContactPath(contact, trimmed);
}

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

    let resolved: string;
    const hasDoubleBrace = /\{\{[^}]+\}\}/.test(source);
    const hasSingleBrace = /\{[^{}]+\}/.test(source);

    if (hasDoubleBrace || hasSingleBrace) {
      // Replace all {{...}} first, then any remaining {...}
      resolved = source.replace(/\{\{([^}]+)\}\}/g, (_m, inner) =>
        resolveSingleToken(inner, contact),
      );
      resolved = resolved.replace(/\{([^{}]+)\}/g, (_m, inner) =>
        resolveSingleToken(inner, contact),
      );
    } else {
      // Plain field name: direct lookup (with contact.* alias support)
      resolved = resolveContactPath(contact, source);
    }

    if (!resolved || !resolved.trim()) {
      // Safety fallback for variable {{1}} (Twilio rejects empty placeholders)
      out[key] = key === "1" ? "Customer" : "";
    } else {
      out[key] = resolved;
    }
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
          let sendAccepted = false;
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
            // Default {{1}} to contact name if the journey didn't map any variables.
            // WhatsApp templates with missing placeholders are silently rejected by Meta (Twilio error 63019).
            if (!variables["1"]) {
              variables["1"] = (contact?.name && String(contact.name).trim()) || "Customer";
            }

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
                allow_user_initiated: false,
                internal_caller: "process-journeys",
                journey_enrollment_id: enrollment.id,
              }),
            });
            const result = await resp.json();
            if (!resp.ok || !result?.success) {
              throw new Error(result?.error || `whatsapp-send failed (${resp.status})`);
            }
            sendStatus = result.status || "queued";
            sendAccepted = ["accepted", "queued", "sending", "sent", "scheduled"].includes(sendStatus);
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
              delivery_status: sendAccepted ? "pending" : "failed",
              twilio_message_sid: twilioSid,
              error_message: errorMessage,
              template_body: renderedBody,
            })
            .eq("enrollment_id", enrollment.id)
            .eq("node_id", currentNode.id);

          if (sendAccepted) {
            // Provider accepted the request — but WhatsApp delivery can still
            // fail downstream (e.g. media fetch error 63019). Hold the
            // enrollment at this node until the status webhook reports a
            // terminal state. We push next_action_at into the future so the
            // cron does not re-process this row in the meantime.
            await supabase.from("journey_enrollments")
              .update({
                status: "pending_delivery",
                next_action_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              })
              .eq("id", enrollment.id);
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
