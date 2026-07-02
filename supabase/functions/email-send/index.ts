// Sends transactional email via Twilio SendGrid's v3 Mail Send API.
// The sending address is fixed to info@quickapp.ai on the authenticated quickapp.ai domain.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-service-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";
const FROM_EMAIL = "info@quickapp.ai";
const FROM_NAME = "QuickApp";

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

    const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
    if (!SENDGRID_API_KEY) {
      return new Response(JSON.stringify({ error: "SENDGRID_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sgResponse = await fetch(SENDGRID_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to_email }] }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        content: [{ type: "text/plain", value: emailBody }],
      }),
    });

    const sendgridMessageId = sgResponse.headers.get("X-Message-Id");
    const status = sgResponse.ok ? "sent" : "failed";
    let errorMessage: string | null = null;

    if (!sgResponse.ok) {
      const errText = await sgResponse.text();
      errorMessage = `SendGrid error [${sgResponse.status}]: ${errText}`;
    }

    await supabase.from("email_message_log").insert({
      to_email,
      from_email: FROM_EMAIL,
      subject,
      body: emailBody,
      status,
      sendgrid_message_id: sendgridMessageId,
      error_message: errorMessage,
      sent_by: userId,
    });

    if (!sgResponse.ok) {
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, message_id: sendgridMessageId }), {
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
