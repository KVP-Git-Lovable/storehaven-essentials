import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Hardcoded template SID per spec — clicks for this template are attributed to the journey it was sent from.
const TRACKED_TEMPLATE_SID = "HX2a54377b41a3c48d5ae8984a4e900e56";

function normalizePhone(raw: string): { e164OrRaw: string; last10: string } {
  const cleaned = String(raw || "").replace(/\D/g, "");
  const last10 = cleaned.slice(-10);
  const e164OrRaw = cleaned.startsWith("0") ? cleaned : (cleaned.length === 10 ? `+91${cleaned}` : `+${cleaned}`);
  return { e164OrRaw, last10 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let phoneRaw = url.searchParams.get("phone") || "";
    let templateSid = url.searchParams.get("template_sid") || TRACKED_TEMPLATE_SID;

    // Allow POST body as alternative
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.phone) phoneRaw = String(body.phone);
        if (body?.template_sid) templateSid = String(body.template_sid);
      } catch (_) { /* ignore */ }
    }

    if (!phoneRaw) {
      return new Response(JSON.stringify({ ok: false, error: "phone is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { e164OrRaw, last10 } = normalizePhone(phoneRaw);
    const userAgent = req.headers.get("user-agent") || null;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    // Best-effort journey attribution: find the most recent journey_message_log row
    // for this template SID sent to a contact whose phone matches.
    let journeyId: string | null = null;
    try {
      // Step 1: find the template row by twilio_content_sid
      const { data: tmpl } = await supabase
        .from("whatsapp_templates")
        .select("id")
        .eq("twilio_content_sid", templateSid)
        .maybeSingle();

      if (tmpl?.id) {
        // Step 2: get recent message logs for this template, then filter by contact phone in JS
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: logs } = await supabase
          .from("journey_message_log")
          .select("journey_id, created_at, contact_id, journey_contacts(phone)")
          .eq("template_id", tmpl.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(200);

        if (logs && logs.length > 0) {
          const match = logs.find((row: any) => {
            const p = String(row.journey_contacts?.phone || "").replace(/\D/g, "");
            return p && (p === last10 || p.endsWith(last10));
          });
          if (match) journeyId = match.journey_id;
        }
      }
    } catch (e) {
      console.error("[track-link-click] attribution lookup failed:", e);
    }

    const { data: inserted, error: insErr } = await supabase
      .from("whatsapp_link_clicks")
      .insert({
        phone_number: e164OrRaw,
        template_sid: templateSid,
        journey_id: journeyId,
        user_agent: userAgent,
        ip_address: ip,
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("[track-link-click] insert failed:", insErr);
      return new Response(JSON.stringify({ ok: false, error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      id: inserted?.id,
      journey_id: journeyId,
      attributed: !!journeyId,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[track-link-click] error:", err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
