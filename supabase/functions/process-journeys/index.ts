import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  computeNextRun,
  resolveAudience,
  upsertContactsFromCustomers,
  ALLOWED_ENTITIES,
  type JourneySchedule,
} from "../_shared/journey-schedule.ts";
import {
  renderFreeformBody,
  sendWhatsAppFreeform,
  sendSms,
  sendEmail,
  type ChannelSendResult,
  type FreeformChannel,
} from "../_shared/journey-channels.ts";
import {
  TOKEN_SOURCES,
  ENRICHABLE_TOKENS,
  needsCustomerJoin,
  needsOrderJoin,
  readSourceField,
} from "../_shared/variable-registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sweep journey_schedules: enroll audiences for any due, approved+active journey,
// then advance next_run_at to the next IST occurrence.
async function runScheduleSweep(supabase: any): Promise<{ triggered: number; errors: string[] }> {
  const errors: string[] = [];
  let triggered = 0;
  const now = new Date();
  const nowIso = now.toISOString();
  const staleRelativeAfter = now.getTime() + 2 * 60_000;

  const scheduleSelect = "*, journeys!inner(id, status, approval_status, list_view_id, segment_type, filters, canvas_data)";

  const { data: timedSchedules, error: schedErr } = await supabase
    .from("journey_schedules")
    .select(scheduleSelect)
    .lte("next_run_at", nowIso)
    .not("next_run_at", "is", null)
    .eq("journeys.status", "active")
    .eq("journeys.approval_status", "approved");

  if (schedErr) {
    console.error("[schedule-sweep] failed to fetch due schedules:", schedErr);
    return { triggered: 0, errors: [schedErr.message] };
  }
  const { data: relativeSchedules, error: relSchedErr } = await supabase
    .from("journey_schedules")
    .select(scheduleSelect)
    .eq("type", "relative")
    .eq("journeys.status", "active")
    .eq("journeys.approval_status", "approved");

  if (relSchedErr) {
    console.error("[schedule-sweep] failed to fetch relative schedules:", relSchedErr);
    return { triggered: 0, errors: [relSchedErr.message] };
  }

  const dueSchedules = Array.from(
    new Map([...(timedSchedules || []), ...(relativeSchedules || [])].map((s: any) => [s.id, s])).values(),
  );
  if (dueSchedules.length === 0) return { triggered: 0, errors: [] };

  for (const sched of dueSchedules) {
    const journey = sched.journeys;
    const scheduleRow: JourneySchedule = {
      id: sched.id,
      journey_id: sched.journey_id,
      type: sched.type,
      frequency: sched.frequency,
      execution_date: sched.execution_date,
      execution_time: sched.execution_time,
      days_of_week: sched.days_of_week,
      day_of_month: sched.day_of_month,
      month_of_quarter: sched.month_of_quarter,
      relative_entity: sched.relative_entity,
      relative_field: sched.relative_field,
      relative_rule: sched.relative_rule,
      relative_offset: sched.relative_offset,
      relative_unit: sched.relative_unit,
      retrigger_mode: sched.retrigger_mode,
    };

    // Compute next run BEFORE doing work, then claim atomically by updating
    // next_run_at to that future value. If the update affects 0 rows another
    // worker already claimed it.
    let nextIso: string | null;
    if (sched.type === "one_time") {
      nextIso = null;
    } else if (sched.type === "relative") {
      const currentNext = sched.next_run_at ? new Date(sched.next_run_at).getTime() : 0;
      const recentlyClaimed = currentNext > now.getTime() && currentNext <= staleRelativeAfter;
      if (recentlyClaimed) continue;
      // Re-arm just long enough to prevent duplicate overlapping cron claims.
      // The next minute's cron will be due, while stale future values from older deployments are corrected.
      nextIso = new Date(Date.now() + 30_000).toISOString();
    } else {
      const next = computeNextRun(scheduleRow, new Date());
      nextIso = next ? next.toISOString() : null;
    }

    let claimQuery = supabase
      .from("journey_schedules")
      .update({ next_run_at: nextIso })
      .eq("id", sched.id)
      .select("id");
    if (sched.type === "relative") {
      if (sched.next_run_at) claimQuery = claimQuery.eq("next_run_at", sched.next_run_at);
      else claimQuery = claimQuery.is("next_run_at", null);
    } else {
      claimQuery = claimQuery.lte("next_run_at", nowIso);
    }
    const { data: claimed, error: claimErr } = await claimQuery;
    if (claimErr) {
      errors.push(`claim ${sched.id}: ${claimErr.message}`);
      continue;
    }
    if (!claimed || claimed.length === 0) continue; // someone else got it

    try {
      if (sched.type === "relative") {
        const result = await runRelativeBranch(supabase, scheduleRow, journey);
        await supabase.from("journey_message_log").insert({
          journey_id: journey.id,
          enrollment_id: null,
          node_id: null,
          contact_id: null,
          channel: "system",
          status: result.enrolled > 0 ? "scheduled_enrolled" : "scheduled_no_audience",
          template_body: JSON.stringify({
            schedule_id: sched.id,
            mode: "relative",
            evaluated: result.evaluated,
            enrolled: result.enrolled,
            reason: result.firstError || null,
          }),
        });
        triggered++;
        console.log(`[schedule-sweep] relative journey=${journey.id} evaluated=${result.evaluated} enrolled=${result.enrolled}`);
        continue;
      }

      // Refresh enrollments so dynamic audiences re-evaluate
      await supabase
        .from("journey_enrollments")
        .delete()
        .eq("journey_id", journey.id)
        .in("status", ["active", "paused", "failed"]);

      const audience = await resolveAudience(supabase, journey);
      const canvas = journey.canvas_data as any;
      const firstNodeId = getInitialJourneyNodeId(canvas);

      if (audience.contactIds.length > 0 && firstNodeId) {
        const enrollments = audience.contactIds.map((cid: string) => ({
          journey_id: journey.id,
          contact_id: cid,
          current_node_id: firstNodeId,
          status: "active",
          next_action_at: new Date().toISOString(),
        }));
        const { error: enrErr } = await supabase.from("journey_enrollments").insert(enrollments);
        if (enrErr) throw new Error(`enroll: ${enrErr.message}`);
      }

      // Audit log: one row per scheduled run so Analytics shows misses too
      await supabase.from("journey_message_log").insert({
        journey_id: journey.id,
        enrollment_id: null,
        node_id: null,
        contact_id: null,
        channel: "system",
        status: audience.contactIds.length > 0 ? "scheduled_enrolled" : "scheduled_no_audience",
        template_body: JSON.stringify({
          schedule_id: sched.id,
          matched: audience.matched,
          enrolled: audience.contactIds.length,
          skipped: audience.skipped,
          reason: audience.firstError || null,
        }),
      });

      triggered++;
      console.log(
        `[schedule-sweep] journey=${journey.id} enrolled=${audience.contactIds.length} matched=${audience.matched} next_run=${nextIso}`,
      );
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error(`[schedule-sweep] journey ${journey.id} failed:`, msg);
      errors.push(`journey ${journey.id}: ${msg}`);
      await supabase.from("journey_message_log").insert({
        journey_id: journey.id,
        channel: "system",
        status: "scheduled_failed",
        template_body: JSON.stringify({ schedule_id: sched.id, error: msg }),
        error_message: msg,
      });
    }
  }

  return { triggered, errors };
}

// ============= Relative date scheduling =============

const IST_OFFSET_MIN = 330;

function istWallclockToUtc(year: number, month0: number, day: number, h: number, m: number): Date {
  return new Date(Date.UTC(year, month0, day, h, m) - IST_OFFSET_MIN * 60_000);
}

/**
 * Shift a base date (interpreted as a calendar date) by the configured offset,
 * then anchor it at the IST execution time.
 */
function computeRelativeTarget(
  baseRaw: string,
  rule: "before" | "after" | "on",
  offset: number,
  unit: "days" | "weeks" | "months",
  hour: number,
  minute: number,
): Date | null {
  const base = new Date(baseRaw);
  if (isNaN(base.getTime())) return null;
  // Work in UTC components — we only care about the calendar date.
  let y = base.getUTCFullYear();
  let m0 = base.getUTCMonth();
  let d = base.getUTCDate();

  const sign = rule === "before" ? -1 : rule === "after" ? 1 : 0;
  if (sign !== 0) {
    if (unit === "days") d += sign * offset;
    else if (unit === "weeks") d += sign * offset * 7;
    else if (unit === "months") m0 += sign * offset;
  }
  // Normalize via UTC date constructor.
  const norm = new Date(Date.UTC(y, m0, d));
  return istWallclockToUtc(
    norm.getUTCFullYear(),
    norm.getUTCMonth(),
    norm.getUTCDate(),
    hour,
    minute,
  );
}

/**
 * For "repeat" retrigger mode: if the original target is far in the past,
 * advance the year so the schedule fires annually (birthdays/anniversaries).
 */
function advanceAnnually(target: Date, now: Date): Date {
  let t = target;
  // Catch-up window: if more than 30 days in the past, advance years
  // until we're within [now-30d, now+~365d].
  const lower = now.getTime() - 30 * 86400_000;
  let guard = 0;
  while (t.getTime() < lower && guard < 200) {
    t = new Date(Date.UTC(
      t.getUTCFullYear() + 1,
      t.getUTCMonth(),
      t.getUTCDate(),
      t.getUTCHours(),
      t.getUTCMinutes(),
    ));
    guard++;
  }
  return t;
}

async function fetchAllRowsWithFilters(supabase: any, table: string, filters: any[]): Promise<any[]> {
  const PAGE = 1000;
  const all: any[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select("*").range(from, from + PAGE - 1);
    for (const cond of filters || []) {
      const { field, operator, value } = cond;
      switch (operator) {
        case "eq": q = q.eq(field, value); break;
        case "neq": q = q.neq(field, value); break;
        case "gt": q = q.gt(field, value); break;
        case "gte": q = q.gte(field, value); break;
        case "lt": q = q.lt(field, value); break;
        case "lte": q = q.lte(field, value); break;
        case "ilike": q = q.ilike(field, `%${value}%`); break;
        case "starts_with": q = q.ilike(field, `${value}%`); break;
        case "is_null": q = q.is(field, null); break;
        case "is_not_null": q = q.not(field, "is", null); break;
        case "is_true": q = q.eq(field, true); break;
        case "is_false": q = q.eq(field, false); break;
      }
    }
    const { data, error } = await q;
    if (error) throw error;
    const batch = data || [];
    all.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
    if (from > 100000) break;
  }
  return all;
}

async function runRelativeBranch(
  supabase: any,
  sched: JourneySchedule,
  journey: any,
): Promise<{ evaluated: number; enrolled: number; firstError?: string }> {
  if (!sched.relative_entity || !sched.relative_field || !sched.relative_rule || !sched.execution_time) {
    return { evaluated: 0, enrolled: 0, firstError: "Incomplete relative schedule config" };
  }
  const cfg = ALLOWED_ENTITIES[sched.relative_entity];
  if (!cfg) return { evaluated: 0, enrolled: 0, firstError: `Unknown entity ${sched.relative_entity}` };

  // Use the journey's list view filters when entities align; otherwise no filters.
  let filters: any[] = [];
  if (journey.list_view_id) {
    const { data: lv } = await supabase
      .from("list_views")
      .select("entity_type, filters")
      .eq("id", journey.list_view_id)
      .maybeSingle();
    if (lv && lv.entity_type === sched.relative_entity) filters = lv.filters || [];
  }

  const rows = await fetchAllRowsWithFilters(supabase, cfg.table, filters);
  const [eh, em] = (sched.execution_time || "09:00").split(":").map((v) => parseInt(v, 10));
  const now = new Date();
  const horizonPast = now.getTime() - 24 * 3600_000;

  // Pre-fetch fire history for this journey.
  const recordIds = rows.map((r: any) => String(r.id)).filter(Boolean);
  const firesByRecord = new Map<string, any>();
  for (let i = 0; i < recordIds.length; i += 500) {
    const chunk = recordIds.slice(i, i + 500);
    const { data: existing } = await supabase
      .from("journey_relative_fires")
      .select("record_id, last_field_value, last_fired_at")
      .eq("journey_id", journey.id)
      .in("record_id", chunk);
    for (const e of existing || []) firesByRecord.set(e.record_id, e);
  }

  const canvas = journey.canvas_data as any;
  const firstNodeId = getInitialJourneyNodeId(canvas);
  if (!firstNodeId) return { evaluated: rows.length, enrolled: 0, firstError: "Journey has no entry node" };

  let evaluated = 0;
  let enrolled = 0;
  let firstError: string | undefined;

  // Collect rows that should fire (so we can do contact upsert in batch for customers/leads).
  const fires: Array<{ row: any; target: Date }> = [];

  for (const row of rows) {
    evaluated++;
    const raw = row[sched.relative_field];
    if (!raw) continue;

    let target = computeRelativeTarget(
      String(raw),
      sched.relative_rule,
      sched.relative_offset ?? 0,
      (sched.relative_unit as any) || "days",
      eh || 0,
      em || 0,
    );
    if (!target) continue;

    if (sched.retrigger_mode === "repeat") {
      target = advanceAnnually(target, now);
    }

    // Must be within the firing window: target reached, not too old to backfill.
    if (target.getTime() > now.getTime()) continue;
    if (target.getTime() < horizonPast) continue;

    const rid = String(row.id);
    const prev = firesByRecord.get(rid);

    let shouldFire = false;
    if (sched.retrigger_mode === "once") {
      // Once per record for the current target occurrence. If the schedule is edited
      // from an earlier target to a later one, allow the new occurrence to fire.
      shouldFire = !prev || (new Date(prev.last_fired_at).getTime() < target.getTime() - 60_000);
    } else if (sched.retrigger_mode === "on_change") {
      const rawIso = new Date(raw).toISOString();
      shouldFire = !prev || (prev.last_field_value !== rawIso);
    } else if (sched.retrigger_mode === "repeat") {
      // Fire if no prior fire, or last fire is older than this target occurrence.
      shouldFire = !prev || (new Date(prev.last_fired_at).getTime() < target.getTime() - 60_000);
    }
    if (!shouldFire) continue;

    fires.push({ row, target });
  }

  if (fires.length === 0) return { evaluated, enrolled: 0 };

  // Resolve to journey_contacts. Reuse upsertContactsFromCustomers for customers/leads
  // and the customer-from-order path for orders.
  let customers: any[] = [];
  let customerByRowId = new Map<string, any>();

  if (sched.relative_entity === "customers" || sched.relative_entity === "leads") {
    for (const f of fires) {
      customers.push(f.row);
      customerByRowId.set(String(f.row.id), f.row);
    }
  } else if (sched.relative_entity === "orders") {
    const cIds = Array.from(new Set(fires.map((f) => f.row.customer_id).filter(Boolean)));
    for (let i = 0; i < cIds.length; i += 200) {
      const chunk = cIds.slice(i, i + 200);
      const { data } = await supabase.from("customers").select("*").in("id", chunk);
      for (const c of data || []) {
        customers.push(c);
        // Map each order row to its customer
        for (const f of fires) {
          if (f.row.customer_id === c.id) customerByRowId.set(String(f.row.id), c);
        }
      }
    }
  } else {
    return { evaluated, enrolled: 0, firstError: `Entity ${sched.relative_entity} is not an audience source` };
  }

  const upsertRes = await upsertContactsFromCustomers(supabase, customers);
  if (upsertRes.firstError) firstError = upsertRes.firstError;

  // Build phone → contact_id map
  const { data: contactRows } = await supabase
    .from("journey_contacts")
    .select("id, phone, opted_out")
    .in("id", upsertRes.contactIds);
  const contactByPhone = new Map<string, string>();
  for (const c of contactRows || []) {
    if (c.opted_out) continue;
    contactByPhone.set(String(c.phone), c.id);
  }

  function normalize(raw: any): string | null {
    if (!raw) return null;
    const s = String(raw).trim();
    const digits = s.startsWith("+") ? s.slice(1).replace(/\D/g, "") : s.replace(/\D/g, "");
    if (!digits) return null;
    if (s.startsWith("+") || digits.length > 10) return `+${digits}`;
    return `+91${digits}`;
  }

  const nowIso = new Date().toISOString();
  const enrollmentRows: any[] = [];
  const fireRows: any[] = [];

  for (const f of fires) {
    const cust = customerByRowId.get(String(f.row.id));
    if (!cust) continue;
    const phone = normalize(cust.phone);
    if (!phone) continue;
    const cid = contactByPhone.get(phone);
    if (!cid) continue;

    enrollmentRows.push({
      journey_id: journey.id,
      contact_id: cid,
      current_node_id: firstNodeId,
      status: "active",
      next_action_at: nowIso,
    });
    fireRows.push({
      journey_id: journey.id,
      record_id: String(f.row.id),
      last_field_value: new Date(f.row[sched.relative_field!]).toISOString(),
      last_fired_at: nowIso,
    });
  }

  if (enrollmentRows.length > 0) {
    const { error: enrErr } = await supabase.from("journey_enrollments").insert(enrollmentRows);
    if (enrErr && !firstError) firstError = `enroll: ${enrErr.message}`;
    else enrolled = enrollmentRows.length;
  }

  if (fireRows.length > 0) {
    const { error: upErr } = await supabase
      .from("journey_relative_fires")
      .upsert(fireRows, { onConflict: "journey_id,record_id" });
    if (upErr && !firstError) firstError = `fire-log: ${upErr.message}`;
  }

  return { evaluated, enrolled, firstError };
}

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

function formatDate(raw: any): string {
  if (raw == null || raw === "") return "";
  const d = new Date(String(raw));
  if (isNaN(d.getTime())) return String(raw);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${dd} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
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
    // Bare token (no braces) — e.g. mapping value "customer_last_order_date"
    const bare = s.trim();
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(bare)) out.add(bare);
  }
  return out;
}

/**
 * Enrich the journey_contacts row's `metadata` with any registry-declared
 * values the message needs. Driven entirely by `TOKEN_SOURCES` so adding a
 * new variable only requires updating the shared registry — no edits here.
 */
async function enrichContact(supabase: any, contact: any, tokens: Set<string>): Promise<void> {
  if (!contact) return;
  if (!needsCustomerJoin(tokens)) return;

  const metadata = (contact.metadata && typeof contact.metadata === "object") ? contact.metadata : {};
  contact.metadata = metadata;

  // Locate the customer row once.
  let customer: any = null;
  const phone = contact.phone ? String(contact.phone).replace(/\D/g, "") : "";
  const last10 = phone ? phone.slice(-10) : "";
  try {
    if (contact.contact_id) {
      const { data } = await supabase.from("customers").select("*").eq("id", contact.contact_id).maybeSingle();
      if (data) customer = data;
    }
    if (!customer && last10) {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .or(`phone.ilike.%${last10},phone.eq.${last10}`)
        .limit(1);
      if (data && data.length) customer = data[0];
    }
  } catch (e) { console.error("[enrichContact] customer lookup failed", e); }

  // Fetch latest order only if any last_order token was requested.
  let lastOrder: any = null;
  if (needsOrderJoin(tokens) && customer?.id) {
    try {
      const { data: orders } = await supabase
        .from("orders")
        // Keep this select aligned to the actual orders table. Selecting a
        // missing column makes the whole latest-order lookup fail, which then
        // leaves customer_last_order_date empty.
        .select("id, order_number, status, total_amount, tax_amount, discount_amount, created_at")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(1);
      lastOrder = (orders && orders[0]) || null;
    } catch (e) { console.error("[enrichContact] order lookup failed", e); }
  }

  // Apply every requested token via the registry — no per-field code paths.
  for (const token of tokens) {
    if (!ENRICHABLE_TOKENS.has(token)) continue;
    if (metadata[token] != null && metadata[token] !== "") continue; // don't overwrite
    const src = TOKEN_SOURCES[token];
    if (!src) continue;
    const row = src.kind === "last_order" ? lastOrder : customer;
    const val = readSourceField(row, src);
    if (val !== "") metadata[token] = val;
  }
}

function resolveContactPath(contact: any, rawPath: string): string {
  if (!contact) return "";
  // Strip leading "contact." if present
  let path = rawPath.startsWith("contact.") ? rawPath.slice("contact.".length) : rawPath;

  const registeredSource = TOKEN_SOURCES[path];
  if (registeredSource) {
    if (registeredSource.kind === "contact") return readSourceField(contact, registeredSource);
    const fromMetadata = getNested(contact.metadata, path);
    if (fromMetadata != null && fromMetadata !== "") return String(fromMetadata);
  }

  // Aliases for common fields
  if (path === "name") {
    const n = contact.name;
    if (n != null && String(n).trim()) return String(n);
    const fn = contact.first_name ?? "";
    const ln = contact.last_name ?? "";
    const combined = `${fn} ${ln}`.trim();
    if (combined) return combined;
    // fallthrough to metadata.name
    const meta = getNested(contact.metadata, "name");
    return meta == null ? "" : String(meta);
  }

  // DOB aliases — journey_contacts uses `date_of_birth`, but tokens may
  // reference customer_dob / dob / birthday based on the source entity.
  if (path === "customer_dob" || path === "dob" || path === "birthday" || path === "date_of_birth") {
    const raw = contact.date_of_birth
      ?? getNested(contact.metadata, "date_of_birth")
      ?? getNested(contact.metadata, "customer_dob")
      ?? getNested(contact.metadata, "dob");
    if (raw == null || raw === "") return "";
    // Format as dd MMM yyyy if it parses as a date; otherwise return as-is.
    const d = new Date(String(raw));
    if (!isNaN(d.getTime())) {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${dd} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    }
    return String(raw);
  }

  // Direct column lookup
  const direct = getNested(contact, path);
  if (direct != null && direct !== "") return String(direct);

  // Fallback into metadata JSON
  // e.g. "city" -> metadata.city, "metadata.city" -> metadata.city
  if (path.startsWith("metadata.")) {
    const v = getNested(contact, path);
    return v == null ? "" : String(v);
  }
  const metaVal = getNested(contact.metadata, path);
  return metaVal == null ? "" : String(metaVal);
}

function resolveSingleToken(token: string, contact: any): string {
  // token is the inner content of {{...}} or {...}
  const trimmed = token.trim();
  return resolveContactPath(contact, trimmed);
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
      resolved = source.replace(/\{\{([^}]+)\}\}/g, (_m, inner) =>
        resolveSingleToken(inner, contact),
      );
      resolved = resolved.replace(/\{([^{}]+)\}/g, (_m, inner) =>
        resolveSingleToken(inner, contact),
      );
    } else {
      resolved = resolveContactPath(contact, source);
    }
    return resolved || "";
  };

  for (const [key, source] of Object.entries(mapping)) {
    let resolved = tryResolve(source);

    // Sibling-resolution fallback: a numeric key (e.g. "1") whose source is
    // self-referential (e.g. "{{1}}") or empty cannot resolve. Look for a
    // friendly sibling key whose value resolves and use that.
    const isNumericKey = /^\d+$/.test(key);
    // When the template marker tells us this numeric slot belongs to a
    // specific friendly key (e.g. "2" -> "customer_dob"), the friendly key
    // is the source of truth. Older nodes may have a STALE numeric mirror
    // (e.g. "2": "{{contact.name}}" left over from a previous binding),
    // so we re-resolve from the friendly source whenever it exists — not
    // only when the numeric resolution is empty.
    if (isNumericKey && numericToFriendly?.[key]) {
      const friendlyKey = numericToFriendly[key];
      if (mapping[friendlyKey] != null) {
        const fromFriendly = tryResolve(mapping[friendlyKey]);
        if (fromFriendly && fromFriendly.trim()) {
          resolved = fromFriendly;
        } else if (!resolved || !resolved.trim()) {
          // Friendly source exists but didn't resolve — also try the
          // friendly key as a direct contact path (e.g. customer_dob).
          const direct = resolveContactPath(contact, friendlyKey);
          if (direct && direct.trim()) resolved = direct;
        }
      }
    } else if (isNumericKey && (!resolved || !resolved.trim())) {
      // Prefer the friendly key mapped to this slot via the template marker
      // (e.g. {"1": "customer_name", "2": "customer_dob"}). This preserves
      // positional intent — without it, slot "2" could grab slot "1"'s value.
      const friendlyKey = numericToFriendly?.[key];
      if (friendlyKey && mapping[friendlyKey] != null) {
        const fromFriendly = tryResolve(mapping[friendlyKey]);
        if (fromFriendly && fromFriendly.trim()) {
          resolved = fromFriendly;
        } else {
          // Friendly source exists but didn't resolve — also try the
          // friendly key as a direct contact path (e.g. customer_dob).
          const direct = resolveContactPath(contact, friendlyKey);
          if (direct && direct.trim()) resolved = direct;
        }
      }
    }

    if (!resolved || !resolved.trim()) {
      out[key] = key === "1" ? "Customer" : "";
    } else {
      out[key] = resolved;
    }
  }
  return out;
}

// Parallel batch size for per-enrollment processing.
// Tuned to respect Twilio rate limits while still draining audiences quickly.
const ENROLLMENT_BATCH_SIZE = 20;
// Cap retries before marking an enrollment as permanently failed.
const MAX_RETRIES = 3;
// Backoff delay (ms) added to next_action_at for retryable failures.
const RETRY_BACKOFF_MS = 5 * 60 * 1000;

function getInitialJourneyNodeId(canvas: any): string | null {
  const entryNode = canvas?.nodes?.find((n: any) => n.type === "entry");
  if (entryNode) {
    const firstEdge = canvas?.edges?.find((e: any) => e.source === entryNode.id);
    if (firstEdge?.target) return firstEdge.target;
    return entryNode.id;
  }
  return canvas?.nodes?.[0]?.id || null;
}

interface ProcessCtx {
  supabase: any;
  supabaseUrl: string;
  serviceKey: string;
  fromNumber: string | null;
  smsFromNumber: string | null;
}

async function processEnrollment(
  enrollment: any,
  journey: any,
  canvas: any,
  ctx: ProcessCtx,
): Promise<{ processed: boolean; sent: number }> {
  const { supabase, supabaseUrl, serviceKey, fromNumber, smsFromNumber } = ctx;
  let messagesSent = 0;

  const currentNode = canvas.nodes.find((n: any) => n.id === enrollment.current_node_id);
  if (!currentNode) return { processed: false, sent: 0 };

  const nodeType = currentNode.type;

  if (nodeType === "exit") {
    await supabase.from("journey_enrollments")
      .update({ status: "completed" })
      .eq("id", enrollment.id);
    return { processed: true, sent: 0 };
  }

  if (nodeType === "delay") {
    const duration = currentNode.data?.duration || 1;
    const unit = currentNode.data?.unit || "days";
    const delayMs = unit === "hours" ? duration * 3600000 : duration * 86400000;
    const nextActionAt = new Date(enrollment.next_action_at!).getTime();
    if (Date.now() >= nextActionAt + delayMs) {
      const nextEdge = canvas.edges.find((e: any) => e.source === currentNode.id);
      if (nextEdge) {
        await supabase.from("journey_enrollments")
          .update({ current_node_id: nextEdge.target, next_action_at: new Date().toISOString() })
          .eq("id", enrollment.id);
      }
    }
    return { processed: true, sent: 0 };
  }

  if (nodeType === "message") {
    const contact = enrollment.journey_contacts;
    const data = currentNode.data || {};
    const messageType: string =
      data.message_type || (data.channel === "whatsapp_template" ? "template" : "template");

    // ============ TEMPLATE MODE ============
    if (messageType === "template") {
      const channel = data.channel || "whatsapp_template";
      const templateId = data.whatsapp_template_id;
      const variablesMap = data.template_variables || {};

      // Idempotency: try to claim this (enrollment, node, channel) slot first
      const { error: claimErr } = await supabase
        .from("journey_message_log")
        .insert({
          journey_id: journey.id,
          enrollment_id: enrollment.id,
          node_id: currentNode.id,
          contact_id: enrollment.contact_id,
          channel,
          template_body: null,
          status: "sending",
          template_id: templateId || null,
        });

      if (claimErr) {
        // Already attempted — advance to the next node to avoid getting stuck
        const nextEdge = canvas.edges.find((e: any) => e.source === currentNode.id);
        if (nextEdge) {
          await supabase.from("journey_enrollments")
            .update({ current_node_id: nextEdge.target, next_action_at: new Date().toISOString() })
            .eq("id", enrollment.id);
        }
        return { processed: true, sent: 0 };
      }

      let sendStatus = "failed";
      let sendAccepted = false;
      let errorMessage: string | null = null;
      let twilioSid: string | null = null;
      let renderedBody: string | null = null;

      try {
        if (channel !== "whatsapp_template") throw new Error(`Unsupported channel: ${channel}`);
        if (!templateId) throw new Error("Message node missing whatsapp_template_id");
        if (!fromNumber) throw new Error("No active WhatsApp sender configured (whatsapp_config.sender_number)");
        if (!contact?.phone) throw new Error("Contact phone missing");

        // Load template body so we can read the numeric→friendly marker
        // (e.g. <!--vars:{"1":"customer_name","2":"customer_dob"}-->) and
        // resolve numeric slots positionally instead of grabbing the first
        // non-empty friendly sibling.
        let numericToFriendly: Record<string, string> = {};
        try {
          const { data: tmplRow } = await supabase
            .from("whatsapp_templates")
            .select("body")
            .eq("id", templateId)
            .maybeSingle();
          const body: string = tmplRow?.body || "";
          const m = body.match(/<!--vars:(\{[^}]*\})-->/);
          if (m) {
            const parsed = JSON.parse(m[1]);
            if (parsed && typeof parsed === "object") numericToFriendly = parsed;
          }
        } catch (_) { /* ignore — fall back to plain resolution */ }

        // Enrich the contact with joined customer/order data so tokens like
        // {{customer_last_order_date}} resolve to actual values instead of
        // falling back to the literal "Customer" downstream.
        try {
          const sources: any[] = Object.values(variablesMap as Record<string, string>);
          for (const friendly of Object.values(numericToFriendly)) sources.push(friendly);
          const tokens = collectTokensFromSources(sources);
          await enrichContact(supabase, contact, tokens);
        } catch (e) {
          console.error("[process-journeys] enrichContact failed", e);
        }

        const variables = resolveVariables(
          variablesMap as Record<string, string>,
          contact,
          numericToFriendly,
        );
        if (!variables["1"]) {
          variables["1"] = (contact?.name && String(contact.name).trim()) || "Customer";
        }

        // Engagement: wrap any URLs found in resolved variables with tracked-redirect tokens.
        // Best-effort and isolated — failures here must never block the send.
        try {
          const urlRe = /(https?:\/\/[^\s<>"']+)/g;
          const trackBase = `${supabaseUrl}/functions/v1/track-engagement-click`;
          const segmentType = (contact?.segment_type as string) || "customer";
          const linkRows: any[] = [];
          for (const k of Object.keys(variables)) {
            const v = variables[k];
            if (typeof v !== "string" || !urlRe.test(v)) continue;
            urlRe.lastIndex = 0;
            const replaced = v.replace(urlRe, (match: string) => {
              const token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
              linkRows.push({
                token,
                journey_id: journey.id,
                journey_step_id: currentNode.id,
                person_id: enrollment.contact_id,
                entity_type: segmentType,
                template_id: templateId || null,
                original_url: match,
              });
              return `${trackBase}?t=${token}`;
            });
            variables[k] = replaced;
          }
          if (linkRows.length > 0) {
            await supabase.from("whatsapp_tracked_links").insert(linkRows);
          }
        } catch (e) {
          console.error("[process-journeys] link-wrap error", e);
        }

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
            internal_caller: "process-journeys",
            journey_enrollment_id: enrollment.id,
          }),
        });
        const result = await resp.json();
        if (!resp.ok || !result?.success) {
          throw new Error(result?.error || `whatsapp-send failed (${resp.status})`);
        }
        sendStatus = result.status || "queued";
        sendAccepted = ["accepted", "queued", "sending", "sent", "scheduled"].includes(sendStatus);
        twilioSid = result.twilio_message_sid || result.message_sid || null;
        renderedBody = JSON.stringify(variables);
        if (sendAccepted) messagesSent++;
      } catch (e) {
        errorMessage = (e as Error).message;
        console.error(`Journey ${journey.id} enrollment ${enrollment.id} send failed:`, errorMessage);
      }

      await supabase.from("journey_message_log")
        .update({
          status: sendStatus,
          delivery_status: sendAccepted ? "pending" : "failed",
          twilio_message_sid: twilioSid,
          error_message: errorMessage,
          template_body: renderedBody,
        })
        .eq("enrollment_id", enrollment.id)
        .eq("node_id", currentNode.id)
        .eq("channel", channel);

      // Engagement: log "sent" event for accepted sends. Idempotent via unique index on (sid, event_type).
      if (sendAccepted && twilioSid) {
        try {
          await supabase.from("journey_message_events").upsert({
            journey_id: journey.id,
            journey_step_id: currentNode.id,
            person_id: enrollment.contact_id,
            entity_type: (contact?.segment_type as string) || "customer",
            whatsapp_message_sid: twilioSid,
            template_id: templateId || null,
            event_type: "sent",
            event_timestamp: new Date().toISOString(),
          }, { onConflict: "whatsapp_message_sid,event_type", ignoreDuplicates: true });
        } catch (e) {
          console.error("[process-journeys] sent-event insert failed", e);
        }
      } else if (!sendAccepted && errorMessage) {
        // Local failure (Twilio rejected before assigning a SID). Use synthetic sid to allow scoring.
        try {
          await supabase.from("journey_message_events").insert({
            journey_id: journey.id,
            journey_step_id: currentNode.id,
            person_id: enrollment.contact_id,
            entity_type: (contact?.segment_type as string) || "customer",
            whatsapp_message_sid: null,
            template_id: templateId || null,
            event_type: "failed",
            event_timestamp: new Date().toISOString(),
            metadata_json: { error_message: errorMessage },
          });
        } catch (e) {
          console.error("[process-journeys] failed-event insert failed", e);
        }
      }

      if (sendAccepted) {
        await supabase.from("journey_enrollments")
          .update({
            status: "pending_delivery",
            next_action_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("id", enrollment.id);
      } else {
        // Retry with backoff up to MAX_RETRIES
        const currentRetries = enrollment.retry_count || 0;
        if (currentRetries < MAX_RETRIES) {
          await supabase.from("journey_enrollments")
            .update({
              status: "active",
              retry_count: currentRetries + 1,
              next_action_at: new Date(Date.now() + RETRY_BACKOFF_MS).toISOString(),
            })
            .eq("id", enrollment.id);
          // Allow re-claim on next run by deleting the failed log row for this slot.
          await supabase.from("journey_message_log")
            .delete()
            .eq("enrollment_id", enrollment.id)
            .eq("node_id", currentNode.id)
            .eq("channel", channel)
            .eq("status", sendStatus);
        } else {
          await supabase.from("journey_enrollments")
            .update({ status: "failed" })
            .eq("id", enrollment.id);
        }
      }
      return { processed: true, sent: messagesSent };
    }

    // ============ FREE-FORM MODE ============
    const channels: FreeformChannel[] = Array.isArray(data.freeform_channels)
      ? (data.freeform_channels as FreeformChannel[]).filter((c) => ["whatsapp", "sms", "email"].includes(c))
      : [];
    const rawBody: string = String(data.freeform_body || "").trim();
    const subject: string =
      String(data.freeform_subject || "").trim() || `Message from ${journey.name || "your team"}`;

    if (channels.length === 0 || !rawBody) {
      await supabase.from("journey_message_log").insert({
        journey_id: journey.id,
        enrollment_id: enrollment.id,
        node_id: currentNode.id,
        contact_id: enrollment.contact_id,
        channel: "system",
        status: "failed",
        error_message: !rawBody ? "Free-form body is empty" : "No channels selected",
      });
      await supabase.from("journey_enrollments")
        .update({ status: "failed" })
        .eq("id", enrollment.id);
      return { processed: true, sent: 0 };
    }

    const renderedBody = renderFreeformBody(rawBody, contact);
    const sendResults: ChannelSendResult[] = [];

    // Send to all selected channels in parallel — they're independent.
    const channelTasks = channels.map(async (ch) => {
      const { error: claimErr } = await supabase
        .from("journey_message_log")
        .insert({
          journey_id: journey.id,
          enrollment_id: enrollment.id,
          node_id: currentNode.id,
          contact_id: enrollment.contact_id,
          channel: ch,
          template_body: renderedBody,
          status: "sending",
        });
      if (claimErr) return null; // already attempted this channel

      let result: ChannelSendResult;
      if (ch === "whatsapp") {
        result = await sendWhatsAppFreeform(fromNumber || "", contact?.phone || "", renderedBody);
      } else if (ch === "sms") {
        result = await sendSms(smsFromNumber || "", contact?.phone || "", renderedBody);
      } else {
        result = await sendEmail(contact?.email || "", subject, renderedBody);
      }

      await supabase.from("journey_message_log")
        .update({
          status: result.status,
          delivery_status: result.accepted ? "pending" : "failed",
          twilio_message_sid: result.providerMessageId,
          error_message: result.errorMessage,
          error_code: result.errorCode,
          provider_metadata: result.providerMetadata as any,
        })
        .eq("enrollment_id", enrollment.id)
        .eq("node_id", currentNode.id)
        .eq("channel", ch);

      return result;
    });

    const settled = await Promise.all(channelTasks);
    for (const r of settled) {
      if (r) {
        sendResults.push(r);
        if (r.accepted) messagesSent++;
      }
    }

    const anyAccepted = sendResults.some((r) => r.accepted);
    if (anyAccepted) {
      await supabase.from("journey_enrollments")
        .update({
          status: "pending_delivery",
          next_action_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", enrollment.id);
    } else {
      const currentRetries = enrollment.retry_count || 0;
      if (currentRetries < MAX_RETRIES) {
        await supabase.from("journey_enrollments")
          .update({
            status: "active",
            retry_count: currentRetries + 1,
            next_action_at: new Date(Date.now() + RETRY_BACKOFF_MS).toISOString(),
          })
          .eq("id", enrollment.id);
        // Clear failed claims so retry can re-attempt
        await supabase.from("journey_message_log")
          .delete()
          .eq("enrollment_id", enrollment.id)
          .eq("node_id", currentNode.id)
          .eq("delivery_status", "failed");
      } else {
        await supabase.from("journey_enrollments")
          .update({ status: "failed" })
          .eq("id", enrollment.id);
      }
    }
    return { processed: true, sent: messagesSent };
  }

  if (nodeType === "decision") {
    const condition = currentNode.data?.condition || "opened";
    const { data: events } = await supabase
      .from("journey_contact_events")
      .select("id")
      .eq("contact_id", enrollment.contact_id)
      .eq("event_type", condition)
      .limit(1);
    const hasEvent = events && events.length > 0;
    const handleId = hasEvent ? "yes" : "no";
    const nextEdge = canvas.edges.find(
      (e: any) => e.source === currentNode.id && (e.sourceHandle === handleId || (!e.sourceHandle && hasEvent))
    );
    if (nextEdge) {
      await supabase.from("journey_enrollments")
        .update({ current_node_id: nextEdge.target, next_action_at: new Date().toISOString() })
        .eq("id", enrollment.id);
    }
    return { processed: true, sent: 0 };
  }

  // Entry -> advance and immediately process the next node in the same run.
  const nextEdge = canvas.edges.find((e: any) => e.source === currentNode.id);
  if (nextEdge) {
    await supabase.from("journey_enrollments")
      .update({ current_node_id: nextEdge.target, next_action_at: new Date().toISOString() })
      .eq("id", enrollment.id);
    if (nodeType === "entry") {
      return processEnrollment(
        { ...enrollment, current_node_id: nextEdge.target, next_action_at: new Date().toISOString() },
        journey,
        canvas,
        ctx,
      );
    }
  }
  return { processed: true, sent: 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Optional body — when invoked from journey-actions/activate we get a journey_id
    // so we can skip the schedule sweep and target a single journey.
    let targetJourneyId: string | null = null;
    let trigger: string = "cron";
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (body && typeof body === "object") {
          targetJourneyId = body.journey_id || null;
          trigger = body.trigger || "cron";
        }
      }
    } catch { /* no body — cron call */ }

    // Step 1: Schedule sweep — only on cron-style runs
    let sweep = { triggered: 0, errors: [] as string[] };
    if (!targetJourneyId) {
      sweep = await runScheduleSweep(supabase);
      console.log(`scheduled_runs_triggered: ${sweep.triggered}`);
    } else {
      console.log(`[process-journeys] targeted run: journey=${targetJourneyId} trigger=${trigger}`);
    }

    const { data: cfg } = await supabase
      .from("whatsapp_config")
      .select("sender_number, sms_sender_number")
      .limit(1)
      .maybeSingle();
    let fromNumber: string | null = cfg?.sender_number || null;
    if (!fromNumber) {
      const envFrom = Deno.env.get("WHATSAPP_FROM_NUMBER");
      if (envFrom && /^\+[1-9]\d{1,14}$/.test(envFrom)) fromNumber = envFrom;
    }
    const smsFromNumber: string | null =
      cfg?.sms_sender_number || cfg?.sender_number || Deno.env.get("TWILIO_SMS_FROM") || null;

    let activeJourneysQuery = supabase.from("journeys").select("*").eq("status", "active");
    if (targetJourneyId) activeJourneysQuery = activeJourneysQuery.eq("id", targetJourneyId);
    const { data: activeJourneys } = await activeJourneysQuery;

    if (!activeJourneys || activeJourneys.length === 0) {
      return new Response(JSON.stringify({ processed: 0, scheduled_runs_triggered: sweep.triggered, schedule_errors: sweep.errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctx: ProcessCtx = { supabase, supabaseUrl, serviceKey, fromNumber, smsFromNumber };
    let processed = 0;
    let messagesSent = 0;

    for (const journey of activeJourneys) {
      const canvas = journey.canvas_data as any;
      if (!canvas?.nodes || !canvas?.edges) continue;

      const { data: enrollments } = await supabase
        .from("journey_enrollments")
        .select("*, journey_contacts(*)")
        .eq("journey_id", journey.id)
        .eq("status", "active")
        .lte("next_action_at", new Date().toISOString());

      if (!enrollments || enrollments.length === 0) continue;

      console.log(
        `[process-journeys] journey=${journey.id} enrollments=${enrollments.length} batch_size=${ENROLLMENT_BATCH_SIZE}`,
      );

      // Parallel batched execution — respects Twilio rate limits while draining quickly.
      for (let i = 0; i < enrollments.length; i += ENROLLMENT_BATCH_SIZE) {
        const batch = enrollments.slice(i, i + ENROLLMENT_BATCH_SIZE);
        const results = await Promise.all(
          batch.map((e: any) =>
            processEnrollment(e, journey, canvas, ctx).catch((err: any) => {
              console.error(
                `[process-journeys] enrollment ${e.id} threw:`,
                err?.message || err,
              );
              return { processed: false, sent: 0 };
            }),
          ),
        );
        for (const r of results) {
          if (r.processed) processed++;
          messagesSent += r.sent;
        }
      }
    }

    return new Response(JSON.stringify({
      processed,
      messagesSent,
      scheduled_runs_triggered: sweep.triggered,
      schedule_errors: sweep.errors,
      target_journey_id: targetJourneyId,
      trigger,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("process-journeys error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
