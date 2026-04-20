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

  let q: any = supabase.from(schema.table as any).select(fields, {
    count: "exact",
    head: !!opts.countOnly,
  });

  for (const cond of def.filters || []) {
    const meta = fieldMap.get(cond.field);
    if (!meta) continue;
    q = applyFilter(q, cond, meta);
  }

  if (!opts.countOnly) {
    q = q.limit(opts.limit ?? 25);
  }

  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
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
    default:
      return q;
  }
}

function coerce(v: any, meta: FieldDef) {
  if (v === null || v === undefined || v === "") return v;
  if (meta.type === "number") return Number(v);
  return v;
}
