// WhatsApp Template Variable Registry
// Friendly named variables that get auto-mapped to Twilio's {{1}}, {{2}} format on submit.

export const VARIABLE_GROUPS: Record<string, string[]> = {
  Order: ["order_id", "order_status", "order_date", "order_total"],
  Customer: ["customer_name", "phone_number", "email"],
  Product: ["product_name", "quantity", "price"],
  Store: ["store_name", "store_address"],
};

export const ALL_VARIABLES = Object.values(VARIABLE_GROUPS).flat();

// ---------------------------------------------------------------------------
// Hierarchical registry used by the 3-step Insert Variable picker.
// Entity -> Category -> Variables. Tokens use the same friendly underscore
// convention so the existing parser / Twilio numeric remap keeps working.
// ---------------------------------------------------------------------------
export type VariableLeaf = { name: string; label: string };
export type VariableCategory = { key: string; label: string; variables: VariableLeaf[] };
export type VariableEntity = { key: string; label: string; categories: VariableCategory[] };

export const VARIABLE_REGISTRY: VariableEntity[] = [
  {
    key: "customer",
    label: "Customer",
    categories: [
      { key: "name", label: "Name Fields", variables: [
        { name: "customer_name", label: "Full Name" },
        { name: "customer_first_name", label: "First Name" },
        { name: "customer_last_name", label: "Last Name" },
        { name: "customer_company_name", label: "Company Name" },
      ]},
      { key: "contact", label: "Contact Fields", variables: [
        { name: "phone_number", label: "Phone" },
        { name: "customer_whatsapp", label: "WhatsApp Number" },
        { name: "email", label: "Email" },
        { name: "customer_alt_contact", label: "Alternate Contact" },
      ]},
      { key: "date", label: "Date Fields", variables: [
        { name: "customer_created_date", label: "Created Date" },
        { name: "customer_updated_date", label: "Updated Date" },
        { name: "customer_last_order_date", label: "Last Order Date" },
        { name: "customer_dob", label: "Date of Birth" },
        { name: "customer_anniversary", label: "Anniversary" },
      ]},
      { key: "address", label: "Address Fields", variables: [
        { name: "customer_city", label: "City" },
        { name: "customer_state", label: "State" },
        { name: "customer_pincode", label: "Pincode" },
        { name: "customer_country", label: "Country" },
      ]},
      { key: "financial", label: "Financial Fields", variables: [
        { name: "customer_outstanding", label: "Outstanding Amount" },
        { name: "customer_credit_limit", label: "Credit Limit" },
        { name: "customer_total_purchase", label: "Total Purchase Value" },
      ]},
      { key: "order", label: "Order Fields", variables: [
        { name: "customer_last_order_amount", label: "Last Order Amount" },
        { name: "customer_last_order_date", label: "Last Order Date" },
        { name: "customer_total_orders", label: "Total Orders" },
      ]},
    ],
  },
  {
    key: "lead",
    label: "Lead",
    categories: [
      { key: "name", label: "Name Fields", variables: [
        { name: "lead_name", label: "Full Name" },
        { name: "lead_first_name", label: "First Name" },
        { name: "lead_last_name", label: "Last Name" },
      ]},
      { key: "contact", label: "Contact Fields", variables: [
        { name: "lead_phone", label: "Phone" },
        { name: "lead_email", label: "Email" },
      ]},
      { key: "date", label: "Date Fields", variables: [
        { name: "lead_created_date", label: "Created Date" },
        { name: "lead_last_contacted", label: "Last Contacted" },
      ]},
      { key: "address", label: "Address Fields", variables: [
        { name: "lead_city", label: "City" },
        { name: "lead_state", label: "State" },
      ]},
    ],
  },
  {
    key: "visitor",
    label: "Visitor",
    categories: [
      { key: "name", label: "Name Fields", variables: [
        { name: "visitor_name", label: "Name" },
      ]},
      { key: "contact", label: "Contact Fields", variables: [
        { name: "visitor_phone", label: "Phone" },
        { name: "visitor_email", label: "Email" },
      ]},
      { key: "date", label: "Date Fields", variables: [
        { name: "visitor_visit_date", label: "Visit Date" },
      ]},
    ],
  },
  {
    key: "order",
    label: "Order",
    categories: [
      { key: "identity", label: "Identity Fields", variables: [
        { name: "order_id", label: "Order ID" },
        { name: "order_status", label: "Status" },
      ]},
      { key: "date", label: "Date Fields", variables: [
        { name: "order_date", label: "Order Date" },
        { name: "order_delivery_date", label: "Delivery Date" },
      ]},
      { key: "financial", label: "Financial Fields", variables: [
        { name: "order_total", label: "Order Total" },
        { name: "order_tax", label: "Tax" },
        { name: "order_discount", label: "Discount" },
      ]},
    ],
  },
  {
    key: "order_item",
    label: "Order Item",
    categories: [
      { key: "product", label: "Product Fields", variables: [
        { name: "item_product_name", label: "Product Name" },
        { name: "item_sku", label: "SKU" },
      ]},
      { key: "financial", label: "Financial Fields", variables: [
        { name: "item_quantity", label: "Quantity" },
        { name: "item_price", label: "Price" },
        { name: "item_subtotal", label: "Subtotal" },
      ]},
    ],
  },
  {
    key: "product",
    label: "Product",
    categories: [
      { key: "name", label: "Name Fields", variables: [
        { name: "product_name", label: "Product Name" },
        { name: "product_sku", label: "SKU" },
      ]},
      { key: "financial", label: "Financial Fields", variables: [
        { name: "price", label: "Price" },
        { name: "product_mrp", label: "MRP" },
      ]},
    ],
  },
  {
    key: "retailer",
    label: "Retailer",
    categories: [
      { key: "name", label: "Name Fields", variables: [
        { name: "retailer_name", label: "Retailer Name" },
        { name: "retailer_code", label: "Retailer Code" },
      ]},
      { key: "contact", label: "Contact Fields", variables: [
        { name: "retailer_phone", label: "Phone" },
        { name: "retailer_email", label: "Email" },
      ]},
      { key: "address", label: "Address Fields", variables: [
        { name: "retailer_city", label: "City" },
        { name: "retailer_state", label: "State" },
      ]},
    ],
  },
  {
    key: "employee",
    label: "Employee",
    categories: [
      { key: "name", label: "Name Fields", variables: [
        { name: "employee_name", label: "Name" },
        { name: "employee_code", label: "Employee Code" },
      ]},
      { key: "contact", label: "Contact Fields", variables: [
        { name: "employee_phone", label: "Phone" },
        { name: "employee_email", label: "Email" },
      ]},
    ],
  },
  {
    key: "store",
    label: "Store",
    categories: [
      { key: "identity", label: "Identity Fields", variables: [
        { name: "store_name", label: "Store Name" },
        { name: "store_code", label: "Store Code" },
      ]},
      { key: "address", label: "Address Fields", variables: [
        { name: "store_address", label: "Address" },
        { name: "store_city", label: "City" },
      ]},
      { key: "contact", label: "Contact Fields", variables: [
        { name: "store_phone", label: "Phone" },
      ]},
    ],
  },
  {
    key: "journey",
    label: "Journey",
    categories: [
      { key: "identity", label: "Identity Fields", variables: [
        { name: "journey_name", label: "Journey Name" },
      ]},
      { key: "date", label: "Date Fields", variables: [
        { name: "journey_started_at", label: "Started At" },
      ]},
    ],
  },
  {
    key: "journey_event",
    label: "Journey Event",
    categories: [
      { key: "identity", label: "Identity Fields", variables: [
        { name: "event_name", label: "Event Name" },
        { name: "event_step", label: "Step" },
      ]},
      { key: "date", label: "Date Fields", variables: [
        { name: "event_timestamp", label: "Timestamp" },
      ]},
    ],
  },
];

export const MARKER_REGEX = /\n?<!--vars:(\{[^}]*\})-->/;

/**
 * Extract friendly variable names (in order of first appearance) from a body.
 * Returns ["customer_name", "order_id"] for "Hello {{customer_name}}, order {{order_id}}".
 * Numeric placeholders ({{1}}) are ignored.
 */
export function extractFriendlyVariables(body: string): string[] {
  const matches = body.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g);
  const seen: string[] = [];
  for (const m of matches) {
    if (!seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
}

/**
 * Convert a friendly body to Twilio numeric format and return the mapping.
 * "Hello {{customer_name}}, order {{order_id}}"
 *  -> { twilioBody: "Hello {{1}}, order {{2}}", mapping: { "1": "customer_name", "2": "order_id" } }
 */
export function transformFriendlyToTwilio(body: string): {
  twilioBody: string;
  mapping: Record<string, string>;
} {
  const vars = extractFriendlyVariables(body);
  const mapping: Record<string, string> = {};
  let twilioBody = body;
  vars.forEach((name, idx) => {
    const num = String(idx + 1);
    mapping[num] = name;
    twilioBody = twilioBody.split(`{{${name}}}`).join(`{{${num}}}`);
  });
  return { twilioBody, mapping };
}

/**
 * Convert a numeric Twilio body back to friendly using a mapping.
 */
export function transformTwilioToFriendly(
  body: string,
  mapping: Record<string, string>
): string {
  let result = body;
  Object.entries(mapping).forEach(([num, name]) => {
    result = result.split(`{{${num}}}`).join(`{{${name}}}`);
  });
  return result;
}

/**
 * Build the full body to store in DB: numeric Twilio body + hidden mapping marker.
 */
export function buildStoredBody(friendlyBody: string): {
  storedBody: string;
  twilioBody: string;
  mapping: Record<string, string>;
} {
  const { twilioBody, mapping } = transformFriendlyToTwilio(friendlyBody);
  const hasMapping = Object.keys(mapping).length > 0;
  const storedBody = hasMapping
    ? `${twilioBody}\n<!--vars:${JSON.stringify(mapping)}-->`
    : twilioBody;
  return { storedBody, twilioBody, mapping };
}

/**
 * Parse a stored body: extract clean Twilio body and mapping (if marker present).
 */
export function parseStoredBody(stored: string): {
  twilioBody: string;
  mapping: Record<string, string> | null;
} {
  const match = stored.match(MARKER_REGEX);
  if (!match) return { twilioBody: stored, mapping: null };
  try {
    const mapping = JSON.parse(match[1]) as Record<string, string>;
    const twilioBody = stored.replace(MARKER_REGEX, "").trimEnd();
    return { twilioBody, mapping };
  } catch {
    return { twilioBody: stored.replace(MARKER_REGEX, "").trimEnd(), mapping: null };
  }
}

/**
 * Strip the hidden marker line — used server-side before sending to Twilio.
 */
export function stripMarker(body: string): string {
  return body.replace(MARKER_REGEX, "").trimEnd();
}

/**
 * Validation result for a friendly body.
 */
export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  variables: string[];
}

export function validateFriendlyBody(body: string): ValidationResult {
  const warnings: string[] = [];
  const variables = extractFriendlyVariables(body);

  // Check for malformed placeholders e.g. {{ }} or {{1abc}}
  const allPlaceholders = body.match(/\{\{[^}]*\}\}/g) || [];
  for (const ph of allPlaceholders) {
    const inner = ph.slice(2, -2).trim();
    if (!inner) {
      warnings.push("Empty placeholder {{}} found");
    } else if (/^\d+$/.test(inner)) {
      warnings.push(`Numeric placeholder {{${inner}}} found — use named variables instead`);
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(inner)) {
      warnings.push(`Malformed variable: {{${inner}}}`);
    }
  }

  return { valid: warnings.length === 0, warnings, variables };
}
