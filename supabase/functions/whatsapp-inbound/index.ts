// Public Twilio inbound WhatsApp webhook.
// Replies to greetings with a Trayi Jewellery welcome message via TwiML.
// Non-greeting messages return an empty TwiML response, leaving room for
// future intent handlers (orders, products, etc.) without interfering.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GREETING_RE = /^\s*(hi|hello|hey|start)[\s!.?,]*$/i;
const WELCOME =
  "Welcome to Trayi Jewellery. ✨ I am your StoreOps assistant. How may I assist you today?";

// Product Inquiry intent: keyword match (case-insensitive, word-boundary)
const PRODUCT_INTENT_RE = /\b(products?|diamonds?|jewell?ery|collections?|items?)\b/i;
const PRODUCT_TEMPLATE_SID = "HX440122d86a157cb01de5f75a3aba1dd3";
const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";

async function sendProductTemplate(
  toNumber: string,
  fromNumber: string,
  customerId: string | null,
): Promise<void> {
  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const twilioKey = Deno.env.get("TWILIO_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!lovableKey || !twilioKey) {
      console.warn("[whatsapp-inbound] product-intent: missing Twilio/Lovable keys, skipping");
      return;
    }
    if (!toNumber || !/^\+[1-9]\d{1,14}$/.test(toNumber)) {
      console.warn("[whatsapp-inbound] product-intent: invalid recipient", toNumber);
      return;
    }

    let sender = fromNumber;
    if ((!sender || !/^\+[1-9]\d{1,14}$/.test(sender)) && supabaseUrl && serviceKey) {
      try {
        const sb = createClient(supabaseUrl, serviceKey);
        const { data: cfg } = await sb
          .from("whatsapp_config")
          .select("sender_number")
          .limit(1)
          .maybeSingle();
        if (cfg?.sender_number) sender = String(cfg.sender_number);
      } catch (e) {
        console.error("[whatsapp-inbound] product-intent: sender lookup err", e);
      }
    }
    if (!sender || !/^\+[1-9]\d{1,14}$/.test(sender)) {
      console.warn("[whatsapp-inbound] product-intent: no valid sender number");
      return;
    }

    const statusCallbackUrl = supabaseUrl
      ? `${supabaseUrl}/functions/v1/whatsapp-inbound?event=status`
      : null;

    const params = new URLSearchParams({
      To: `whatsapp:${toNumber}`,
      From: `whatsapp:${sender}`,
      ContentSid: PRODUCT_TEMPLATE_SID,
    });
    if (statusCallbackUrl) params.set("StatusCallback", statusCallbackUrl);

    const resp = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("[whatsapp-inbound] product-intent: Twilio error", resp.status, data);
      return;
    }
    console.log("[whatsapp-inbound] product-intent: template sent", data?.sid);

    if (supabaseUrl && serviceKey) {
      try {
        const sb = createClient(supabaseUrl, serviceKey);
        await sb.from("whatsapp_messages").insert({
          phone: toNumber,
          customer_id: customerId,
          direction: "outbound",
          message: "[Product Inquiry template]",
          message_type: "template",
          status: data?.status || "queued",
          twilio_message_sid: data?.sid || null,
          is_read: true,
        });
      } catch (e) {
        console.error("[whatsapp-inbound] product-intent: log insert err", e);
      }
    }
  } catch (e) {
    console.error("[whatsapp-inbound] product-intent: unexpected error", e);
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twiml(message?: string): Response {
  const inner = message
    ? `<Message>${escapeXml(message)}</Message>`
    : "";
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
  return new Response(xml, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // Twilio sends application/x-www-form-urlencoded
    const contentType = req.headers.get("content-type") || "";
    let body = "";
    let from = "";
    let to = "";
    let messageSid = "";
    let profileName = "";
    let messageStatus = "";
    let errorCode = "";
    let channelStatusMessage = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = params.get("Body") ?? "";
      from = params.get("From") ?? "";
      to = params.get("To") ?? "";
      messageSid = params.get("MessageSid") ?? "";
      profileName = params.get("ProfileName") ?? "";
      messageStatus = params.get("MessageStatus") ?? "";
      errorCode = params.get("ErrorCode") ?? "";
      channelStatusMessage = params.get("ChannelStatusMessage") ?? "";
    } else if (contentType.includes("application/json")) {
      const json = await req.json().catch(() => ({}));
      body = json.Body ?? json.body ?? "";
      from = json.From ?? json.from ?? "";
      to = json.To ?? json.to ?? "";
      messageSid = json.MessageSid ?? "";
      profileName = json.ProfileName ?? "";
      messageStatus = json.MessageStatus ?? json.messageStatus ?? "";
      errorCode = json.ErrorCode ?? json.errorCode ?? "";
      channelStatusMessage = json.ChannelStatusMessage ?? json.channelStatusMessage ?? "";
    }

    console.log("[whatsapp-inbound]", {
      from,
      to,
      messageSid,
      profileName,
      bodyPreview: body.slice(0, 200),
    });

    const eventType = new URL(req.url).searchParams.get("event") || "inbound";

    // Normalize phone (strip whatsapp: prefix)
    const normalizedFrom = from.replace(/^whatsapp:/i, "").trim();

    if (eventType === "status" && messageSid) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey) {
        const supabase = createClient(supabaseUrl, serviceKey);
        const status = (messageStatus || "unknown").toLowerCase();
        const errorMessage = [errorCode, channelStatusMessage].filter(Boolean).join(": ") || null;

        await supabase
          .from("whatsapp_message_log")
          .update({ status })
          .eq("twilio_message_sid", messageSid);

        await supabase
          .from("whatsapp_messages")
          .update({ status })
          .eq("twilio_message_sid", messageSid);

        // Journey delivery state machine: queued/sent/delivered/read = success path,
        // failed/undelivered = terminal failure. Anything else is intermediate.
        const SUCCESS = new Set(["sent", "delivered", "read"]);
        const FAILURE = new Set(["failed", "undelivered"]);
        const terminalSuccess = SUCCESS.has(status);
        const terminalFailure = FAILURE.has(status);

        const deliveryStatus = terminalSuccess
          ? "delivered"
          : terminalFailure
          ? "failed"
          : "pending";

        // Find the journey_message_log row for this provider SID so we can
        // also advance the matching enrollment.
        const { data: jmlRows } = await supabase
          .from("journey_message_log")
          .select("id, journey_id, enrollment_id, node_id, delivery_status")
          .eq("twilio_message_sid", messageSid);

        await supabase
          .from("journey_message_log")
          .update({
            status,
            delivery_status: deliveryStatus,
            error_message: errorMessage,
            error_code: errorCode || null,
          })
          .eq("twilio_message_sid", messageSid);

        for (const jml of jmlRows || []) {
          // Idempotency: skip if we already advanced/failed this enrollment
          if (jml.delivery_status === "delivered" || jml.delivery_status === "failed") continue;

          if (terminalSuccess) {
            const { data: journey } = await supabase
              .from("journeys")
              .select("canvas_data")
              .eq("id", jml.journey_id)
              .maybeSingle();
            const canvas = (journey?.canvas_data as any) || {};
            const nextEdge = (canvas.edges || []).find((e: any) => e.source === jml.node_id);
            if (nextEdge) {
              await supabase
                .from("journey_enrollments")
                .update({
                  status: "active",
                  current_node_id: nextEdge.target,
                  next_action_at: new Date().toISOString(),
                })
                .eq("id", jml.enrollment_id);
            } else {
              await supabase
                .from("journey_enrollments")
                .update({ status: "completed" })
                .eq("id", jml.enrollment_id);
            }
          } else if (terminalFailure) {
            await supabase
              .from("journey_enrollments")
              .update({ status: "failed" })
              .eq("id", jml.enrollment_id);
          }
        }
      }
      return twiml();
    }

    // Log inbound message + auto-reply (best-effort, never breaks TwiML)
    const logMessages = async (isGreeting: boolean) => {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        console.log("[whatsapp-inbound] logMessages start", {
          hasUrl: !!supabaseUrl,
          hasKey: !!serviceKey,
          normalizedFrom,
          isGreeting,
        });
        if (!supabaseUrl || !serviceKey || !normalizedFrom) {
          console.warn("[whatsapp-inbound] missing config or phone, skipping log");
          return;
        }
        const supabase = createClient(supabaseUrl, serviceKey);

        // Lookup customer by phone — try exact match, then last-10-digits suffix.
        let customerId: string | null = null;
        const last10 = normalizedFrom.replace(/\D/g, "").slice(-10);
        try {
          const { data: exact } = await supabase
            .from("customers")
            .select("id")
            .eq("phone", normalizedFrom)
            .limit(1)
            .maybeSingle();
          if (exact?.id) {
            customerId = exact.id;
          } else if (last10.length === 10) {
            const { data: fuzzy } = await supabase
              .from("customers")
              .select("id")
              .ilike("phone", `%${last10}`)
              .limit(1)
              .maybeSingle();
            if (fuzzy?.id) customerId = fuzzy.id;
          }
        } catch (lookupErr) {
          console.error("[whatsapp-inbound] customer lookup error:", lookupErr);
        }

        const inboundRow = {
          phone: normalizedFrom,
          customer_id: customerId,
          direction: "inbound",
          message: body,
          message_type: "text",
          status: "received",
          twilio_message_sid: messageSid || null,
          profile_name: profileName || null,
          is_read: false,
        };
        const { data: insIn, error: insInErr } = await supabase
          .from("whatsapp_messages")
          .insert(inboundRow)
          .select("id")
          .maybeSingle();
        if (insInErr) {
          console.error("[whatsapp-inbound] insert inbound error:", insInErr);
        } else {
          console.log("[whatsapp-inbound] inbound saved", insIn?.id);
        }

        // Self-heal: capture our own WhatsApp sender number from the `To` field
        // so outbound flows (journeys, campaigns) have a from_number even when
        // Twilio's senders API returns empty.
        try {
          const normalizedTo = (to || "").replace(/^whatsapp:/i, "").trim();
          if (normalizedTo && /^\+[1-9]\d{1,14}$/.test(normalizedTo)) {
            const { data: cfg } = await supabase
              .from("whatsapp_config")
              .select("id, sender_number")
              .limit(1)
              .maybeSingle();
            if (cfg && !cfg.sender_number) {
              await supabase
                .from("whatsapp_config")
                .update({ sender_number: normalizedTo })
                .eq("id", cfg.id);
              console.log("[whatsapp-inbound] auto-set sender_number to", normalizedTo);
            }
          }
        } catch (e) {
          console.error("[whatsapp-inbound] sender_number self-heal error:", e);
        }

        if (isGreeting) {
          const { data: insOut, error: insOutErr } = await supabase
            .from("whatsapp_messages")
            .insert({
              phone: normalizedFrom,
              customer_id: customerId,
              direction: "outbound",
              message: WELCOME,
              message_type: "text",
              status: "sent",
              is_read: true,
            })
            .select("id")
            .maybeSingle();
          if (insOutErr) {
            console.error("[whatsapp-inbound] insert outbound error:", insOutErr);
          } else {
            console.log("[whatsapp-inbound] outbound (welcome) saved", insOut?.id);
          }
        }
      } catch (e) {
        console.error("[whatsapp-inbound] log error:", e);
      }
    };

    // 1) Greeting check runs FIRST, before any other intent logic.
    if (GREETING_RE.test(body)) {
      await logMessages(true);
      return twiml(WELCOME);
    }

    // 2) Fallback: empty response — leaves space for future intent handlers
    //    (orders, products, etc.) to be added above this line.
    await logMessages(false);
    return twiml();
  } catch (error) {
    console.error("[whatsapp-inbound] error:", error);
    // Always return valid TwiML so Twilio doesn't retry-storm.
    return twiml();
  }
});
