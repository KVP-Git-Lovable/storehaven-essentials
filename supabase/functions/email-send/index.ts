// Sends transactional email via Twilio's Email API (comms.twilio.com), reached
// through the same Lovable connector gateway + Twilio connection already used
// by the WhatsApp/SMS integrations. The sending address is fixed to
// info@quickapp.ai on the authenticated quickapp.ai domain.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-service-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const FROM_EMAIL = "info@quickapp.ai";
const FROM_NAME = "QuickApp";

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) {
      return new Response(JSON.stringify({ error: "TWILIO_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const twilioResponse = await fetch(`${GATEWAY_URL}/v1/Emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { address: FROM_EMAIL, name: FROM_NAME },
        to: [{ address: to_email }],
        content: {
          subject,
          html: `<p>${escapeHtml(emailBody).replace(/\n/g, "<br>")}</p>`,
          text: emailBody,
        },
      }),
    });

    const twilioData = await twilioResponse.json().catch(() => ({}));
    const providerMessageId =
      twilioData?.messages?.[0]?.message_id ?? twilioData?.message_id ?? twilioData?.id ?? null;
    const status = twilioResponse.ok ? "sent" : "failed";
    const errorMessage = twilioResponse.ok
      ? null
      : `Twilio error [${twilioResponse.status}]: ${JSON.stringify(twilioData)}`;

    await supabase.from("email_message_log").insert({
      to_email,
      from_email: FROM_EMAIL,
      subject,
      body: emailBody,
      status,
      sendgrid_message_id: providerMessageId,
      error_message: errorMessage,
      sent_by: userId,
    });

    if (!twilioResponse.ok) {
      return new Response(JSON.stringify({ error: errorMessage, twilio: twilioData }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, message_id: providerMessageId }), {
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
