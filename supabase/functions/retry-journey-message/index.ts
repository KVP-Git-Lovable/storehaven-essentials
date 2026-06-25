import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import {
  TOKEN_SOURCES,
  ENRICHABLE_TOKENS,
  needsCustomerJoin,
  needsOrderJoin,
  readSourceField,
} from "../_shared/variable-registry.ts";

/**
 * Re-send a single failed journey WhatsApp message (typically rate-limited).
 * Body: { message_log_id: string }
 *
 * This function deliberately mirrors the template-mode send path inside
 * process-journeys/index.ts so a retry behaves identically to the original
 * send. The client orchestrates pacing (one call per 45s) when retrying many.
 */

function getNested(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function collectTokensFromSources(sources: Iterable<any>): Set<string> {
  const out = new Set<string>();
  const tokenRe = /\{\{?\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}?\}/g;
  for (const src of sources) {
    if (src == null) continue;
    const s = String(src);
    let m: RegExpExecArray | null;
    tokenRe.lastIndex = 0;
    while ((m = tokenRe.exec(s)) !== null) out.add(m[1]);
    const bare = s.trim();
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(bare)) out.add(bare);
  }
  return out;
}

async function enrichContact(supabase: any, contact: any, tokens: Set<string>): Promise<void> {
  if (!contact) return;
  if (!needsCustomerJoin(tokens)) return;
  const metadata = (contact.metadata && typeof contact.metadata === "object") ? contact.metadata : {};
  contact.metadata = metadata;
  let customer: any = null;
  const phone = contact.phone ? String(contact.phone).replace(/\D/g, "") : "";
  const last10 = phone ? phone.slice(-10) : "";
  try {
    if (last10) {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .or(`phone.ilike.%${last10},phone.eq.${last10}`)
        .limit(1);
      if (data && data.length) customer = data[0];
    }
  } catch (e) { console.error("[retry] customer lookup failed", e); }

  let lastOrder: any = null;
  if (needsOrderJoin(tokens) && customer?.id) {
    try {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, status, total_amount, tax_amount, discount_amount, created_at")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(1);
      lastOrder = (orders && orders[0]) || null;
    } catch (e) { console.error("[retry] order lookup failed", e); }
  }

  for (const token of tokens) {
    if (!ENRICHABLE_TOKENS.has(token)) continue;
    if (metadata[token] != null && metadata[token] !== "") continue;
    const src = TOKEN_SOURCES[token];
    if (!src) continue;
    const row = src.kind === "last_order" ? lastOrder : customer;
    const val = readSourceField(row, src);
    if (val !== "") metadata[token] = val;
  }
}

function resolveContactPath(contact: any, rawPath: string): string {
  if (!contact) return "";
  let path = rawPath.startsWith("contact.") ? rawPath.slice("contact.".length) : rawPath;
  const registeredSource = TOKEN_SOURCES[path];
  if (registeredSource) {
    if (registeredSource.kind === "contact") return readSourceField(contact, registeredSource);
    const fromMetadata = getNested(contact.metadata, path);
    if (fromMetadata != null && fromMetadata !== "") return String(fromMetadata);
  }
  if (path === "name") {
    const n = contact.name;
    if (n != null && String(n).trim()) return String(n);
    const meta = getNested(contact.metadata, "name");
    return meta == null ? "" : String(meta);
  }
  if (path === "customer_dob" || path === "dob" || path === "birthday" || path === "date_of_birth") {
    const raw = contact.date_of_birth
      ?? getNested(contact.metadata, "date_of_birth")
      ?? getNested(contact.metadata, "customer_dob")
      ?? getNested(contact.metadata, "dob");
    if (raw == null || raw === "") return "";
    const d = new Date(String(raw));
    if (!isNaN(d.getTime())) {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${dd} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    }
    return String(raw);
  }
  const direct = getNested(contact, path);
  if (direct != null && direct !== "") return String(direct);
  if (path.startsWith("metadata.")) {
    const v = getNested(contact, path);
    return v == null ? "" : String(v);
  }
  const metaVal = getNested(contact.metadata, path);
  return metaVal == null ? "" : String(metaVal);
}

function resolveVariables(
  mapping: Record<string, string> | undefined,
  contact: any,
  numericToFriendly?: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!mapping || typeof mapping !== "object") return out;
  const tryResolve = (source: any): string => {
    if (source == null) return "";
    if (typeof source !== "string") return String(source);
    const hasDoubleBrace = /\{\{[^}]+\}\}/.test(source);
    const hasSingleBrace = /\{[^{}]+\}/.test(source);
    let resolved: string;
    if (hasDoubleBrace || hasSingleBrace) {
      resolved = source.replace(/\{\{([^}]+)\}\}/g, (_m, inner) => resolveContactPath(contact, inner.trim()));
      resolved = resolved.replace(/\{([^{}]+)\}/g, (_m, inner) => resolveContactPath(contact, inner.trim()));
    } else {
      resolved = resolveContactPath(contact, source);
    }
    return resolved || "";
  };
  for (const [key, source] of Object.entries(mapping)) {
    let resolved = tryResolve(source);
    const isNumericKey = /^\d+$/.test(key);
    if (isNumericKey && numericToFriendly?.[key]) {
      const friendlyKey = numericToFriendly[key];
      if (mapping[friendlyKey] != null) {
        const fromFriendly = tryResolve(mapping[friendlyKey]);
        if (fromFriendly && fromFriendly.trim()) resolved = fromFriendly;
        else if (!resolved || !resolved.trim()) {
          const direct = resolveContactPath(contact, friendlyKey);
          if (direct && direct.trim()) resolved = direct;
        }
      }
    } else if (isNumericKey && (!resolved || !resolved.trim())) {
      const friendlyKey = numericToFriendly?.[key];
      if (friendlyKey && mapping[friendlyKey] != null) {
        const fromFriendly = tryResolve(mapping[friendlyKey]);
        if (fromFriendly && fromFriendly.trim()) resolved = fromFriendly;
        else {
          const direct = resolveContactPath(contact, friendlyKey);
          if (direct && direct.trim()) resolved = direct;
        }
      }
    }
    if (!resolved || !resolved.trim()) out[key] = key === "1" ? "Customer" : "";
    else out[key] = resolved;
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Auth: caller must be an authenticated user.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { message_log_id } = await req.json();
    if (!message_log_id) {
      return new Response(JSON.stringify({ error: "message_log_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: log, error: logErr } = await supabase
      .from("journey_message_log")
      .select("*")
      .eq("id", message_log_id)
      .maybeSingle();
    if (logErr || !log) {
      return new Response(JSON.stringify({ error: "Message log row not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (log.status !== "failed") {
      return new Response(JSON.stringify({ error: `Cannot retry — current status is '${log.status}'` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load journey (for canvas) and contact
    const [{ data: journey }, { data: contact }, { data: cfg }] = await Promise.all([
      supabase.from("journeys").select("id, canvas_data").eq("id", log.journey_id).maybeSingle(),
      supabase.from("journey_contacts").select("*").eq("id", log.contact_id).maybeSingle(),
      supabase.from("whatsapp_config").select("sender_number").limit(1).maybeSingle(),
    ]);
    if (!journey?.canvas_data) {
      return new Response(JSON.stringify({ error: "Journey canvas not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!contact?.phone) {
      return new Response(JSON.stringify({ error: "Contact phone missing" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const fromNumber = cfg?.sender_number;
    if (!fromNumber) {
      return new Response(JSON.stringify({ error: "No active WhatsApp sender configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const canvas: any = journey.canvas_data || {};
    const nodes: any[] = Array.isArray(canvas?.nodes) ? canvas.nodes : [];
    const node = nodes.find((n: any) => n.id === log.node_id);
    if (!node) {
      return new Response(JSON.stringify({ error: "Journey node not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = node.data || {};
    const templateId = data.whatsapp_template_id || log.template_id;
    const variablesMap: Record<string, string> = data.template_variables || {};
    if (!templateId) {
      return new Response(JSON.stringify({ error: "Node has no whatsapp_template_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read template's friendly mapping marker
    let numericToFriendly: Record<string, string> = {};
    try {
      const { data: tmplRow } = await supabase
        .from("whatsapp_templates").select("body").eq("id", templateId).maybeSingle();
      const body: string = tmplRow?.body || "";
      const m = body.match(/<!--vars:(\{[^}]*\})-->/);
      if (m) {
        const parsed = JSON.parse(m[1]);
        if (parsed && typeof parsed === "object") numericToFriendly = parsed;
      }
    } catch (_) {}

    // Enrich
    try {
      const sources: any[] = Object.values(variablesMap);
      for (const friendly of Object.values(numericToFriendly)) sources.push(friendly);
      const tokens = collectTokensFromSources(sources);
      await enrichContact(supabase, contact, tokens);
    } catch (e) { console.error("[retry] enrichContact failed", e); }

    const variables = resolveVariables(variablesMap, contact, numericToFriendly);
    if (!variables["1"]) variables["1"] = (contact?.name && String(contact.name).trim()) || "Customer";

    // Mark as sending
    await supabase.from("journey_message_log")
      .update({ status: "sending", error_message: null })
      .eq("id", log.id);

    let sendStatus = "failed";
    let sendAccepted = false;
    let errorMessage: string | null = null;
    let twilioSid: string | null = null;

    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Service-Key": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          template_id: templateId,
          to_number: contact.phone,
          from_number: fromNumber,
          variables,
          allow_user_initiated: false,
          internal_caller: "retry-journey-message",
          journey_enrollment_id: log.enrollment_id,
        }),
      });
      const result = await resp.json();
      if (!resp.ok || !result?.success) {
        throw new Error(result?.error || `whatsapp-send failed (${resp.status})`);
      }
      sendStatus = result.status || "queued";
      sendAccepted = ["accepted", "queued", "sending", "sent", "scheduled"].includes(sendStatus);
      twilioSid = result.twilio_message_sid || result.message_sid || null;
    } catch (e) {
      errorMessage = (e as Error).message;
      console.error("[retry] send failed:", errorMessage);
    }

    await supabase.from("journey_message_log")
      .update({
        status: sendStatus,
        delivery_status: sendAccepted ? "pending" : "failed",
        twilio_message_sid: twilioSid,
        error_message: errorMessage,
        template_body: JSON.stringify(variables),
        sent_at: sendAccepted ? new Date().toISOString() : log.sent_at,
      })
      .eq("id", log.id);

    return new Response(JSON.stringify({
      success: sendAccepted,
      status: sendStatus,
      twilio_message_sid: twilioSid,
      error: errorMessage,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[retry-journey-message] error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});