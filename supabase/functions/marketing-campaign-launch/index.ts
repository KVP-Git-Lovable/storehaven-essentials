import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { wrapMarketingEmail, htmlToText, loadCompanyFooter, buildUnsubscribeToken } from "../_shared/marketing-email-shell.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SG = "https://api.sendgrid.com/v3";

function normalizeEmail(e: unknown): string | null {
  if (typeof e !== "string") return null;
  const v = e.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v;
}

async function resolveSegmentEmails(supabase: any, segment: any): Promise<Array<{ email: string; first_name?: string; last_name?: string; contact_ref: any }>> {
  if (!segment?.list_view_id) return [];
  const res = await supabase.functions.invoke("list-view-resolve", {
    body: { list_view_id: segment.list_view_id, mode: "rows" },
  });
  if (res.error) throw new Error(`list-view-resolve error: ${res.error.message || String(res.error)}`);
  const data = res.data as any;
  if (!data || data.error) throw new Error(data?.error || "list-view-resolve failed");

  const entity = data.entity_type;
  const rows: any[] = data.rows || [];
  const out: Array<{ email: string; first_name?: string; last_name?: string; contact_ref: any }> = [];

  if (entity === "customers" || entity === "leads") {
    for (const r of rows) {
      const em = normalizeEmail(r.email);
      if (!em) continue;
      const [first, ...rest] = String(r.name || "").split(" ");
      out.push({
        email: em,
        first_name: first || undefined,
        last_name: rest.join(" ") || undefined,
        contact_ref: { entity_type: entity, entity_id: r.id },
      });
    }
  } else if (entity === "orders") {
    // Hydrate customers via customer_id
    const ids = Array.from(new Set(rows.map((r: any) => r.customer_id).filter(Boolean)));
    if (ids.length) {
      const { data: custs } = await supabase.from("customers").select("id, email, name").in("id", ids);
      for (const c of custs || []) {
        const em = normalizeEmail(c.email);
        if (!em) continue;
        const [first, ...rest] = String(c.name || "").split(" ");
        out.push({
          email: em,
          first_name: first || undefined,
          last_name: rest.join(" ") || undefined,
          contact_ref: { entity_type: "customers", entity_id: c.id },
        });
      }
    }
  }
  return out;
}

function combineSegments(a: any[], b: any[], combinator: string, primary: string): any[] {
  const key = (x: any) => x.email;
  const setA = new Map(a.map((x) => [key(x), x]));
  const setB = new Map(b.map((x) => [key(x), x]));
  switch (combinator) {
    case "intersection":
      return [...setA.values()].filter((x) => setB.has(key(x)));
    case "difference":
      return primary === "B"
        ? [...setB.values()].filter((x) => !setA.has(key(x)))
        : [...setA.values()].filter((x) => !setB.has(key(x)));
    case "only_a":
      return [...setA.values()];
    case "only_b":
      return [...setB.values()];
    case "union":
    default: {
      const m = new Map(setA);
      for (const [k, v] of setB) if (!m.has(k)) m.set(k, v);
      return [...m.values()];
    }
  }
}

async function sgFetch(path: string, init: RequestInit, key: string): Promise<{ ok: boolean; status: number; json: any; text: string }> {
  const res = await fetch(`${SG}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
  return { ok: res.ok, status: res.status, json, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("SENDGRID_API_KEY");
    if (!key) throw new Error("SENDGRID_API_KEY is not configured");
    const unsubSecret = Deno.env.get("MARKETING_UNSUB_SECRET");
    if (!unsubSecret) throw new Error("MARKETING_UNSUB_SECRET is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { campaign_id, send_now, scheduled_at, app_base_url } = body as {
      campaign_id: string;
      send_now?: boolean;
      scheduled_at?: string | null;
      app_base_url?: string;
    };
    if (!campaign_id) throw new Error("campaign_id required");

    // Load campaign
    const { data: c, error: cErr } = await supabase
      .from("email_marketing_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!c) throw new Error("Campaign not found");
    if (c.status !== "draft" && c.status !== "failed" && c.status !== "paused") {
      throw new Error(`Campaign is already ${c.status}`);
    }

    // Resolve audience
    const audience = c.audience_config || { segments: [], combinator: "union" };
    const segments = audience.segments || [];
    if (!segments.length) throw new Error("Audience is empty");

    const resolved: any[][] = [];
    for (const seg of segments) {
      const rows = await resolveSegmentEmails(supabase, seg);
      resolved.push(rows);
    }
    let combined = resolved[0] || [];
    if (resolved.length > 1) {
      combined = combineSegments(resolved[0], resolved[1], audience.combinator || "union", audience.primary || "A");
    }

    // Filter suppressions
    if (combined.length) {
      const emails = combined.map((x) => x.email);
      const { data: sup } = await supabase
        .from("email_marketing_suppressions")
        .select("email")
        .in("email", emails);
      const supSet = new Set((sup || []).map((s: any) => s.email));
      combined = combined.filter((x) => !supSet.has(x.email));
    }

    if (!combined.length) throw new Error("Audience resolved to 0 sendable recipients after suppressions");

    // Upsert recipients locally
    const recipientRows = combined.map((r) => ({
      campaign_id,
      email: r.email,
      contact_ref: r.contact_ref,
      merge_vars: { first_name: r.first_name || "", last_name: r.last_name || "" },
    }));
    // chunked upsert
    for (let i = 0; i < recipientRows.length; i += 1000) {
      const chunk = recipientRows.slice(i, i + 1000);
      const { error } = await supabase
        .from("email_marketing_recipients")
        .upsert(chunk, { onConflict: "campaign_id,email", ignoreDuplicates: true });
      if (error) throw error;
    }

    // Create SendGrid list
    let listId = c.sendgrid_list_id as string | null;
    if (!listId) {
      const listName = `crm-campaign-${campaign_id.slice(0, 8)}-${Date.now()}`;
      const listRes = await sgFetch(`/marketing/lists`, {
        method: "POST",
        body: JSON.stringify({ name: listName }),
      }, key);
      if (!listRes.ok) throw new Error(`Create list failed [${listRes.status}]: ${listRes.text}`);
      listId = listRes.json?.id;
      await supabase.from("email_marketing_campaigns").update({ sendgrid_list_id: listId }).eq("id", campaign_id);
    }

    // Import contacts (async)
    const contacts = combined.map((r) => ({
      email: r.email,
      first_name: r.first_name || undefined,
      last_name: r.last_name || undefined,
    }));
    let importJobId: string | null = null;
    // SendGrid limit: 30k contacts per import. Chunk.
    for (let i = 0; i < contacts.length; i += 15000) {
      const chunk = contacts.slice(i, i + 15000);
      const impRes = await sgFetch(`/marketing/contacts`, {
        method: "PUT",
        body: JSON.stringify({ list_ids: [listId], contacts: chunk }),
      }, key);
      if (!impRes.ok) throw new Error(`Contact import failed [${impRes.status}]: ${impRes.text}`);
      importJobId = impRes.json?.job_id || importJobId;
    }
    if (importJobId) {
      await supabase.from("email_marketing_campaigns").update({ sendgrid_import_job_id: importJobId }).eq("id", campaign_id);
    }

    // Build inlined HTML with SendGrid substitution tokens; use [unsubscribe] link via SG substitution.
    const company = await loadCompanyFooter(supabase);
    const baseUrl = app_base_url || "https://jewellery.quickapp.ai";
    // For SendGrid single sends, use a per-recipient substitution: -unsub_url- rendered via HTTP link with token.
    // Since we can't per-recipient sign inside a single-send, we point to an app endpoint that accepts raw email query.
    // Use a Marketing-safe fallback: link with campaign token + [email] substitution.
    const unsubscribeUrl = `${baseUrl}/unsubscribe?c=${encodeURIComponent(campaign_id)}&e={{ insert email }}`;
    const fullHtml = wrapMarketingEmail({
      html: c.html || "<p>(empty)</p>",
      previewText: c.preview_text,
      subject: c.subject,
      company,
      unsubscribeUrl: unsubscribeUrl,
      showUnsubscribe: true,
    });
    const plainText = htmlToText(fullHtml);

    // Create Single Send
    let singleSendId = c.sendgrid_single_send_id as string | null;
    const singleSendBody: any = {
      name: `${c.name} (${campaign_id.slice(0, 8)})`,
      send_to: { list_ids: [listId] },
      email_config: {
        subject: c.subject,
        html_content: fullHtml,
        plain_content: plainText,
        sender_id: undefined as any, // must be set via API - we look up first verified sender if not stored
        suppression_group_id: null,
        custom_unsubscribe_url: `${baseUrl}/unsubscribe?c=${encodeURIComponent(campaign_id)}`,
      },
    };

    // Look up verified sender by from_email to obtain numeric sender_id
    const sendersRes = await sgFetch(`/verified_senders`, { method: "GET" }, key);
    const sender = (sendersRes.json?.results || []).find((s: any) => (s.from_email || "").toLowerCase() === (c.from_email || "").toLowerCase());
    if (!sender) throw new Error(`No verified SendGrid sender for ${c.from_email}. Verify this address in SendGrid first.`);
    singleSendBody.email_config.sender_id = Number(sender.id);

    if (!singleSendId) {
      const ssRes = await sgFetch(`/marketing/singlesends`, { method: "POST", body: JSON.stringify(singleSendBody) }, key);
      if (!ssRes.ok) throw new Error(`Create Single Send failed [${ssRes.status}]: ${ssRes.text}`);
      singleSendId = ssRes.json?.id;
      await supabase.from("email_marketing_campaigns").update({ sendgrid_single_send_id: singleSendId }).eq("id", campaign_id);
    } else {
      await sgFetch(`/marketing/singlesends/${singleSendId}`, { method: "PATCH", body: JSON.stringify(singleSendBody) }, key);
    }

    // Schedule
    const sendAt = send_now ? "now" : scheduled_at;
    if (!sendAt) throw new Error("Provide send_now=true or scheduled_at");
    const schedRes = await sgFetch(`/marketing/singlesends/${singleSendId}/schedule`, {
      method: "PUT",
      body: JSON.stringify({ send_at: sendAt }),
    }, key);
    if (!schedRes.ok) throw new Error(`Schedule Single Send failed [${schedRes.status}]: ${schedRes.text}`);

    await supabase.from("email_marketing_campaigns").update({
      status: send_now ? "sending" : "scheduled",
      scheduled_at: send_now ? new Date().toISOString() : scheduled_at,
      audience_snapshot_count: combined.length,
      last_error: null,
    }).eq("id", campaign_id);

    return new Response(JSON.stringify({
      success: true,
      audience_count: combined.length,
      sendgrid_single_send_id: singleSendId,
      sendgrid_list_id: listId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = (err as Error).message || String(err);
    try {
      const b = await req.clone().json().catch(() => null);
      if (b?.campaign_id) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabase.from("email_marketing_campaigns").update({ status: "failed", last_error: msg }).eq("id", b.campaign_id);
      }
    } catch { /* swallow */ }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
