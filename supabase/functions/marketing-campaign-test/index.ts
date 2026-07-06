import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { wrapMarketingEmail, htmlToText, loadCompanyFooter } from "../_shared/marketing-email-shell.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("SENDGRID_API_KEY");
    if (!key) throw new Error("SENDGRID_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { campaign_id, recipients, sent_by } = body as {
      campaign_id: string;
      recipients: string[];
      sent_by?: string;
    };

    if (!campaign_id) throw new Error("campaign_id required");
    const list = Array.from(new Set((recipients || []).map((r) => String(r).trim().toLowerCase()).filter(Boolean)));
    if (list.length === 0) throw new Error("No recipients supplied");
    if (list.length > 10) throw new Error("Test send limited to 10 recipients");

    const { data: c, error } = await supabase
      .from("email_marketing_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .maybeSingle();
    if (error) throw error;
    if (!c) throw new Error("Campaign not found");

    const company = await loadCompanyFooter(supabase);
    const html = wrapMarketingEmail({
      html: c.html || "<p>(empty campaign body)</p>",
      previewText: c.preview_text,
      subject: c.subject,
      company,
      unsubscribeUrl: "#test-unsubscribe",
      showUnsubscribe: false,
    });
    const text = htmlToText(html);

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: list.map((to) => ({ to: [{ email: to }] })),
        from: { email: c.from_email, name: c.from_name },
        reply_to: c.reply_to ? { email: c.reply_to } : undefined,
        subject: `[TEST] ${c.subject}`,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html },
        ],
        mail_settings: { bypass_list_management: { enable: true } },
        categories: ["marketing-test"],
      }),
    });

    const status = res.status;
    const rawText = await res.text();
    const ok = status >= 200 && status < 300;

    await supabase.from("email_marketing_test_sends").insert({
      campaign_id,
      recipients: list,
      sent_by: sent_by || null,
      status: ok ? "sent" : "failed",
      error_message: ok ? null : `[${status}] ${rawText.slice(0, 500)}`,
    });

    if (!ok) throw new Error(`SendGrid test send failed [${status}]: ${rawText.slice(0, 300)}`);

    return new Response(JSON.stringify({ success: true, sent_to: list }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
