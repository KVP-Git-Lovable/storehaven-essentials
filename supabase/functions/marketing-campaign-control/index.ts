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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { campaign_id, action, scheduled_at } = await req.json();
    if (!campaign_id || !action) throw new Error("campaign_id and action required");

    const { data: c } = await supabase.from("email_marketing_campaigns").select("*").eq("id", campaign_id).maybeSingle();
    if (!c) throw new Error("Campaign not found");
    const ssId = c.sendgrid_single_send_id;

    const sg = (path: string, init: RequestInit) => fetch(`https://api.sendgrid.com/v3${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers || {}) },
    });

    if (action === "pause") {
      if (ssId) await sg(`/marketing/singlesends/${ssId}/schedule`, { method: "DELETE" });
      await supabase.from("email_marketing_campaigns").update({ status: "paused" }).eq("id", campaign_id);
    } else if (action === "resume") {
      if (!ssId) throw new Error("No SendGrid Single Send to resume");
      const send_at = scheduled_at || "now";
      const r = await sg(`/marketing/singlesends/${ssId}/schedule`, { method: "PUT", body: JSON.stringify({ send_at }) });
      if (!r.ok) throw new Error(`Resume failed: ${await r.text()}`);
      await supabase.from("email_marketing_campaigns").update({
        status: scheduled_at ? "scheduled" : "sending",
        scheduled_at: scheduled_at || new Date().toISOString(),
      }).eq("id", campaign_id);
    } else if (action === "cancel") {
      if (ssId) await sg(`/marketing/singlesends/${ssId}/schedule`, { method: "DELETE" });
      await supabase.from("email_marketing_campaigns").update({ status: "cancelled" }).eq("id", campaign_id);
    } else if (action === "delete") {
      if (ssId) await sg(`/marketing/singlesends/${ssId}`, { method: "DELETE" });
      await supabase.from("email_marketing_campaigns").delete().eq("id", campaign_id);
    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
