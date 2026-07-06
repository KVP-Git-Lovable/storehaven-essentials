import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("SENDGRID_API_KEY");
    if (!key) throw new Error("SENDGRID_API_KEY is not configured");

    const [vRes, dRes] = await Promise.all([
      fetch("https://api.sendgrid.com/v3/verified_senders", { headers: { Authorization: `Bearer ${key}` } }),
      fetch("https://api.sendgrid.com/v3/whitelabel/domains", { headers: { Authorization: `Bearer ${key}` } }),
    ]);

    const verifiedSendersJson: any = vRes.ok ? await vRes.json() : { results: [] };
    const domainsJson: any = dRes.ok ? await dRes.json() : [];

    const verifiedSenders = (verifiedSendersJson.results || [])
      .filter((s: any) => s.verified?.status || s.verified === true)
      .map((s: any) => ({
        id: String(s.id),
        from_email: s.from_email,
        from_name: s.from_name,
        reply_to: s.reply_to,
        nickname: s.nickname,
        type: "sender" as const,
      }));

    const domains = (Array.isArray(domainsJson) ? domainsJson : [])
      .filter((d: any) => d.valid === true)
      .map((d: any) => ({
        id: String(d.id),
        domain: d.domain,
        subdomain: d.subdomain,
        type: "domain" as const,
      }));

    return new Response(
      JSON.stringify({ verifiedSenders, domains, hasAny: verifiedSenders.length + domains.length > 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message, hasAny: false, verifiedSenders: [], domains: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
