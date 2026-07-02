// Sends transactional email via Twilio's Email API (comms.twilio.com), using
// the same TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN already configured for the
// WhatsApp integration, authenticated with HTTP Basic Auth (no SendGrid SDK
// or SendGrid API key involved).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-service-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TWILIO_EMAIL_URL = "https://comms.twilio.com/v1/Emails";
const DEFAULT_FROM_EMAIL = "info@quickapp.ai";
const DEFAULT_FROM_NAME = "QuickApp";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { to_email, subject, body: emailBody, internal_caller } = body || {};

    let userId: string | null = null;
    const internalKey = req.headers.get("X-Internal-Service-Key");
    if (internal_caller && internalKey === serviceKey) {
      userId = null;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing authorization" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", ""),
      );
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    if (!to_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to_email)) {
      return new Response(JSON.stringify({ error: "A valid 'to_email' is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!subject || !subject.trim()) {
      return new Response(JSON.stringify({ error: "Subject is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!emailBody || !emailBody.trim()) {
      return new Response(JSON.stringify({ error: "Body is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return new Response(
        JSON.stringify({ error: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sender comes from config/env, never hardcoded as the only source — falls
    // back to the verified quickapp.ai default only if no override is set.
    const fromAddress = Deno.env.get("TWILIO_EMAIL_FROM_ADDRESS") || DEFAULT_FROM_EMAIL;
    const fromName = Deno.env.get("TWILIO_EMAIL_FROM_NAME") || DEFAULT_FROM_NAME;

    const basicAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const twilioResponse = await fetch(TWILIO_EMAIL_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { address: fromAddress, name: fromName },
        to: [{ address: to_email }],
        content: {
          subject,
          html: `<p>${escapeHtml(emailBody).replace(/\n/g, "<br>")}</p>`,
          text: emailBody,
        },
      }),
    });

    const twilioData = await twilioResponse.json().catch(() => ({}));
    const operationId = twilioData?.operationId ?? null;
    const status = twilioResponse.ok ? "sent" : "failed";
    let errorMessage: string | null = null;

    if (!twilioResponse.ok) {
      errorMessage = `Twilio error [${twilioResponse.status}]: ${JSON.stringify(twilioData)}`;
      console.error("[email-send] Twilio API failure", {
        status: twilioResponse.status,
        body: twilioData,
        operationId,
      });
    } else {
      console.log("[email-send] Twilio accepted email", {
        operationId,
        operationLocation: twilioData?.operationLocation ?? null,
      });
    }

    // No dedicated delivery-tracking store exists yet — persist the operationId
    // on the existing message-log row (reusing its provider-id column) so it's
    // at least available for follow-up lookups later.
    await supabase.from("email_message_log").insert({
      to_email,
      from_email: fromAddress,
      subject,
      body: emailBody,
      status,
      sendgrid_message_id: operationId,
      error_message: errorMessage,
      sent_by: userId,
    });

    if (!twilioResponse.ok) {
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, operation_id: operationId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[email-send] error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
