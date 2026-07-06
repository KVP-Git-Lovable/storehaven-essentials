import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-email-event-webhook-signature, x-twilio-email-event-webhook-timestamp",
};

// SendGrid Event Webhook signature verification (ECDSA P-256, SHA-256, base64).
async function verifySignature(publicKeyPem: string, payload: string, signatureB64: string): Promise<boolean> {
  try {
    const pem = publicKeyPem
      .replace(/-----BEGIN PUBLIC KEY-----/g, "")
      .replace(/-----END PUBLIC KEY-----/g, "")
      .replace(/\s+/g, "");
    const bin = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      "spki",
      bin,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    // SendGrid ships DER-encoded signature; convert to raw r||s for WebCrypto.
    const der = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
    const raw = derToRaw(der);
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      raw,
      new TextEncoder().encode(payload),
    );
  } catch (e) {
    console.error("verifySignature error:", e);
    return false;
  }
}

function derToRaw(der: Uint8Array): Uint8Array {
  // DER: 0x30 len 0x02 lenR R 0x02 lenS S
  let i = 2;
  if (der[i++] !== 0x02) throw new Error("bad DER");
  const rLen = der[i++];
  let r = der.slice(i, i + rLen);
  i += rLen;
  if (der[i++] !== 0x02) throw new Error("bad DER");
  const sLen = der[i++];
  let s = der.slice(i, i + sLen);
  const pad = (buf: Uint8Array) => {
    if (buf.length > 32) buf = buf.slice(buf.length - 32);
    if (buf.length < 32) {
      const p = new Uint8Array(32);
      p.set(buf, 32 - buf.length);
      return p;
    }
    return buf;
  };
  r = pad(r);
  s = pad(s);
  const out = new Uint8Array(64);
  out.set(r, 0);
  out.set(s, 32);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const publicKey = Deno.env.get("SENDGRID_WEBHOOK_PUBLIC_KEY");
  const rawBody = await req.text();

  if (publicKey) {
    const sig = req.headers.get("x-twilio-email-event-webhook-signature") || "";
    const ts = req.headers.get("x-twilio-email-event-webhook-timestamp") || "";
    const signed = `${ts}${rawBody}`;
    const ok = sig && ts && await verifySignature(publicKey, signed, sig);
    if (!ok) {
      console.warn("SendGrid webhook signature failed");
      return new Response("invalid signature", { status: 401, headers: corsHeaders });
    }
  } else {
    console.warn("SendGrid webhook signature verification disabled.");
  }

  let events: any[] = [];
  try {
    events = JSON.parse(rawBody);
    if (!Array.isArray(events)) events = [events];
  } catch {
    return new Response("bad json", { status: 400, headers: corsHeaders });
  }

  console.log(`SendGrid webhook received: ${events.length} events`);

  const SUPPORTED = new Set([
    "processed","delivered","open","click","bounce","dropped",
    "deferred","spamreport","unsubscribe","group_unsubscribe",
  ]);
  let ignored = 0;
  let failed = 0;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Map events to rows. campaign_id may arrive in `custom_args.campaign_id` (set by Single Send category or query).
  // If not present, we fall back to lookup by SG single_send_id when available.
  const eventRows: any[] = [];
  const counterUpdates: Record<string, Record<string, number>> = {};
  const suppressionRows: any[] = [];

  const bump = (cid: string, col: string, n = 1) => {
    if (!cid) return;
    counterUpdates[cid] = counterUpdates[cid] || {};
    counterUpdates[cid][col] = (counterUpdates[cid][col] || 0) + n;
  };

  // Preload map of single_send_id -> campaign_id
  const ssIds = Array.from(new Set(events.map((e) => e.singlesend_id || e.sg_singlesend_id).filter(Boolean)));
  let ssToCampaign = new Map<string, string>();
  if (ssIds.length) {
    const { data } = await supabase.from("email_marketing_campaigns").select("id, sendgrid_single_send_id").in("sendgrid_single_send_id", ssIds);
    ssToCampaign = new Map((data || []).map((r: any) => [r.sendgrid_single_send_id, r.id]));
  }

  for (const ev of events) {
    try {
      const type = String(ev.event || "").toLowerCase();
      if (!SUPPORTED.has(type)) { ignored++; continue; }

      const cid = ev.campaign_id
        || ev.custom_args?.campaign_id
        || ssToCampaign.get(ev.singlesend_id || ev.sg_singlesend_id)
        || null;
      const email = String(ev.email || "").toLowerCase();

      eventRows.push({
        campaign_id: cid,
        recipient_email: email,
        event_type: type,
        url: ev.url || null,
        reason: ev.reason || ev.response || null,
        sg_event_id: ev.sg_event_id || null,
        sg_message_id: ev.sg_message_id || null,
        event_timestamp: ev.timestamp ? new Date(ev.timestamp * 1000).toISOString() : new Date().toISOString(),
        raw: ev,
      });

      // Counters bumped only for freshly-inserted rows (see dedup step below).
      if (email && (type === "bounce" || type === "spamreport" || type === "unsubscribe" || type === "group_unsubscribe" || type === "dropped")) {
        suppressionRows.push({ email, reason: type, campaign_id: cid });
      }
    } catch (err) {
      failed++;
      console.error("event processing failed:", err);
    }
  }

  // Bulk insert events (idempotent via sg_event_id unique). Track which rows were
  // actually inserted so counters don't double count on SendGrid retries.
  let duplicates = 0;
  const insertedRows: any[] = [];
  const withId = eventRows.filter((r) => r.sg_event_id);
  const noId = eventRows.filter((r) => !r.sg_event_id);
  if (withId.length) {
    const { data, error } = await supabase
      .from("email_marketing_events")
      .upsert(withId, { onConflict: "sg_event_id", ignoreDuplicates: true })
      .select("sg_event_id");
    if (error) console.error("event upsert error:", error.message);
    const insertedIds = new Set((data || []).map((r: any) => r.sg_event_id));
    duplicates = withId.length - insertedIds.size;
    for (const r of withId) if (insertedIds.has(r.sg_event_id)) insertedRows.push(r);
  }
  if (noId.length) {
    const { error } = await supabase.from("email_marketing_events").insert(noId);
    if (error) console.error("event insert (no id) error:", error.message);
    else insertedRows.push(...noId);
  }

  // Bump counters only for newly inserted events.
  for (const r of insertedRows) {
    if (!r.campaign_id) continue;
    switch (r.event_type) {
      case "processed": bump(r.campaign_id, "processed_count"); bump(r.campaign_id, "sent_count"); break;
      case "delivered": bump(r.campaign_id, "delivered_count"); break;
      case "open": bump(r.campaign_id, "open_count"); break;
      case "click": bump(r.campaign_id, "click_count"); break;
      case "bounce": bump(r.campaign_id, "bounce_count"); break;
      case "dropped": bump(r.campaign_id, "dropped_count"); break;
      case "spamreport": bump(r.campaign_id, "spam_count"); break;
      case "unsubscribe":
      case "group_unsubscribe": bump(r.campaign_id, "unsubscribe_count"); break;
    }
  }

  // Apply counters
  for (const [cid, cols] of Object.entries(counterUpdates)) {
    const patch: Record<string, any> = {};
    // Fetch current counters then increment (no rpc dependency)
    const { data, error } = await supabase.from("email_marketing_campaigns").select(Object.keys(cols).join(",")).eq("id", cid).maybeSingle();
    if (error) { console.error("counter fetch error:", error.message); continue; }
    if (data) {
      for (const [k, v] of Object.entries(cols)) patch[k] = (Number((data as any)[k]) || 0) + v;
      const { error: uErr } = await supabase.from("email_marketing_campaigns").update(patch).eq("id", cid);
      if (uErr) console.error("counter update error:", uErr.message);
    }
  }

  if (suppressionRows.length) {
    const { error } = await supabase.from("email_marketing_suppressions").upsert(suppressionRows, { onConflict: "email", ignoreDuplicates: true });
    if (error) console.error("suppression upsert error:", error.message);
  }

  const processed = insertedRows.length;
  console.log(`SendGrid webhook done: processed=${processed} duplicates=${duplicates} ignored=${ignored} failed=${failed}`);

  return new Response(JSON.stringify({ success: true, processed, duplicates, ignored }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
