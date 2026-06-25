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

const VIRTUAL_FIELDS: Record<string, { keys: string[]; fk: string; joinTable: string; joinField: string; map: Record<string, string> }> = {
  orders: {
    keys: ["customer_name", "customer_phone"],
    fk: "customer_id",
    joinTable: "customers",
    joinField: "id",
    map: { customer_name: "name", customer_phone: "phone" },
  },
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
    case "starts_with_between": {
      const raw = String(value ?? "");
      const [a, b] = raw.split("|");
      const from = (a || "").trim().charAt(0).toUpperCase();
      const to = (b || "").trim().charAt(0).toUpperCase();
      if (!from || !to) return q;
      const start = from <= to ? from : to;
      const end = from <= to ? to : from;
      const letters: string[] = [];
      for (let c = start.charCodeAt(0); c <= end.charCodeAt(0); c++) {
        letters.push(String.fromCharCode(c));
      }
      if (!letters.length) return q;
      const orExpr = letters.map((ch) => `${field}.ilike.${ch}%`).join(",");
      return q.or(orExpr);
    }
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
    const virtual = VIRTUAL_FIELDS[def.entity_type];
    const virtualFilters = allFilters.filter(
      (c: any) => virtual && virtual.keys.includes(c.field) && c.operator !== "upcoming_anniversary_n_days"
    );
    const serverFilters = allFilters.filter(
      (c: any) => c.operator !== "upcoming_anniversary_n_days" && !virtualFilters.includes(c)
    );
    const hasRecurring = recurringFilters.length > 0;

    const selectedVirtuals = virtual
      ? (def.selected_fields || []).filter((k) => virtual.keys.includes(k))
      : [];
    let serverFieldList: string[] | null = null;
    if (def.selected_fields?.length) {
      serverFieldList = def.selected_fields.filter((k: string) => !selectedVirtuals.includes(k));
      if (virtual && selectedVirtuals.length && !serverFieldList.includes(virtual.fk)) {
        serverFieldList = [...serverFieldList, virtual.fk];
      }
    }
    const fields = serverFieldList?.length ? serverFieldList.join(", ") : "*";

    let fkRestrictIds: string[] | null = null;
    if (virtualFilters.length && virtual) {
      let cq: any = supabase.from(virtual.joinTable).select(virtual.joinField);
      for (const cond of virtualFilters) {
        cq = applyFilter(cq, { ...cond, field: virtual.map[cond.field] });
      }
      const { data: matched, error: mErr } = await cq.limit(50000);
      if (mErr) throw mErr;
      fkRestrictIds = (matched || []).map((r: any) => r[virtual.joinField]);
      if (fkRestrictIds.length === 0) {
        return new Response(
          JSON.stringify({ count: 0, rows: mode === "rows" ? [] : undefined, entity_type: def.entity_type, is_audience_source: entity.isAudienceSource, contact_key: entity.contactKey }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let q = supabase.from(entity.table).select(fields, {
      count: hasRecurring ? undefined : "exact",
      head: !hasRecurring && mode === "count",
    });
    for (const cond of serverFilters) q = applyFilter(q, cond);
    for (const cond of recurringFilters) q = q.not(cond.field, "is", null);
    if (fkRestrictIds && virtual) q = q.in(virtual.fk, fkRestrictIds);

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

    if (mode === "rows" && virtual && selectedVirtuals.length && finalRows.length) {
      const ids = Array.from(new Set(finalRows.map((r: any) => r[virtual.fk]).filter(Boolean)));
      if (ids.length) {
        const cols = Array.from(new Set([virtual.joinField, ...selectedVirtuals.map((k) => virtual.map[k])]));
        const { data: refs } = await supabase.from(virtual.joinTable).select(cols.join(", ")).in(virtual.joinField, ids);
        const lookup = new Map<string, any>();
        (refs || []).forEach((r: any) => lookup.set(r[virtual.joinField], r));
        finalRows = finalRows.map((r: any) => {
          const ref = lookup.get(r[virtual.fk]);
          const out = { ...r };
          for (const k of selectedVirtuals) out[k] = ref ? ref[virtual.map[k]] : null;
          return out;
        });
      }
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
