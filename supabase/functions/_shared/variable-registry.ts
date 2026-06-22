// ---------------------------------------------------------------------------
// Backend mirror of src/lib/variables/registry.ts.
//
// Keep the `TOKEN_SOURCES` table in this file in lockstep with the frontend
// registry. A Deno test (variable-registry.test.ts) compares the two and
// fails the build if they drift.
// ---------------------------------------------------------------------------

export type VariableSource =
  | { kind: "contact"; field: string }
  | { kind: "customer"; field: string; format?: "date" | "number" }
  | { kind: "last_order"; field: string; format?: "date" | "number" }
  | { kind: "journey"; field: string }
  | { kind: "static"; value: string };

export const TOKEN_SOURCES: Record<string, VariableSource> = {
  // Customer / Name
  customer_name: { kind: "customer", field: "name" },
  customer_first_name: { kind: "customer", field: "__first_name" },
  customer_last_name: { kind: "customer", field: "__last_name" },
  customer_company_name: { kind: "customer", field: "company_name" },
  // Customer / Contact
  phone_number: { kind: "contact", field: "phone" },
  customer_whatsapp: { kind: "customer", field: "whatsapp_number" },
  email: { kind: "contact", field: "email" },
  customer_alt_contact: { kind: "customer", field: "alternate_phone" },
  // Customer / Date
  customer_date_of_birth: { kind: "customer", field: "date_of_birth", format: "date" },
  customer_created_date: { kind: "customer", field: "created_at", format: "date" },
  customer_updated_date: { kind: "customer", field: "updated_at", format: "date" },
  customer_last_order_date: { kind: "last_order", field: "created_at", format: "date" },
  customer_anniversary: { kind: "customer", field: "anniversary_date", format: "date" },
  // Customer / Address
  customer_city: { kind: "customer", field: "city" },
  customer_state: { kind: "customer", field: "state" },
  customer_pincode: { kind: "customer", field: "pincode" },
  customer_country: { kind: "customer", field: "country" },
  // Customer / Financial
  customer_outstanding: { kind: "customer", field: "outstanding_amount", format: "number" },
  customer_credit_limit: { kind: "customer", field: "credit_limit", format: "number" },
  customer_total_purchase: { kind: "customer", field: "total_spent", format: "number" },
  // Customer / Order summary
  customer_last_order_amount: { kind: "last_order", field: "total_amount", format: "number" },
  customer_total_orders: { kind: "customer", field: "total_orders", format: "number" },
  // Order
  order_id: { kind: "last_order", field: "order_number" },
  order_status: { kind: "last_order", field: "status" },
  order_date: { kind: "last_order", field: "created_at", format: "date" },
  order_delivery_date: { kind: "last_order", field: "delivery_date", format: "date" },
  order_total: { kind: "last_order", field: "total_amount", format: "number" },
  order_tax: { kind: "last_order", field: "tax_amount", format: "number" },
  order_discount: { kind: "last_order", field: "discount_amount", format: "number" },
  // Journey
  journey_name: { kind: "journey", field: "name" },
};

export const ENRICHABLE_TOKENS: Set<string> = new Set(
  Object.entries(TOKEN_SOURCES)
    .filter(([, s]) => s.kind === "customer" || s.kind === "last_order")
    .map(([k]) => k),
);

export function needsCustomerJoin(tokens: Set<string>): boolean {
  for (const t of tokens) {
    const s = TOKEN_SOURCES[t];
    if (s && (s.kind === "customer" || s.kind === "last_order")) return true;
  }
  return false;
}

export function needsOrderJoin(tokens: Set<string>): boolean {
  for (const t of tokens) {
    const s = TOKEN_SOURCES[t];
    if (s && s.kind === "last_order") return true;
  }
  return false;
}

function fmtDate(raw: unknown): string {
  if (raw == null || raw === "") return "";
  const d = new Date(String(raw));
  if (isNaN(d.getTime())) return String(raw);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${dd} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function fmtValue(raw: unknown, format?: "date" | "number"): string {
  if (raw == null) return "";
  if (format === "date") return fmtDate(raw);
  if (format === "number") return String(raw);
  return String(raw);
}

/**
 * Read a single field from a source row, honouring the registry's `format`
 * and the special `__first_name` / `__last_name` derived fields.
 */
export function readSourceField(row: any, source: VariableSource): string {
  if (!row) return "";
  if (source.kind === "static") return source.value;
  if (source.kind === "customer" || source.kind === "last_order") {
    if (source.field === "__first_name" || source.field === "__last_name") {
      const name = String(row.name || "").trim();
      const [first, ...rest] = name.split(/\s+/);
      return source.field === "__first_name" ? (first || "") : rest.join(" ");
    }
    return fmtValue(row[source.field], (source as any).format);
  }
  if (source.kind === "contact" || source.kind === "journey") {
    return fmtValue(row[source.field]);
  }
  return "";
}