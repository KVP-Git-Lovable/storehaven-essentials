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

  // Fetch matching rows from the entity table
  let q = supabase.from(entity.table).select("*");
  for (const cond of lv.filters || []) q = applyFilter(q, cond);
  q = q.limit(10000);
  const { data: rows, error } = await q;
  if (error) throw error;

  // Map rows -> journey_contacts by phone (customers) or customer phone (orders)
  if (lv.entity_type === "customers") {
    const phones = (rows || []).map((r: any) => r.phone).filter(Boolean);
    if (phones.length === 0) return { contactIds: [], warning: "No customers matched" };
    const { data: contacts } = await supabase
      .from("journey_contacts")
      .select("id")
      .in("phone", phones)
      .eq("opted_out", false);
    return { contactIds: (contacts || []).map((c: any) => c.id) };
  }
  if (lv.entity_type === "orders") {
    const customerIds = Array.from(new Set((rows || []).map((r: any) => r.customer_id).filter(Boolean)));
    if (customerIds.length === 0) return { contactIds: [], warning: "No orders with customers matched" };
    const { data: customers } = await supabase
      .from("customers")
      .select("phone")
      .in("id", customerIds);
    const phones = (customers || []).map((c: any) => c.phone).filter(Boolean);
    if (phones.length === 0) return { contactIds: [] };
    const { data: contacts } = await supabase
      .from("journey_contacts")
      .select("id")
      .in("phone", phones)
      .eq("opted_out", false);
    return { contactIds: (contacts || []).map((c: any) => c.id) };
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
        // Validate the linked list view's entity is an audience source
        const { data: lv, error: lvErr } = await supabase
          .from("list_views").select("entity_type, name").eq("id", journey.list_view_id).maybeSingle();
        if (lvErr) throw lvErr;
        if (!lv) throw new Error("Linked list view not found");
        const cfg = ALLOWED_ENTITIES[lv.entity_type];
        if (!cfg || !cfg.isAudienceSource) {
          throw new Error(`List view "${lv.name}" uses entity "${lv.entity_type}" which is not an audience source. Use a Customers or Orders list view.`);
        }

        // Clear stale enrollments so dynamic filters (e.g. "next N days") re-evaluate fresh on every activation.
        // Strict scoping invariant: audience is rebuilt ONLY from list-view-resolve output below.
        await supabase
          .from("journey_enrollments")
          .delete()
          .eq("journey_id", journey_id)
          .in("status", ["active", "paused"]);

        const result = await resolveListViewContacts(supabase, journey.list_view_id);
        contactIds = result.contactIds;
      } else {
        // Legacy fallback: segment_type-based (only when no list_view_id is bound)
        let query = supabase.from("journey_contacts").select("id").eq("opted_out", false);
        if (journey.segment_type) query = query.eq("segment_type", journey.segment_type);
        const filters = journey.filters as any;
        if (filters?.city) query = query.eq("city", filters.city);
        const { data: contacts, error: cErr } = await query;
        if (cErr) throw cErr;
        contactIds = (contacts || []).map((c: any) => c.id);
      }

      // Get first node from canvas
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
