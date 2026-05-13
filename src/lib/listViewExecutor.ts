import { supabase } from "@/integrations/supabase/client";
import { ENTITY_SCHEMAS, type EntityKey, type FilterCondition, type FieldDef } from "./listViewSchema";

export interface ListViewDefinition {
  entity_type: EntityKey;
  selected_fields?: string[];
  filters?: FilterCondition[];
}

/**
 * Execute a list view definition against Supabase. Returns rows and total count.
 */
export async function executeListView(
  def: ListViewDefinition,
  opts: { limit?: number; countOnly?: boolean } = {}
): Promise<{ rows: any[]; count: number }> {
  const schema = ENTITY_SCHEMAS[def.entity_type];
  if (!schema) throw new Error(`Unknown entity: ${def.entity_type}`);

  const fields = def.selected_fields?.length ? def.selected_fields.join(", ") : "*";
  const fieldMap = new Map<string, FieldDef>(schema.fields.map((f) => [f.key, f]));

  // Separate recurring filters (need client-side post-filter) from server-side filters
  const recurringFilters = (def.filters || []).filter((c) => c.operator === "upcoming_anniversary_n_days");
  const serverFilters = (def.filters || []).filter((c) => c.operator !== "upcoming_anniversary_n_days");
  const hasRecurring = recurringFilters.length > 0;

  // Build a query factory so we can paginate beyond PostgREST's 1000-row cap.
  const buildQuery = (rangeFrom: number, rangeTo: number, withCount: boolean) => {
    let q: any = supabase.from(schema.table as any).select(fields, {
      count: withCount ? "exact" : undefined,
      head: false,
    });
    for (const cond of serverFilters) {
      const meta = fieldMap.get(cond.field);
      if (!meta) continue;
      q = applyFilter(q, cond, meta);
    }
    for (const cond of recurringFilters) {
      q = q.not(cond.field, "is", null);
    }
    return q.range(rangeFrom, rangeTo);
  };

  // Head-only count fast path (no recurring filters).
  if (!hasRecurring && opts.countOnly) {
    let q: any = supabase.from(schema.table as any).select(fields, { count: "exact", head: true });
    for (const cond of serverFilters) {
      const meta = fieldMap.get(cond.field);
      if (!meta) continue;
      q = applyFilter(q, cond, meta);
    }
    const { error, count } = await q;
    if (error) throw error;
    return { rows: [], count: count || 0 };
  }

  // Determine target row count to fetch.
  // Recurring filters require fetching all candidate rows to post-filter accurately.
  const target = hasRecurring ? Number.POSITIVE_INFINITY : (opts.limit ?? 25);
  const PAGE = 1000;

  let rows: any[] = [];
  let serverCount = 0;
  let from = 0;
  while (rows.length < target) {
    const to = from + PAGE - 1;
    const { data, error, count } = await buildQuery(from, to, from === 0);
    if (error) throw error;
    if (from === 0 && typeof count === "number") serverCount = count;
    const batch = (data as any[]) || [];
    rows.push(...batch);
    if (batch.length < PAGE) break; // no more rows
    from += PAGE;
    // Safety cap to avoid runaway fetches
    if (from > 100000) break;
  }

  if (hasRecurring) {
    for (const cond of recurringFilters) {
      const days = Number(cond.value) || 0;
      rows = rows.filter((r) => isUpcomingRecurring(r[cond.field], days));
    }
    const total = rows.length;
    if (!opts.countOnly) rows = rows.slice(0, opts.limit ?? 25);
    return { rows: opts.countOnly ? [] : rows, count: total };
  }

  if (rows.length > (opts.limit ?? 25)) rows = rows.slice(0, opts.limit ?? 25);
  return { rows, count: serverCount || rows.length };
}

/**
 * Returns true if the month-day of `dateStr` falls within the next `days` days from today (inclusive).
 * Handles year-end wrap-around.
 */
function isUpcomingRecurring(dateStr: string | null | undefined, days: number): boolean {
  if (!dateStr || days < 0) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Build this year's occurrence
  let occ = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (occ < today) {
    occ = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  }
  const end = new Date(today);
  end.setDate(end.getDate() + days);
  return occ >= today && occ <= end;
}

function applyFilter(q: any, cond: FilterCondition, meta: FieldDef) {
  const { field, operator, value } = cond;
  switch (operator) {
    case "eq":
      return q.eq(field, coerce(value, meta));
    case "neq":
      return q.neq(field, coerce(value, meta));
    case "gt":
      return q.gt(field, coerce(value, meta));
    case "gte":
      return q.gte(field, coerce(value, meta));
    case "lt":
      return q.lt(field, coerce(value, meta));
    case "lte":
      return q.lte(field, coerce(value, meta));
    case "ilike":
      return q.ilike(field, `%${value}%`);
    case "starts_with":
      return q.ilike(field, `${value}%`);
    case "is_null":
      return q.is(field, null);
    case "is_not_null":
      return q.not(field, "is", null);
    case "is_true":
      return q.eq(field, true);
    case "is_false":
      return q.eq(field, false);
    case "last_n_days": {
      const days = Number(value) || 0;
      const since = new Date(Date.now() - days * 86400000).toISOString();
      return q.gte(field, since);
    }
    case "next_n_days": {
      const days = Number(value) || 0;
      const now = new Date();
      const until = new Date(Date.now() + days * 86400000).toISOString();
      return q.gte(field, now.toISOString()).lte(field, until);
    }
    default:
      return q;
  }
}

function coerce(v: any, meta: FieldDef) {
  if (v === null || v === undefined || v === "") return v;
  if (meta.type === "number") return Number(v);
  return v;
}
