// Per-entity field metadata for the List View builder.
// Each entity maps to a Supabase table with a curated list of filterable/selectable fields.

export type FieldType = "string" | "number" | "date" | "boolean" | "enum";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[]; // for enum
  recurring?: boolean; // date fields representing annual recurring events (birthdays, anniversaries)
}

export interface EntityDef {
  key: EntityKey;
  label: string;
  table: string;
  // Whether this entity can be used as a journey audience source
  isAudienceSource: boolean;
  // Field used to identify a contact (for audience entities)
  contactKey?: string;
  fields: FieldDef[];
}

export type EntityKey = "customers" | "leads" | "orders" | "revenue" | "products" | "items" | "schemes";

export const ENTITY_SCHEMAS: Record<EntityKey, EntityDef> = {
  customers: {
    key: "customers",
    label: "Customers",
    table: "customers",
    isAudienceSource: true,
    contactKey: "phone",
    fields: [
      { key: "id", label: "ID", type: "string" },
      { key: "customer_code", label: "Customer Code", type: "string" },
      { key: "name", label: "Name", type: "string" },
      { key: "phone", label: "Phone", type: "string" },
      { key: "email", label: "Email", type: "string" },
      { key: "tier", label: "Tier", type: "enum", options: ["bronze", "silver", "gold", "platinum"] },
      { key: "customer_segment", label: "Segment", type: "string" },
      { key: "loyalty_points", label: "Loyalty Points", type: "number" },
      { key: "store_credit", label: "Store Credit", type: "number" },
      { key: "total_orders", label: "Total Orders", type: "number" },
      { key: "total_spent", label: "Total Spent", type: "number" },
      { key: "city", label: "City", type: "string" },
      { key: "state", label: "State", type: "string" },
      { key: "country", label: "Country", type: "string" },
      { key: "date_of_birth", label: "Date of Birth", type: "date", recurring: true },
      { key: "anniversary_date", label: "Anniversary", type: "date", recurring: true },
      { key: "created_at", label: "Created Date", type: "date" },
    ],
  },
  leads: {
    key: "leads",
    label: "Leads",
    table: "leads",
    isAudienceSource: true,
    contactKey: "phone",
    fields: [
      { key: "id", label: "ID", type: "string" },
      { key: "name", label: "Name", type: "string" },
      { key: "phone", label: "Phone", type: "string" },
      { key: "email", label: "Email", type: "string" },
      { key: "city", label: "City", type: "string" },
      { key: "state", label: "State", type: "string" },
      { key: "country", label: "Country", type: "string" },
      { key: "address", label: "Address", type: "string" },
      { key: "is_converted", label: "Is Converted", type: "boolean" },
      { key: "converted_at", label: "Converted Date", type: "date" },
      { key: "created_at", label: "Created Date", type: "date" },
    ],
  },
  orders: {
    key: "orders",
    label: "Orders",
    table: "orders",
    isAudienceSource: true,
    contactKey: "customer_id",
    fields: [
      { key: "id", label: "ID", type: "string" },
      { key: "order_number", label: "Order Number", type: "string" },
      { key: "customer_id", label: "Customer ID", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "payment_status", label: "Payment Status", type: "string" },
      { key: "total_amount", label: "Total Amount", type: "number" },
      { key: "discount_amount", label: "Discount", type: "number" },
      { key: "tax_amount", label: "Tax", type: "number" },
      { key: "created_at", label: "Order Date", type: "date" },
    ],
  },
  revenue: {
    key: "revenue",
    label: "Revenue (Orders)",
    table: "orders",
    isAudienceSource: false,
    fields: [
      { key: "store_id", label: "Store", type: "string" },
      { key: "total_amount", label: "Revenue", type: "number" },
      { key: "status", label: "Status", type: "string" },
      { key: "created_at", label: "Date", type: "date" },
    ],
  },
  products: {
    key: "products",
    label: "Products",
    table: "products",
    isAudienceSource: false,
    fields: [
      { key: "id", label: "ID", type: "string" },
      { key: "name", label: "Name", type: "string" },
      { key: "sku", label: "SKU", type: "string" },
      { key: "category", label: "Category", type: "string" },
      { key: "price", label: "Price", type: "number" },
      { key: "stock_quantity", label: "Stock", type: "number" },
      { key: "status", label: "Status", type: "string" },
      { key: "created_at", label: "Created", type: "date" },
    ],
  },
  items: {
    key: "items",
    label: "Inventory Items",
    table: "inventory_items",
    isAudienceSource: false,
    fields: [
      { key: "id", label: "ID", type: "string" },
      { key: "name", label: "Name", type: "string" },
      { key: "sku", label: "SKU", type: "string" },
      { key: "category", label: "Category", type: "string" },
      { key: "unit_price", label: "Unit Price", type: "number" },
      { key: "stock_quantity", label: "Stock", type: "number" },
      { key: "reorder_level", label: "Reorder Level", type: "number" },
      { key: "status", label: "Status", type: "string" },
    ],
  },
  schemes: {
    key: "schemes",
    label: "Schemes",
    table: "pos_schemes",
    isAudienceSource: false,
    fields: [
      { key: "id", label: "ID", type: "string" },
      { key: "name", label: "Name", type: "string" },
      { key: "scheme_type", label: "Type", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "start_date", label: "Start Date", type: "date" },
      { key: "end_date", label: "End Date", type: "date" },
      { key: "created_at", label: "Created", type: "date" },
    ],
  },
};

export const ENTITY_LIST: EntityDef[] = Object.values(ENTITY_SCHEMAS);

// Operators per type
export const OPERATORS_BY_TYPE: Record<FieldType, { value: string; label: string; needsValue: boolean }[]> = {
  string: [
    { value: "eq", label: "equals", needsValue: true },
    { value: "neq", label: "not equals", needsValue: true },
    { value: "ilike", label: "contains", needsValue: true },
    { value: "starts_with", label: "starts with", needsValue: true },
    { value: "is_null", label: "is empty", needsValue: false },
    { value: "is_not_null", label: "is not empty", needsValue: false },
  ],
  number: [
    { value: "eq", label: "=", needsValue: true },
    { value: "neq", label: "≠", needsValue: true },
    { value: "gt", label: ">", needsValue: true },
    { value: "gte", label: "≥", needsValue: true },
    { value: "lt", label: "<", needsValue: true },
    { value: "lte", label: "≤", needsValue: true },
  ],
  date: [
    { value: "eq", label: "on", needsValue: true },
    { value: "lt", label: "before", needsValue: true },
    { value: "gt", label: "after", needsValue: true },
    { value: "last_n_days", label: "in last N days", needsValue: true },
    { value: "next_n_days", label: "in next N days", needsValue: true },
    { value: "upcoming_anniversary_n_days", label: "upcoming in next N days (recurring)", needsValue: true },
  ],
  boolean: [
    { value: "is_true", label: "is true", needsValue: false },
    { value: "is_false", label: "is false", needsValue: false },
  ],
  enum: [
    { value: "eq", label: "equals", needsValue: true },
    { value: "neq", label: "not equals", needsValue: true },
  ],
};

export interface FilterCondition {
  field: string;
  operator: string;
  value?: string | number | null;
}
