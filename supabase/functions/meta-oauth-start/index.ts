import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { META_SCOPES, GRAPH_VERSION } from "../_shared/meta-graph.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const appId = Deno.env.get("META_APP_ID");
    if (!appId) throw new Error("META_APP_ID is not configured");

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const origin: string = body.origin || req.headers.get("origin") || "";

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-oauth-callback`;
    const state = btoa(JSON.stringify({ origin, n: crypto.randomUUID() }));

    const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", META_SCOPES.join(","));

    return new Response(JSON.stringify({ auth_url: url.toString(), redirect_uri: redirectUri }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});