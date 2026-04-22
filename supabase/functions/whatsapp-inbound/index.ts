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

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = params.get("Body") ?? "";
      from = params.get("From") ?? "";
      to = params.get("To") ?? "";
      messageSid = params.get("MessageSid") ?? "";
      profileName = params.get("ProfileName") ?? "";
    } else if (contentType.includes("application/json")) {
      const json = await req.json().catch(() => ({}));
      body = json.Body ?? json.body ?? "";
      from = json.From ?? json.from ?? "";
      to = json.To ?? json.to ?? "";
      messageSid = json.MessageSid ?? "";
      profileName = json.ProfileName ?? "";
    }

    console.log("[whatsapp-inbound]", {
      from,
      to,
      messageSid,
      profileName,
      bodyPreview: body.slice(0, 200),
    });

    // Normalize phone (strip whatsapp: prefix)
    const normalizedFrom = from.replace(/^whatsapp:/i, "").trim();

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
