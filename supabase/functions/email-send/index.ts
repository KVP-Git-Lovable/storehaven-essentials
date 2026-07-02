// Sends transactional email via Twilio Email API (Comms API).
// Authenticates with the existing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN via HTTP Basic Auth.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-service-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TWILIO_EMAIL_URL = "https://comms.twilio.com/v1/Emails";
const FROM_EMAIL = Deno.env.get("EMAIL_FROM_ADDRESS") || "info@quickapp.ai";
const FROM_NAME = Deno.env.get("EMAIL_FROM_NAME") || "QuickApp";

function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

function toHtml(s: string): string {
  if (looksLikeHtml(s)) return s;
  const escaped = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p>${escaped.replace(/\n/g, "<br/>")}</p>`;
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
        JSON.stringify({ error: "Twilio credentials are not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const basic = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const payload = {
      from: { address: FROM_EMAIL, name: FROM_NAME },
      to: [{ address: to_email }],
      content: {
        subject,
        text: emailBody,
        html: toHtml(emailBody),
      },
    };

    const twResponse = await fetch(TWILIO_EMAIL_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const rawText = await twResponse.text();
    let parsed: any = null;
    try { parsed = rawText ? JSON.parse(rawText) : null; } catch { /* ignore */ }
    const operationId: string | null = parsed?.operationId || parsed?.operation_id || null;
    const status = twResponse.ok ? "sent" : "failed";
    let errorMessage: string | null = null;

    if (!twResponse.ok) {
      const code = parsed?.code ?? parsed?.error?.code ?? null;
      const message = parsed?.message ?? parsed?.error?.message ?? null;
      errorMessage = `Twilio Email error [${twResponse.status}]: ${rawText}`;
      console.error("[email-send] twilio error", {
        status: twResponse.status,
        code,
        message,
        body: rawText,
      });
    }

    await supabase.from("email_message_log").insert({
      to_email,
      from_email: FROM_EMAIL,
      subject,
      body: emailBody,
      status,
      sendgrid_message_id: operationId,
      error_message: errorMessage,
      sent_by: userId,
    });

    if (!twResponse.ok) {
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, message_id: operationId }), {
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
