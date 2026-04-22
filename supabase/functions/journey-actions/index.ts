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

async function upsertContactsFromCustomers(supabase: any, customers: any[]): Promise<string[]> {
  // Deduplicate by normalized phone
  const byPhone = new Map<string, any>();
  for (const c of customers) {
    const phone = normalizeE164(c.phone);
    if (!phone) continue;
    if (!byPhone.has(phone)) byPhone.set(phone, { ...c, _phone: phone });
  }
  if (byPhone.size === 0) return [];

  const phones = Array.from(byPhone.keys());

  // Fetch existing
  const { data: existing } = await supabase
    .from("journey_contacts")
    .select("id, phone")
    .in("phone", phones);
  const existingByPhone = new Map<string, string>();
  for (const e of existing || []) existingByPhone.set(e.phone, e.id);

  // Insert any missing
  const toInsert = phones
    .filter((p) => !existingByPhone.has(p))
    .map((p) => {
      const c = byPhone.get(p)!;
      return {
        phone: p,
        name: c.name || "Customer",
        email: c.email || `${p.replace(/\D/g, "")}@noemail.local`,
        city: c.city || null,
        date_of_birth: c.date_of_birth || null,
        segment_type: c.customer_segment || "customer",
        opted_out: false,
      };
    });

  if (toInsert.length > 0) {
    const { data: inserted } = await supabase
      .from("journey_contacts")
      .insert(toInsert)
      .select("id, phone");
    for (const r of inserted || []) existingByPhone.set(r.phone, r.id);
  }

  // Filter out opted-out
  const allIds = phones.map((p) => existingByPhone.get(p)).filter(Boolean) as string[];
  if (allIds.length === 0) return [];
  const { data: active } = await supabase
    .from("journey_contacts")
    .select("id")
    .in("id", allIds)
    .eq("opted_out", false);
  return (active || []).map((r: any) => r.id);
}

async function resolveListViewContacts(supabase: any, listViewId: string): Promise<{ contactIds: string[]; warning?: string }> {
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
    const ids = await upsertContactsFromCustomers(supabase, rows || []);
    return { contactIds: ids, warning: ids.length === 0 ? "No customers matched" : undefined };
  }

  if (lv.entity_type === "orders") {
    const customerIds = Array.from(new Set((rows || []).map((r: any) => r.customer_id).filter(Boolean)));
    if (customerIds.length === 0) return { contactIds: [], warning: "No orders with customers matched" };
    const { data: customers } = await supabase
      .from("customers")
      .select("*")
      .in("id", customerIds);
    const ids = await upsertContactsFromCustomers(supabase, customers || []);
    return { contactIds: ids };
  }

  return { contactIds: [] };
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
      } else {
        let query = supabase.from("journey_contacts").select("id").eq("opted_out", false);
        if (journey.segment_type) query = query.eq("segment_type", journey.segment_type);
        const filters = journey.filters as any;
        if (filters?.city) query = query.eq("city", filters.city);
        const { data: contacts, error: cErr } = await query;
        if (cErr) throw cErr;
        contactIds = (contacts || []).map((c: any) => c.id);
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
        await supabase.from("journey_enrollments").insert(enrollments);
      }

      await supabase.from("journeys").update({ status: "active" }).eq("id", journey_id);

      return new Response(JSON.stringify({ success: true, enrolled: contactIds.length }), {
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
