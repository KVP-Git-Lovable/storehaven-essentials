// Pure cost-math helpers for Journey Cost Analytics.
// No side effects, no Supabase calls — feed it raw rows and config.

export type Category = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type ServiceWindow = "inside" | "outside" | "n_a";

export interface PricingRow {
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION" | "FAILED_FEE";
  service_window: ServiceWindow;
  meta_fee_usd: number;
  twilio_fee_usd: number;
}

export interface PricingTable {
  rows: PricingRow[];
  fxRate: number; // USD -> INR
}

const SUCCESS_DELIVERED = new Set(["delivered"]);
const FAILED = new Set(["failed", "undelivered"]);

export function totalUsd(row: PricingRow): number {
  return Number(row.meta_fee_usd || 0) + Number(row.twilio_fee_usd || 0);
}

export function getRate(
  table: PricingTable,
  category: PricingRow["category"],
  win: ServiceWindow,
): number {
  const r =
    table.rows.find((x) => x.category === category && x.service_window === win) ||
    table.rows.find((x) => x.category === category);
  return r ? totalUsd(r) : 0;
}

export const failedFeeUsd = (t: PricingTable) => getRate(t, "FAILED_FEE", "n_a");

export interface MessageRow {
  status: string | null;
  delivery_status: string | null;
  category: Category | null;
  in_window: boolean;
  node_id: string | null;
}

export interface StepBreakdown {
  node_id: string;
  label: string;
  category: Category | null;
  delivered: number;
  failed: number;
  in_window_delivered: number;
  out_window_delivered: number;
  actual_usd: number;
}

export interface ActualResult {
  totalUsd: number;
  delivered: number;
  failed: number;
  byCategory: Record<Category, { count: number; usd: number }>;
  byStep: Record<string, StepBreakdown>;
}

const ZERO = (): Record<Category, { count: number; usd: number }> => ({
  MARKETING: { count: 0, usd: 0 },
  UTILITY: { count: 0, usd: 0 },
  AUTHENTICATION: { count: 0, usd: 0 },
});

export function computeActual(messages: MessageRow[], pricing: PricingTable): ActualResult {
  const byCategory = ZERO();
  const byStep: Record<string, StepBreakdown> = {};
  let totalUsd = 0;
  let delivered = 0;
  let failed = 0;

  const failFee = failedFeeUsd(pricing);

  for (const m of messages) {
    const stepId = m.node_id || "_unknown";
    if (!byStep[stepId]) {
      byStep[stepId] = {
        node_id: stepId,
        label: "",
        category: m.category,
        delivered: 0,
        failed: 0,
        in_window_delivered: 0,
        out_window_delivered: 0,
        actual_usd: 0,
      };
    }
    const step = byStep[stepId];
    const isDelivered =
      SUCCESS_DELIVERED.has(String(m.delivery_status || "")) ||
      SUCCESS_DELIVERED.has(String(m.status || ""));
    const isFailed = FAILED.has(String(m.status || "")) || FAILED.has(String(m.delivery_status || ""));

    if (isDelivered && m.category) {
      const win: ServiceWindow =
        m.category === "MARKETING" ? "n_a" : m.in_window ? "inside" : "outside";
      const usd = getRate(pricing, m.category, win);
      totalUsd += usd;
      delivered += 1;
      byCategory[m.category].count += 1;
      byCategory[m.category].usd += usd;
      step.delivered += 1;
      step.actual_usd += usd;
      if (m.category !== "MARKETING") {
        if (m.in_window) step.in_window_delivered += 1;
        else step.out_window_delivered += 1;
      }
    } else if (isFailed) {
      totalUsd += failFee;
      failed += 1;
      step.failed += 1;
      step.actual_usd += failFee;
    }
  }

  return { totalUsd, delivered, failed, byCategory, byStep };
}

export interface ProjectedStep {
  node_id: string;
  label: string;
  category: Category;
  recipients: number;
}

export function computeProjected(
  steps: ProjectedStep[],
  pricing: PricingTable,
  inWindowPct: number,
): { totalUsd: number; byCategory: Record<Category, { count: number; usd: number }>; byStep: Record<string, number> } {
  const byCategory = ZERO();
  const byStep: Record<string, number> = {};
  let totalUsd = 0;
  const pct = Math.max(0, Math.min(100, inWindowPct)) / 100;

  for (const s of steps) {
    let usd = 0;
    if (s.category === "MARKETING") {
      usd = getRate(pricing, "MARKETING", "n_a") * s.recipients;
    } else {
      const inN = Math.round(s.recipients * pct);
      const outN = s.recipients - inN;
      usd =
        getRate(pricing, s.category, "inside") * inN +
        getRate(pricing, s.category, "outside") * outN;
    }
    byStep[s.node_id] = usd;
    byCategory[s.category].count += s.recipients;
    byCategory[s.category].usd += usd;
    totalUsd += usd;
  }

  return { totalUsd, byCategory, byStep };
}

export function fmtINR(usd: number, fx: number): string {
  const inr = usd * fx;
  return inr.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}

export function fmtUSD(usd: number): string {
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const CATEGORY_BADGE: Record<Category, string> = {
  MARKETING: "bg-orange-100 text-orange-800 border-orange-300",
  UTILITY: "bg-blue-100 text-blue-800 border-blue-300",
  AUTHENTICATION: "bg-green-100 text-green-800 border-green-300",
};