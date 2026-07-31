import { createClient } from "npm:@supabase/supabase-js@2";
import { graph } from "../_shared/meta-graph.ts";
import { encryptSecret } from "../_shared/meta-crypto.ts";

function closingPage(payload: Record<string, unknown>) {
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return new Response(
    `<!doctype html><html><body style="font-family:system-ui;padding:24px">
<p>${payload.ok ? "Connected. You can close this window." : "Connection failed: " + payload.error}</p>
<script>
  try { window.opener && window.opener.postMessage({ source: "meta-oauth", ...${json} }, "*"); } catch (e) {}
  setTimeout(function(){ window.close(); }, 800);
</script></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (err) return closingPage({ ok: false, error: err });
  if (!code) return closingPage({ ok: false, error: "Missing authorization code" });

  try {
    const appId = Deno.env.get("META_APP_ID");
    const appSecret = Deno.env.get("META_APP_SECRET");
    if (!appId || !appSecret) throw new Error("Meta app credentials are not configured");

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-oauth-callback`;

    // 1. code -> short-lived token
    const shortRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`,
    );
    const shortJson = await shortRes.json();
    if (!shortRes.ok || shortJson.error) throw new Error(shortJson.error?.message || "Token exchange failed");

    // 2. short -> long-lived token
    const longRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token` +
        `&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortJson.access_token}`,
    );
    const longJson = await longRes.json();
    const userToken: string = longJson.access_token || shortJson.access_token;
    const expiresIn: number = Number(longJson.expires_in || shortJson.expires_in || 0);

    // 3. profile, businesses, pages, ad accounts
    const me = await graph("/me", { token: userToken, params: { fields: "id,name" } });
    let businessName: string | null = null;
    let businessId: string | null = null;
    try {
      const biz = await graph("/me/businesses", { token: userToken, params: { fields: "id,name", limit: "1" } });
      businessId = biz?.data?.[0]?.id ?? null;
      businessName = biz?.data?.[0]?.name ?? null;
    } catch (_) { /* business_management may not be granted */ }

    const pages = await graph("/me/accounts", {
      token: userToken,
      params: {
        fields: "id,name,category,access_token,picture{url}",
        limit: "100",
      },
    });

    let adAccounts: any = { data: [] };
    try {
      adAccounts = await graph("/me/adaccounts", {
        token: userToken,
        params: { fields: "id,account_id,name,currency,timezone_name,account_status", limit: "100" },
      });
    } catch (_) { /* ads scopes may not be granted */ }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // single active Meta connection per app
    await supabase.from("social_connections").delete().eq("platform", "meta");

    const { data: conn, error: connErr } = await supabase
      .from("social_connections")
      .insert({
        platform: "meta",
        external_user_id: me.id,
        external_user_name: me.name,
        business_id: businessId,
        business_name: businessName,
        access_token_enc: await encryptSecret(userToken),
        token_expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
        status: "connected",
        last_synced_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (connErr) throw new Error(connErr.message);

    const pageRows = [] as Record<string, unknown>[];
    for (const p of pages?.data || []) {
      // Instagram Business Account is resolved per-Page (not via Facebook Login scopes)
      let igId: string | null = null;
      let igUsername: string | null = null;
      try {
        const igRes = await graph(`/${p.id}`, {
          token: p.access_token || userToken,
          params: { fields: "instagram_business_account{id,username}" },
        });
        igId = igRes?.instagram_business_account?.id ?? null;
        igUsername = igRes?.instagram_business_account?.username ?? null;
      } catch (_) { /* page may have no linked IG business account */ }

      pageRows.push({
        connection_id: conn.id,
        page_id: p.id,
        page_name: p.name,
        category: p.category ?? null,
        picture_url: p.picture?.data?.url ?? null,
        page_token_enc: p.access_token ? await encryptSecret(p.access_token) : null,
        instagram_id: igId,
        instagram_username: igUsername,
      });
    }
    if (pageRows.length) await supabase.from("social_pages").insert(pageRows);

    const acctRows = (adAccounts?.data || []).map((a: any) => ({
      connection_id: conn.id,
      ad_account_id: a.id,
      name: a.name,
      currency: a.currency,
      timezone_name: a.timezone_name,
      account_status: String(a.account_status ?? ""),
    }));
    if (acctRows.length) await supabase.from("social_ad_accounts").insert(acctRows);

    return closingPage({ ok: true, connection_id: conn.id });
  } catch (e) {
    console.error("meta-oauth-callback failed:", (e as Error).message);
    return closingPage({ ok: false, error: (e as Error).message });
  }
});