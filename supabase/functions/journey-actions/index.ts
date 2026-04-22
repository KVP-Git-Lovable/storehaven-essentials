import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ENTITIES: Record<string, { table: string; isAudienceSource: boolean; contactKey?: string }> = {
  customers: { table: "customers", isAudienceSource: true, contactKey: "phone" },
  orders: { table: "orders", isAudienceSource: true, contactKey: "customer_id" },
  revenue: { table: "orders", isAudienceSource: false },
  products: { table: "products", isAudienceSource: false },
  items: { table: "inventory_items", isAudienceSource: false },
  schemes: { table: "pos_schemes", isAudienceSource: false },
};

function applyFilter(q: any, cond: any) {
  const { field, operator, value } = cond;
  switch (operator) {
    case "eq": return q.eq(field, value);
    case "neq": return q.neq(field, value);
    case "gt": return q.gt(field, value);
    case "gte": return q.gte(field, value);
    case "lt": return q.lt(field, value);
    case "lte": return q.lte(field, value);
    case "ilike": return q.ilike(field, `%${value}%`);
    case "starts_with": return q.ilike(field, `${value}%`);
    case "is_null": return q.is(field, null);
    case "is_not_null": return q.not(field, "is", null);
    case "is_true": return q.eq(field, true);
    case "is_false": return q.eq(field, false);
    case "last_n_days": {
      const days = Number(value) || 0;
      return q.gte(field, new Date(Date.now() - days * 86400000).toISOString());
    }
    default: return q;
  }
}

function normalizeE164(raw: string | null | undefined, defaultCc = "91"): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (s.startsWith("+")) {
    const digits = s.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : null;
  }
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  // Heuristic: if length > 10 assume already includes country code
  if (digits.length > 10) return `+${digits}`;
  return `+${defaultCc}${digits}`;
}

type UpsertResult = {
  contactIds: string[];
  matched: number;
  skipped: number;
  firstError?: string;
};

async function upsertContactsFromCustomers(supabase: any, customers: any[]): Promise<UpsertResult> {
  // Deduplicate by normalized phone
  const byPhone = new Map<string, any>();
  let invalidPhoneCount = 0;
  for (const c of customers) {
    const phone = normalizeE164(c.phone);
    if (!phone) {
      invalidPhoneCount++;
      continue;
    }
    if (!byPhone.has(phone)) byPhone.set(phone, { ...c, _phone: phone });
  }
  const matched = byPhone.size;
  if (matched === 0) {
    return {
      contactIds: [],
      matched: 0,
      skipped: invalidPhoneCount,
      firstError: invalidPhoneCount > 0 ? "All matched customers had invalid/missing phone numbers" : undefined,
    };
  }

  const phones = Array.from(byPhone.keys());
  let firstError: string | undefined;
  let skipped = invalidPhoneCount;

  // Fetch existing (with error logging)
  const { data: existing, error: selErr } = await supabase
    .from("journey_contacts")
    .select("id, phone")
    .in("phone", phones);
  if (selErr) {
    console.error("[journey-actions] select journey_contacts failed:", selErr);
    throw new Error(`Failed to read journey_contacts: ${selErr.message}`);
  }
  const existingByPhone = new Map<string, string>();
  for (const e of existing || []) existingByPhone.set(e.phone, e.id);

  // Insert missing rows ONE-AT-A-TIME so a single bad row doesn't drop the batch
  for (const p of phones) {
    if (existingByPhone.has(p)) continue;
    const c = byPhone.get(p)!;
    const digits = p.replace(/\D/g, "");
    const row = {
      phone: p,
      name: (typeof c.name === "string" && c.name.trim()) ? c.name.trim() : "Customer",
      email: (typeof c.email === "string" && c.email.trim()) ? c.email.trim() : `journey+${digits}@noemail.local`,
      date_of_birth: c.date_of_birth || null,
      segment_type: c.customer_segment || "customer",
      opted_out: false,
    };
    try {
      const { data: ins, error: insErr } = await supabase
        .from("journey_contacts")
        .insert(row)
        .select("id, phone")
        .single();
      if (insErr) {
        console.error(`[journey-actions] insert journey_contacts failed for ${p}:`, insErr);
        if (!firstError) firstError = `${p}: ${insErr.message}`;
        skipped++;
        continue;
      }
      if (ins?.id) existingByPhone.set(ins.phone, ins.id);
    } catch (e: any) {
      console.error(`[journey-actions] insert exception for ${p}:`, e);
      if (!firstError) firstError = `${p}: ${e?.message || String(e)}`;
      skipped++;
    }
  }

  // Re-fetch by phone to be safe (covers races + concurrent inserts)
  const { data: refetched, error: refErr } = await supabase
    .from("journey_contacts")
    .select("id, phone, opted_out")
    .in("phone", phones);
  if (refErr) {
    console.error("[journey-actions] refetch journey_contacts failed:", refErr);
    throw new Error(`Failed to refetch journey_contacts: ${refErr.message}`);
  }
  const finalIds: string[] = [];
  const seen = new Set<string>();
  for (const r of refetched || []) {
    if (r.opted_out) continue;
    if (seen.has(r.phone)) continue;
    seen.add(r.phone);
    finalIds.push(r.id);
  }

  return {
    contactIds: finalIds,
    matched,
    skipped,
    firstError,
  };
}

async function resolveListViewContacts(supabase: any, listViewId: string): Promise<{ contactIds: string[]; matched: number; skipped: number; firstError?: string; warning?: string }> {
  const { data: lv, error: lvErr } = await supabase
    .from("list_views")
    .select("entity_type, selected_fields, filters")
    .eq("id", listViewId)
    .maybeSingle();
  if (lvErr) throw lvErr;
  if (!lv) throw new Error("List view not found");

  const entity = ALLOWED_ENTITIES[lv.entity_type];
  if (!entity) throw new Error(`Invalid entity: ${lv.entity_type}`);
  if (!entity.isAudienceSource) {
    throw new Error("Selected list view's entity isn't an audience source. Use a Customers or Orders view.");
  }

  let q = supabase.from(entity.table).select("*");
  for (const cond of lv.filters || []) q = applyFilter(q, cond);
  q = q.limit(10000);
  const { data: rows, error } = await q;
  if (error) throw error;

  if (lv.entity_type === "customers") {
    const res = await upsertContactsFromCustomers(supabase, rows || []);
    return {
      contactIds: res.contactIds,
      matched: res.matched,
      skipped: res.skipped,
      firstError: res.firstError,
      warning: res.contactIds.length === 0 ? "No customers enrolled" : undefined,
    };
  }

  if (lv.entity_type === "orders") {
    const customerIds = Array.from(new Set((rows || []).map((r: any) => r.customer_id).filter(Boolean)));
    if (customerIds.length === 0) return { contactIds: [], matched: 0, skipped: 0, warning: "No orders with customers matched" };
    const { data: customers, error: cErr } = await supabase
      .from("customers")
      .select("*")
      .in("id", customerIds);
    if (cErr) throw cErr;
    const res = await upsertContactsFromCustomers(supabase, customers || []);
    return {
      contactIds: res.contactIds,
      matched: res.matched,
      skipped: res.skipped,
      firstError: res.firstError,
    };
  }

  return { contactIds: [], matched: 0, skipped: 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action, journey_id, contact_id, event_type, event_data } = await req.json();

    if (action === "activate") {
      const { data: journey, error: jErr } = await supabase
        .from("journeys").select("*").eq("id", journey_id).single();
      if (jErr) throw jErr;

      let contactIds: string[] = [];
      let matched = 0;
      let skipped = 0;
      let firstError: string | undefined;

      if (journey.list_view_id) {
        const { data: lv, error: lvErr } = await supabase
          .from("list_views").select("entity_type, name").eq("id", journey.list_view_id).maybeSingle();
        if (lvErr) throw lvErr;
        if (!lv) throw new Error("Linked list view not found");
        const cfg = ALLOWED_ENTITIES[lv.entity_type];
        if (!cfg || !cfg.isAudienceSource) {
          throw new Error(`List view "${lv.name}" uses entity "${lv.entity_type}" which is not an audience source. Use a Customers or Orders list view.`);
        }

        // Clear stale enrollments so dynamic filters re-evaluate fresh.
        await supabase
          .from("journey_enrollments")
          .delete()
          .eq("journey_id", journey_id)
          .in("status", ["active", "paused", "failed"]);

        const result = await resolveListViewContacts(supabase, journey.list_view_id);
        contactIds = result.contactIds;
        matched = result.matched;
        skipped = result.skipped;
        firstError = result.firstError;
      } else {
        let query = supabase.from("journey_contacts").select("id").eq("opted_out", false);
        if (journey.segment_type) query = query.eq("segment_type", journey.segment_type);
        const filters = journey.filters as any;
        if (filters?.city) query = query.eq("city", filters.city);
        const { data: contacts, error: cErr } = await query;
        if (cErr) throw cErr;
        contactIds = (contacts || []).map((c: any) => c.id);
        matched = contactIds.length;
      }

      const canvas = journey.canvas_data as any;
      const entryNode = canvas?.nodes?.find((n: any) => n.type === "entry");
      const firstNodeId = entryNode?.id || canvas?.nodes?.[0]?.id;

      if (contactIds.length > 0) {
        const enrollments = contactIds.map((cid) => ({
          journey_id,
          contact_id: cid,
          current_node_id: firstNodeId,
          status: "active",
          next_action_at: new Date().toISOString(),
        }));
        const { error: enrErr } = await supabase.from("journey_enrollments").insert(enrollments);
        if (enrErr) {
          console.error("[journey-actions] insert journey_enrollments failed:", enrErr);
          throw new Error(`Failed to enroll contacts: ${enrErr.message}`);
        }
      }

      await supabase.from("journeys").update({ status: "active" }).eq("id", journey_id);

      return new Response(JSON.stringify({
        success: true,
        enrolled: contactIds.length,
        matched,
        skipped,
        reason: firstError,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "pause") {
      await supabase.from("journeys").update({ status: "paused" }).eq("id", journey_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "record-event") {
      if (!contact_id || !event_type) {
        return new Response(JSON.stringify({ error: "contact_id and event_type required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("journey_contact_events").insert({
        contact_id, event_type, event_data: event_data || {},
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
