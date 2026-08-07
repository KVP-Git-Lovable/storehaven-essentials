export const GRAPH_VERSION = "v21.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const META_SCOPES = [
  "public_profile",
  "email",
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "ads_management",
  "ads_read",
  "business_management",
];

export async function graph(
  path: string,
  opts: { token: string; method?: string; params?: Record<string, string>; body?: Record<string, unknown> } ,
) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [k, v] of Object.entries(opts.params || {})) url.searchParams.set(k, v);
  url.searchParams.set("access_token", opts.token);

  const init: RequestInit = { method: opts.method || "GET" };
  if (opts.body) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(opts.body);
  }

  const res = await fetch(url.toString(), init);
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok || json?.error) {
    const e = json?.error || {};
    const detail = [e.error_user_title, e.error_user_msg, e.error_data && JSON.stringify(e.error_data)]
      .filter(Boolean)
      .join(" — ");
    const msg = e.message || text;
    throw new Error(`[Meta ${res.status}] ${msg}${detail ? ` — ${detail}` : ""}`);
  }
  return json;
}