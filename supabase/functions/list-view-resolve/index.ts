import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ENTITIES: Record<string, { table: string; isAudienceSource: boolean; contactKey?: string }> = {
  customers: { table: "customers", isAudienceSource: true, contactKey: "phone" },
  leads: { table: "leads", isAudienceSource: true, contactKey: "phone" },
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
    case "next_n_days": {
      const days = Number(value) || 0;
      return q.gte(field, new Date().toISOString()).lte(field, new Date(Date.now() + days * 86400000).toISOString());
    }
    default: return q;
  }
}

function isUpcomingRecurring(dateStr: string | null | undefined, days: number): boolean {
  if (!dateStr || days < 0) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let occ = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (occ < today) occ = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  const end = new Date(today);
  end.setDate(end.getDate() + days);
  return occ >= today && occ <= end;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { list_view_id, definition, mode = "count" } = body as {
      list_view_id?: string;
      definition?: { entity_type: string; selected_fields?: string[]; filters?: any[] };
      mode?: "count" | "rows";
    };

    let def = definition;
    if (list_view_id) {
      const { data, error } = await supabase
        .from("list_views")
        .select("entity_type, selected_fields, filters")
        .eq("id", list_view_id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("List view not found");
      def = data as any;
    }
    if (!def) throw new Error("Provide list_view_id or definition");

    const entity = ALLOWED_ENTITIES[def.entity_type];
    if (!entity) throw new Error(`Invalid entity: ${def.entity_type}`);

    const allFilters = def.filters || [];
    const recurringFilters = allFilters.filter((c: any) => c.operator === "upcoming_anniversary_n_days");
    const serverFilters = allFilters.filter((c: any) => c.operator !== "upcoming_anniversary_n_days");
    const hasRecurring = recurringFilters.length > 0;

    const fields = def.selected_fields?.length ? def.selected_fields.join(", ") : "*";
    let q = supabase.from(entity.table).select(fields, {
      count: hasRecurring ? undefined : "exact",
      head: !hasRecurring && mode === "count",
    });
    for (const cond of serverFilters) q = applyFilter(q, cond);
    for (const cond of recurringFilters) q = q.not(cond.field, "is", null);

    if (hasRecurring) q = q.limit(2000);
    else if (mode === "rows") q = q.limit(1000);

    const { data, error, count } = await q;
    if (error) throw error;

    let finalRows: any[] = data || [];
    let finalCount = count || 0;
    if (hasRecurring) {
      for (const cond of recurringFilters) {
        const days = Number(cond.value) || 0;
        finalRows = finalRows.filter((r: any) => isUpcomingRecurring(r[cond.field], days));
      }
      finalCount = finalRows.length;
      if (mode === "rows") finalRows = finalRows.slice(0, 1000);
    }

    return new Response(
      JSON.stringify({
        count: finalCount,
        rows: mode === "rows" ? finalRows : undefined,
        entity_type: def.entity_type,
        is_audience_source: entity.isAudienceSource,
        contact_key: entity.contactKey,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
