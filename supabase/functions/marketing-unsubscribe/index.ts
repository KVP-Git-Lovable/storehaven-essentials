import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalize(e: string) { return String(e || "").trim().toLowerCase(); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const sgKey = Deno.env.get("SENDGRID_API_KEY");

  try {
    let email = "";
    let campaignId: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      email = normalize(url.searchParams.get("e") || "");
      campaignId = url.searchParams.get("c");
    } else {
      const body = await req.json();
      email = normalize(body.email || "");
      campaignId = body.campaign_id || null;
    }
    if (!email) throw new Error("email is required");

    if (req.method === "GET") {
      const { data } = await supabase.from("email_marketing_suppressions").select("email").eq("email", email).maybeSingle();
      return new Response(JSON.stringify({ email, already: !!data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST — record suppression
    await supabase.from("email_marketing_suppressions").upsert(
      { email, reason: "unsubscribe", campaign_id: campaignId },
      { onConflict: "email", ignoreDuplicates: true },
    );

    // Mirror to SendGrid global unsubscribes (best-effort)
    if (sgKey) {
      await fetch("https://api.sendgrid.com/v3/asm/suppressions/global", {
        method: "POST",
        headers: { Authorization: `Bearer ${sgKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_emails: [email] }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
