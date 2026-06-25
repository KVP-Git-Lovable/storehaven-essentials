import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { toWhatsAppE164IN } from "../_shared/phone-india.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

// Collapse stray "//" in URL path (preserve scheme "://") to avoid Twilio error 21620.
function sanitizeMediaUrl(url: string): string {
  const m = url.match(/^([a-z]+:\/\/)(.*)$/i);
  if (!m) return url;
  return m[1] + m[2].replace(/\/{2,}/g, "/");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    let { to_number, media_url, caption, from_number, force } = body ?? {};
    if (!to_number || typeof to_number !== "string") {
      return new Response(JSON.stringify({ error: "to_number is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!media_url || typeof media_url !== "string" || !/^https?:\/\//.test(media_url)) {
      return new Response(JSON.stringify({ error: "media_url must be a valid http(s) URL" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (caption && typeof caption === "string" && caption.length > 1024) {
      return new Response(JSON.stringify({ error: "caption exceeds 1024 chars" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    to_number = toWhatsAppE164IN(to_number) ?? to_number;
    if (!/^\+[1-9]\d{1,14}$/.test(to_number)) {
      return new Response(JSON.stringify({ error: "to_number must be in E.164 format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve from_number
    if (!from_number) {
      const { data: cfg } = await supabase
        .from("whatsapp_config")
        .select("sender_number")
        .limit(1)
        .maybeSingle();
      from_number = cfg?.sender_number || null;
    }
    from_number = from_number ? (toWhatsAppE164IN(from_number) ?? from_number) : null;
    if (!from_number || !/^\+[1-9]\d{1,14}$/.test(from_number)) {
      return new Response(JSON.stringify({ error: "No valid WhatsApp sender configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce 24h service window unless caller explicitly forces.
    if (!force) {
      const { data: inWindow, error: winErr } = await supabase.rpc("is_in_service_window", {
        _phone: to_number, _at: new Date().toISOString(),
      });
      if (winErr) console.error("service-window check failed:", winErr);
      if (!winErr && inWindow === false) {
        return new Response(JSON.stringify({
          error: "Recipient is outside the 24-hour WhatsApp service window. Freeform media can only be sent within 24h of the recipient's last inbound message. Re-engage via an approved template first.",
          code: "outside_service_window",
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const cleanMediaUrl = sanitizeMediaUrl(media_url.trim());

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      return new Response(JSON.stringify({ error: "Twilio gateway is not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const statusCallbackUrl = `${supabaseUrl}/functions/v1/whatsapp-inbound?event=status`;
    const params = new URLSearchParams({
      To: `whatsapp:${to_number}`,
      From: `whatsapp:${from_number}`,
      MediaUrl: cleanMediaUrl,
      StatusCallback: statusCallbackUrl,
    });
    if (caption && typeof caption === "string" && caption.trim()) {
      params.set("Body", caption.trim());
    }

    const twilioResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const twilioData = await twilioResponse.json();
    if (!twilioResponse.ok) {
      return new Response(JSON.stringify({
        error: `Twilio error [${twilioResponse.status}]: ${JSON.stringify(twilioData)}`,
        twilio: twilioData,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase.from("whatsapp_message_log").insert({
      template_id: null,
      to_number,
      twilio_message_sid: twilioData.sid,
      status: twilioData.status || "queued",
      sent_by: user.id,
    });

    try {
      const last10 = to_number.replace(/\D/g, "").slice(-10);
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .or(`phone.eq.${to_number},phone.ilike.%${last10}`)
        .limit(1)
        .maybeSingle();
      await supabase.from("whatsapp_messages").insert({
        phone: to_number,
        customer_id: cust?.id ?? null,
        direction: "outbound",
        message: caption || `[media] ${cleanMediaUrl}`,
        message_type: "freeform_media",
        status: twilioData.status || "sent",
        twilio_message_sid: twilioData.sid,
        is_read: true,
      });
    } catch (e) {
      console.error("whatsapp_messages insert failed:", e);
    }

    return new Response(JSON.stringify({
      success: true,
      message_sid: twilioData.sid,
      status: twilioData.status || "sent",
      media_url: cleanMediaUrl,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("whatsapp-send-media error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});