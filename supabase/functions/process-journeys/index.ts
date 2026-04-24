import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeNextRun, resolveAudience, type JourneySchedule } from "../_shared/journey-schedule.ts";
import {
  renderFreeformBody,
  sendWhatsAppFreeform,
  sendSms,
  sendEmail,
  type ChannelSendResult,
  type FreeformChannel,
} from "../_shared/journey-channels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sweep journey_schedules: enroll audiences for any due, approved+active journey,
// then advance next_run_at to the next IST occurrence.
async function runScheduleSweep(supabase: any): Promise<{ triggered: number; errors: string[] }> {
  const errors: string[] = [];
  let triggered = 0;
  const nowIso = new Date().toISOString();

  const { data: dueSchedules, error: schedErr } = await supabase
    .from("journey_schedules")
    .select("*, journeys!inner(id, status, approval_status, list_view_id, segment_type, filters, canvas_data)")
    .lte("next_run_at", nowIso)
    .not("next_run_at", "is", null)
    .eq("journeys.status", "active")
    .eq("journeys.approval_status", "approved");

  if (schedErr) {
    console.error("[schedule-sweep] failed to fetch due schedules:", schedErr);
    return { triggered: 0, errors: [schedErr.message] };
  }
  if (!dueSchedules || dueSchedules.length === 0) return { triggered: 0, errors: [] };

  for (const sched of dueSchedules) {
    const journey = sched.journeys;
    const scheduleRow: JourneySchedule = {
      id: sched.id,
      journey_id: sched.journey_id,
      type: sched.type,
      frequency: sched.frequency,
      execution_date: sched.execution_date,
      execution_time: sched.execution_time,
      days_of_week: sched.days_of_week,
      day_of_month: sched.day_of_month,
      month_of_quarter: sched.month_of_quarter,
    };

    // Compute next run BEFORE doing work, then claim atomically by updating
    // next_run_at to that future value. If the update affects 0 rows another
    // worker already claimed it.
    const next = computeNextRun(scheduleRow, new Date());
    const nextIso = sched.type === "one_time"
      ? null // one-time schedules don't refire
      : (next ? next.toISOString() : null);

    const { data: claimed, error: claimErr } = await supabase
      .from("journey_schedules")
      .update({ next_run_at: nextIso })
      .eq("id", sched.id)
      .lte("next_run_at", nowIso)
      .select("id");
    if (claimErr) {
      errors.push(`claim ${sched.id}: ${claimErr.message}`);
      continue;
    }
    if (!claimed || claimed.length === 0) continue; // someone else got it

    try {
      // Refresh enrollments so dynamic audiences re-evaluate
      await supabase
        .from("journey_enrollments")
        .delete()
        .eq("journey_id", journey.id)
        .in("status", ["active", "paused", "failed"]);

      const audience = await resolveAudience(supabase, journey);
      const canvas = journey.canvas_data as any;
      const entryNode = canvas?.nodes?.find((n: any) => n.type === "entry");
      const firstNodeId = entryNode?.id || canvas?.nodes?.[0]?.id;

      if (audience.contactIds.length > 0 && firstNodeId) {
        const enrollments = audience.contactIds.map((cid: string) => ({
          journey_id: journey.id,
          contact_id: cid,
          current_node_id: firstNodeId,
          status: "active",
          next_action_at: new Date().toISOString(),
        }));
        const { error: enrErr } = await supabase.from("journey_enrollments").insert(enrollments);
        if (enrErr) throw new Error(`enroll: ${enrErr.message}`);
      }

      // Audit log: one row per scheduled run so Analytics shows misses too
      await supabase.from("journey_message_log").insert({
        journey_id: journey.id,
        enrollment_id: null,
        node_id: null,
        contact_id: null,
        channel: "system",
        status: audience.contactIds.length > 0 ? "scheduled_enrolled" : "scheduled_no_audience",
        template_body: JSON.stringify({
          schedule_id: sched.id,
          matched: audience.matched,
          enrolled: audience.contactIds.length,
          skipped: audience.skipped,
          reason: audience.firstError || null,
        }),
      });

      triggered++;
      console.log(
        `[schedule-sweep] journey=${journey.id} enrolled=${audience.contactIds.length} matched=${audience.matched} next_run=${nextIso}`,
      );
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error(`[schedule-sweep] journey ${journey.id} failed:`, msg);
      errors.push(`journey ${journey.id}: ${msg}`);
      await supabase.from("journey_message_log").insert({
        journey_id: journey.id,
        channel: "system",
        status: "scheduled_failed",
        template_body: JSON.stringify({ schedule_id: sched.id, error: msg }),
        error_message: msg,
      });
    }
  }

  return { triggered, errors };
}

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

    // Step 1: Schedule sweep — turn due journey_schedules rows into fresh enrollments.
    const sweep = await runScheduleSweep(supabase);
    console.log(`scheduled_runs_triggered: ${sweep.triggered}`);

    const { data: cfg } = await supabase
      .from("whatsapp_config")
      .select("sender_number, sms_sender_number")
      .limit(1)
      .maybeSingle();
    let fromNumber: string | null = cfg?.sender_number || null;
    if (!fromNumber) {
      const envFrom = Deno.env.get("WHATSAPP_FROM_NUMBER");
      if (envFrom && /^\+[1-9]\d{1,14}$/.test(envFrom)) fromNumber = envFrom;
    }
    const smsFromNumber: string | null =
      cfg?.sms_sender_number || cfg?.sender_number || Deno.env.get("TWILIO_SMS_FROM") || null;

    const { data: activeJourneys } = await supabase
      .from("journeys").select("*").eq("status", "active");

    if (!activeJourneys || activeJourneys.length === 0) {
      return new Response(JSON.stringify({ processed: 0, scheduled_runs_triggered: sweep.triggered, schedule_errors: sweep.errors }), {
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
          const messageType: string =
            data.message_type || (data.channel === "whatsapp_template" ? "template" : "template");

          // ============ TEMPLATE MODE (unchanged path) ============
          if (messageType === "template") {
            const channel = data.channel || "whatsapp_template";
            const templateId = data.whatsapp_template_id;
            const variablesMap = data.template_variables || {};

            // Idempotency: try to claim this (enrollment, node, channel) slot first
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
                template_id: templateId || null,
              });

            if (claimErr) {
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
              if (channel !== "whatsapp_template") throw new Error(`Unsupported channel: ${channel}`);
              if (!templateId) throw new Error("Message node missing whatsapp_template_id");
              if (!fromNumber) throw new Error("No active WhatsApp sender configured (whatsapp_config.sender_number)");
              if (!contact?.phone) throw new Error("Contact phone missing");

              const variables = resolveVariables(variablesMap as Record<string, string>, contact);
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
              .eq("node_id", currentNode.id)
              .eq("channel", channel);

            if (sendAccepted) {
              await supabase.from("journey_enrollments")
                .update({
                  status: "pending_delivery",
                  next_action_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                })
                .eq("id", enrollment.id);
            } else {
              await supabase.from("journey_enrollments")
                .update({ status: "failed" })
                .eq("id", enrollment.id);
            }
            processed++;
            continue;
          }

          // ============ FREE-FORM MODE (new) ============
          const channels: FreeformChannel[] = Array.isArray(data.freeform_channels)
            ? (data.freeform_channels as FreeformChannel[]).filter((c) => ["whatsapp", "sms", "email"].includes(c))
            : [];
          const rawBody: string = String(data.freeform_body || "").trim();
          const subject: string =
            String(data.freeform_subject || "").trim() || `Message from ${journey.name || "your team"}`;

          if (channels.length === 0 || !rawBody) {
            await supabase.from("journey_message_log").insert({
              journey_id: journey.id,
              enrollment_id: enrollment.id,
              node_id: currentNode.id,
              contact_id: enrollment.contact_id,
              channel: "system",
              status: "failed",
              error_message: !rawBody ? "Free-form body is empty" : "No channels selected",
            });
            await supabase.from("journey_enrollments")
              .update({ status: "failed" })
              .eq("id", enrollment.id);
            processed++;
            continue;
          }

          const renderedBody = renderFreeformBody(rawBody, contact);
          const sendResults: ChannelSendResult[] = [];

          for (const ch of channels) {
            // Per-channel idempotency claim
            const { error: claimErr } = await supabase
              .from("journey_message_log")
              .insert({
                journey_id: journey.id,
                enrollment_id: enrollment.id,
                node_id: currentNode.id,
                contact_id: enrollment.contact_id,
                channel: ch,
                template_body: renderedBody,
                status: "sending",
              });
            if (claimErr) continue; // already attempted this channel

            let result: ChannelSendResult;
            if (ch === "whatsapp") {
              result = await sendWhatsAppFreeform(fromNumber || "", contact?.phone || "", renderedBody);
            } else if (ch === "sms") {
              result = await sendSms(smsFromNumber || "", contact?.phone || "", renderedBody);
            } else {
              result = await sendEmail(contact?.email || "", subject, renderedBody);
            }
            sendResults.push(result);
            if (result.accepted) messagesSent++;

            await supabase.from("journey_message_log")
              .update({
                status: result.status,
                delivery_status: result.accepted ? "pending" : "failed",
                twilio_message_sid: result.providerMessageId,
                error_message: result.errorMessage,
                error_code: result.errorCode,
                provider_metadata: result.providerMetadata as any,
              })
              .eq("enrollment_id", enrollment.id)
              .eq("node_id", currentNode.id)
              .eq("channel", ch);
          }

          const anyAccepted = sendResults.some((r) => r.accepted);
          if (anyAccepted) {
            await supabase.from("journey_enrollments")
              .update({
                status: "pending_delivery",
                next_action_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              })
              .eq("id", enrollment.id);
          } else {
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

    return new Response(JSON.stringify({
      processed,
      messagesSent,
      scheduled_runs_triggered: sweep.triggered,
      schedule_errors: sweep.errors,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("process-journeys error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
