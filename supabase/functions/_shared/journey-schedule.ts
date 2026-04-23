// Shared Deno-compatible Journey scheduling + audience helpers.
// Mirrors src/lib/journeySchedule.ts (computeNextRun) and the audience-resolution
// logic from supabase/functions/journey-actions/index.ts.

export type ScheduleType = "one_time" | "recurring";
export type ScheduleFrequency = "daily" | "weekly" | "monthly" | "quarterly";

export interface JourneySchedule {
  id?: string;
  journey_id?: string;
  type: ScheduleType;
  frequency: ScheduleFrequency | null;
  execution_date: string | null;
  execution_time: string | null;
  days_of_week: number[] | null;
  day_of_month: number | null;
  month_of_quarter: number | null;
  timezone?: string;
  next_run_at?: string | null;
}

const IST_OFFSET_MIN = 330;

function parseHM(time: string | null): { h: number; m: number } {
  if (!time) return { h: 0, m: 0 };
  const [h, m] = time.split(":").map((v) => parseInt(v, 10));
  return { h: h || 0, m: m || 0 };
}

function istToUtc(year: number, month0: number, day: number, h: number, m: number): Date {
  return new Date(Date.UTC(year, month0, day, h, m) - IST_OFFSET_MIN * 60_000);
}

function istParts(d: Date) {
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return {
    year: ist.getUTCFullYear(),
    month0: ist.getUTCMonth(),
    day: ist.getUTCDate(),
    hour: ist.getUTCHours(),
    minute: ist.getUTCMinutes(),
    dow: ist.getUTCDay(),
  };
}

function daysInMonth(year: number, month0: number) {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}
function clampDay(year: number, month0: number, day: number) {
  return Math.min(day, daysInMonth(year, month0));
}

export function computeNextRun(
  s: JourneySchedule | null | undefined,
  fromDate: Date = new Date(),
): Date | null {
  if (!s || !s.execution_time) return null;
  const { h, m } = parseHM(s.execution_time);

  if (s.type === "one_time") {
    if (!s.execution_date) return null;
    const [y, mo, d] = s.execution_date.split("-").map((v) => parseInt(v, 10));
    return istToUtc(y, mo - 1, d, h, m);
  }

  const nowIst = istParts(fromDate);

  switch (s.frequency) {
    case "daily": {
      let candidate = istToUtc(nowIst.year, nowIst.month0, nowIst.day, h, m);
      if (candidate <= fromDate) {
        candidate = istToUtc(nowIst.year, nowIst.month0, nowIst.day + 1, h, m);
      }
      return candidate;
    }
    case "weekly": {
      const days = (s.days_of_week || []).slice().sort((a, b) => a - b);
      if (days.length === 0) return null;
      for (let offset = 0; offset < 14; offset++) {
        const probe = new Date(Date.UTC(nowIst.year, nowIst.month0, nowIst.day + offset));
        const probeIst = istParts(probe);
        if (!days.includes(probeIst.dow)) continue;
        const candidate = istToUtc(probeIst.year, probeIst.month0, probeIst.day, h, m);
        if (candidate > fromDate) return candidate;
      }
      return null;
    }
    case "monthly": {
      const dom = s.day_of_month || 1;
      for (let offset = 0; offset < 13; offset++) {
        const month0 = nowIst.month0 + offset;
        const year = nowIst.year + Math.floor(month0 / 12);
        const m0 = ((month0 % 12) + 12) % 12;
        const day = clampDay(year, m0, dom);
        const candidate = istToUtc(year, m0, day, h, m);
        if (candidate > fromDate) return candidate;
      }
      return null;
    }
    case "quarterly": {
      const dom = s.day_of_month || 1;
      const moq = (s.month_of_quarter || 1) - 1;
      for (let offset = 0; offset < 24; offset++) {
        const month0 = nowIst.month0 + offset;
        const year = nowIst.year + Math.floor(month0 / 12);
        const m0 = ((month0 % 12) + 12) % 12;
        if (m0 % 3 !== moq) continue;
        const day = clampDay(year, m0, dom);
        const candidate = istToUtc(year, m0, day, h, m);
        if (candidate > fromDate) return candidate;
      }
      return null;
    }
    default:
      return null;
  }
}

// ===================== Audience resolution =====================

export const ALLOWED_ENTITIES: Record<
  string,
  { table: string; isAudienceSource: boolean; contactKey?: string }
> = {
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
  const s = String(raw).trim();
  if (s.startsWith("+")) {
    const digits = s.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : null;
  }
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length > 10) return `+${digits}`;
  return `+${defaultCc}${digits}`;
}

export type UpsertResult = {
  contactIds: string[];
  matched: number;
  skipped: number;
  firstError?: string;
};

export async function upsertContactsFromCustomers(
  supabase: any,
  customers: any[],
): Promise<UpsertResult> {
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

  const { data: existing, error: selErr } = await supabase
    .from("journey_contacts")
    .select("id, phone")
    .in("phone", phones);
  if (selErr) throw new Error(`Failed to read journey_contacts: ${selErr.message}`);
  const existingByPhone = new Map<string, string>();
  for (const e of existing || []) existingByPhone.set(e.phone, e.id);

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
        if (!firstError) firstError = `${p}: ${insErr.message}`;
        skipped++;
        continue;
      }
      if (ins?.id) existingByPhone.set(ins.phone, ins.id);
    } catch (e: any) {
      if (!firstError) firstError = `${p}: ${e?.message || String(e)}`;
      skipped++;
    }
  }

  const { data: refetched, error: refErr } = await supabase
    .from("journey_contacts")
    .select("id, phone, opted_out")
    .in("phone", phones);
  if (refErr) throw new Error(`Failed to refetch journey_contacts: ${refErr.message}`);
  const finalIds: string[] = [];
  const seen = new Set<string>();
  for (const r of refetched || []) {
    if (r.opted_out) continue;
    if (seen.has(r.phone)) continue;
    seen.add(r.phone);
    finalIds.push(r.id);
  }

  return { contactIds: finalIds, matched, skipped, firstError };
}

export async function resolveListViewContacts(
  supabase: any,
  listViewId: string,
): Promise<{ contactIds: string[]; matched: number; skipped: number; firstError?: string; warning?: string }> {
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
    return { ...res, warning: res.contactIds.length === 0 ? "No customers enrolled" : undefined };
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
    return res;
  }

  return { contactIds: [], matched: 0, skipped: 0 };
}

/**
 * Resolve audience for a journey row using either its list_view_id or
 * legacy segment_type/filters columns. Returns contact_ids.
 */
export async function resolveAudience(
  supabase: any,
  journey: any,
): Promise<{ contactIds: string[]; matched: number; skipped: number; firstError?: string }> {
  if (journey.list_view_id) {
    const { data: lv, error: lvErr } = await supabase
      .from("list_views")
      .select("entity_type, name")
      .eq("id", journey.list_view_id)
      .maybeSingle();
    if (lvErr) throw lvErr;
    if (!lv) throw new Error("Linked list view not found");
    const cfg = ALLOWED_ENTITIES[lv.entity_type];
    if (!cfg || !cfg.isAudienceSource) {
      throw new Error(
        `List view "${lv.name}" uses entity "${lv.entity_type}" which is not an audience source.`,
      );
    }
    return await resolveListViewContacts(supabase, journey.list_view_id);
  }

  let query = supabase.from("journey_contacts").select("id").eq("opted_out", false);
  if (journey.segment_type) query = query.eq("segment_type", journey.segment_type);
  const filters = journey.filters as any;
  if (filters?.city) query = query.eq("city", filters.city);
  const { data: contacts, error: cErr } = await query;
  if (cErr) throw cErr;
  const contactIds = (contacts || []).map((c: any) => c.id);
  return { contactIds, matched: contactIds.length, skipped: 0 };
}
