import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const CACHE_KEY = "twilio_balance";
const TTL_SECONDS = 180; // 3 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    let force = url.searchParams.get("force") === "1";
    if (!force && req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.force === true || body?.force === 1 || body?.force === "1") force = true;
      } catch (_) { /* no body */ }
    }

    if (!force) {
      const { data: cached } = await supabase
        .from("app_cache")
        .select("value, expires_at")
        .eq("key", CACHE_KEY)
        .maybeSingle();
      if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
        return new Response(JSON.stringify({ ...cached.value, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      return new Response(JSON.stringify({ error: "Twilio not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch(`${GATEWAY_URL}/Balance.json`, {
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
      },
    });
    const data = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `Twilio error [${resp.status}]`, details: data }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = {
      balance: data.balance ?? null,
      currency: data.currency ?? "USD",
      account_sid: data.account_sid ?? null,
      fetched_at: new Date().toISOString(),
    };

    await supabase.from("app_cache").upsert({
      key: CACHE_KEY,
      value: result,
      expires_at: new Date(Date.now() + TTL_SECONDS * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ...result, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});