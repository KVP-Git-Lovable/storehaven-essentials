// ---------------------------------------------------------------------------
// Journey / WhatsApp Variable Registry — single source of truth (frontend).
//
// Each leaf declares HOW it resolves (source). The picker only shows leaves
// whose source.kind is supported by the backend resolver (see
// supabase/functions/_shared/variable-registry.ts). A parity test ensures
// the two registries stay in lockstep.
// ---------------------------------------------------------------------------

export type VariableSource =
  | { kind: "contact"; field: string }              // journey_contacts.<field>
  | { kind: "customer"; field: string; format?: "date" | "number" }
  | { kind: "last_order"; field: string; format?: "date" | "number" }
  | { kind: "journey"; field: string }
  | { kind: "static"; value: string }
  | { kind: "unimplemented" };                      // shown in registry but hidden from picker

export type VariableLeaf = {
  name: string;
  label: string;
  source: VariableSource;
};

export type VariableCategory = {
  key: string;
  label: string;
  variables: VariableLeaf[];
};

export type VariableEntity = {
  key: string;
  label: string;
  categories: VariableCategory[];
};

// Kinds the backend resolver currently implements. Update both this set AND
// supabase/functions/_shared/variable-registry.ts when adding a new kind.
export const RESOLVER_KINDS: ReadonlySet<VariableSource["kind"]> = new Set([
  "contact",
  "customer",
  "last_order",
  "journey",
  "static",
]);

export const VARIABLE_REGISTRY: VariableEntity[] = [
  {
    key: "customer",
    label: "Customer",
    categories: [
      { key: "name", label: "Name Fields", variables: [
        { name: "customer_name", label: "Full Name", source: { kind: "customer", field: "name" } },
        { name: "customer_first_name", label: "First Name", source: { kind: "customer", field: "__first_name" } },
        { name: "customer_last_name", label: "Last Name", source: { kind: "customer", field: "__last_name" } },
        { name: "customer_company_name", label: "Company Name", source: { kind: "customer", field: "company_name" } },
      ]},
      { key: "contact", label: "Contact Fields", variables: [
        { name: "phone_number", label: "Phone", source: { kind: "contact", field: "phone" } },
        { name: "customer_whatsapp", label: "WhatsApp Number", source: { kind: "customer", field: "whatsapp_number" } },
        { name: "email", label: "Email", source: { kind: "contact", field: "email" } },
        { name: "customer_alt_contact", label: "Alternate Contact", source: { kind: "customer", field: "alternate_phone" } },
      ]},
      { key: "date", label: "Date Fields", variables: [
        { name: "customer_created_date", label: "Created Date", source: { kind: "customer", field: "created_at", format: "date" } },
        { name: "customer_updated_date", label: "Updated Date", source: { kind: "customer", field: "updated_at", format: "date" } },
        { name: "customer_last_order_date", label: "Last Order Date", source: { kind: "last_order", field: "created_at", format: "date" } },
        { name: "customer_anniversary", label: "Anniversary", source: { kind: "customer", field: "anniversary_date", format: "date" } },
      ]},
      { key: "address", label: "Address Fields", variables: [
        { name: "customer_city", label: "City", source: { kind: "customer", field: "city" } },
        { name: "customer_state", label: "State", source: { kind: "customer", field: "state" } },
        { name: "customer_pincode", label: "Pincode", source: { kind: "customer", field: "pincode" } },
        { name: "customer_country", label: "Country", source: { kind: "customer", field: "country" } },
      ]},
      { key: "financial", label: "Financial Fields", variables: [
        { name: "customer_outstanding", label: "Outstanding Amount", source: { kind: "customer", field: "outstanding_amount", format: "number" } },
        { name: "customer_credit_limit", label: "Credit Limit", source: { kind: "customer", field: "credit_limit", format: "number" } },
        { name: "customer_total_purchase", label: "Total Purchase Value", source: { kind: "customer", field: "total_spent", format: "number" } },
      ]},
      { key: "order", label: "Order Fields", variables: [
        { name: "customer_last_order_amount", label: "Last Order Amount", source: { kind: "last_order", field: "total_amount", format: "number" } },
        { name: "customer_total_orders", label: "Total Orders", source: { kind: "customer", field: "total_orders", format: "number" } },
      ]},
    ],
  },
  {
    key: "order",
    label: "Order",
    categories: [
      { key: "identity", label: "Identity Fields", variables: [
        { name: "order_id", label: "Order ID", source: { kind: "last_order", field: "order_number" } },
        { name: "order_status", label: "Status", source: { kind: "last_order", field: "status" } },
      ]},
      { key: "date", label: "Date Fields", variables: [
        { name: "order_date", label: "Order Date", source: { kind: "last_order", field: "created_at", format: "date" } },
        { name: "order_delivery_date", label: "Delivery Date", source: { kind: "last_order", field: "delivery_date", format: "date" } },
      ]},
      { key: "financial", label: "Financial Fields", variables: [
        { name: "order_total", label: "Order Total", source: { kind: "last_order", field: "total_amount", format: "number" } },
        { name: "order_tax", label: "Tax", source: { kind: "last_order", field: "tax_amount", format: "number" } },
        { name: "order_discount", label: "Discount", source: { kind: "last_order", field: "discount_amount", format: "number" } },
      ]},
    ],
  },
  {
    key: "journey",
    label: "Journey",
    categories: [
      { key: "identity", label: "Identity Fields", variables: [
        { name: "journey_name", label: "Journey Name", source: { kind: "journey", field: "name" } },
      ]},
    ],
  },
];

/** All leaves that the backend can actually resolve — what the picker should show. */
export function getResolvableRegistry(): VariableEntity[] {
  const out: VariableEntity[] = [];
  for (const e of VARIABLE_REGISTRY) {
    const cats: VariableCategory[] = [];
    for (const c of e.categories) {
      const vars = c.variables.filter((v) => RESOLVER_KINDS.has(v.source.kind));
      if (vars.length) cats.push({ ...c, variables: vars });
    }
    if (cats.length) out.push({ ...e, categories: cats });
  }
  return out;
}

/** Flat list of all leaves (resolvable + not). */
export const ALL_LEAVES: VariableLeaf[] = VARIABLE_REGISTRY.flatMap((e) =>
  e.categories.flatMap((c) => c.variables),
);

/** Lookup table: token name -> source. Only includes resolvable tokens. */
export const TOKEN_SOURCE_MAP: Record<string, VariableSource> = Object.fromEntries(
  ALL_LEAVES
    .filter((v) => RESOLVER_KINDS.has(v.source.kind))
    .map((v) => [v.name, v.source]),
);