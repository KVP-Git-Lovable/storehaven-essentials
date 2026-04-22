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
        if (!supabaseUrl || !serviceKey || !normalizedFrom) return;
        const supabase = createClient(supabaseUrl, serviceKey);

        // Lookup customer by phone (exact, then last 10 digits)
        let customerId: string | null = null;
        const last10 = normalizedFrom.replace(/\D/g, "").slice(-10);
        const { data: cust } = await supabase
          .from("customers")
          .select("id, phone")
          .or(`phone.eq.${normalizedFrom},phone.ilike.%${last10}`)
          .limit(1)
          .maybeSingle();
        if (cust?.id) customerId = cust.id;

        await supabase.from("whatsapp_messages").insert({
          phone: normalizedFrom,
          customer_id: customerId,
          direction: "inbound",
          message: body,
          message_type: "text",
          status: "received",
          twilio_message_sid: messageSid || null,
          profile_name: profileName || null,
          is_read: false,
        });

        if (isGreeting) {
          await supabase.from("whatsapp_messages").insert({
            phone: normalizedFrom,
            customer_id: customerId,
            direction: "outbound",
            message: WELCOME,
            message_type: "text",
            status: "sent",
            is_read: true,
          });
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
