/**
 * Asset Type Template Configuration
 * 
 * Controls which fields are visible in the Asset Master form's Basic tab.
 * This is a UI-only concern — all fields remain in the data model regardless of template.
 * 
 * Always-visible fields (never template-controlled):
 *   Asset Type, Asset Name, Category Type.
 * 
 * All other Basic-tab fields are template-driven.
 */

export const ASSET_TYPE_OPTIONS = [
  { value: "electronics", label: "Electronics" },
  { value: "refrigeration", label: "Refrigeration" },
  { value: "furniture", label: "Furniture" },
  { value: "fixtures", label: "Fixtures" },
  { value: "it_equipment", label: "IT Equipment" },
  { value: "vehicles", label: "Vehicles" },
  { value: "consumables", label: "Consumables" },
  { value: "general", label: "General" },
] as const;

export type AssetTypeValue = (typeof ASSET_TYPE_OPTIONS)[number]["value"];

/** Field keys that can be toggled per template */
export type TemplateFieldKey =
  // Identity / Brand
  | "brand"
  | "model"
  | "manufacturer"
  // Material & Finish (Furniture / Fixtures)
  | "material"
  | "finish_color"
  | "load_capacity"
  // Technical specs
  | "power_consumption_watts"
  | "voltage_requirement"
  | "energy_rating"
  | "capacity"
  // Refrigeration-specific
  | "temperature_range"
  | "refrigerant_type"
  // Physical
  | "weight_kg"
  | "dimensions_cm"
  // Identifiers
  | "sku"
  | "upc_barcode"
  | "hsn_code"
  // Classification
  | "criticality"
  | "investment_size"
  // Pricing & Defaults
  | "standard_price"
  | "currency"
  | "unit_of_measure"
  | "vendor"
  | "oem"
  | "asset_status"
  | "service_engagement"
  | "purchase_date"
  // Other
  | "description";

/** All possible template field keys (used for "General" = show everything) */
const ALL_FIELDS: TemplateFieldKey[] = [
  "brand", "model", "manufacturer",
  "material", "finish_color", "load_capacity",
  "power_consumption_watts", "voltage_requirement", "energy_rating",
  "capacity",
  "temperature_range", "refrigerant_type",
  "weight_kg", "dimensions_cm",
  "sku", "upc_barcode", "hsn_code",
  "criticality", "investment_size",
  "standard_price", "currency", "unit_of_measure",
  "vendor", "oem", "asset_status", "service_engagement", "purchase_date",
  "description",
];

/** Common "operational" fields shared by most types (not consumables) */
const COMMON_OPS: TemplateFieldKey[] = [
  "standard_price", "currency", "unit_of_measure",
  "vendor", "oem", "asset_status", "service_engagement", "purchase_date",
  "description",
];

/** Mapping from asset_type value → visible template-specific field keys */
const TEMPLATE_FIELDS: Record<AssetTypeValue, TemplateFieldKey[]> = {
  electronics: [
    "brand", "model", "manufacturer",
    "power_consumption_watts", "voltage_requirement", "energy_rating",
    "weight_kg", "dimensions_cm",
    "sku", "upc_barcode", "hsn_code",
    "criticality", "investment_size",
    ...COMMON_OPS,
  ],
  refrigeration: [
    "brand", "model", "manufacturer",
    "power_consumption_watts", "voltage_requirement", "energy_rating",
    "temperature_range", "capacity", "refrigerant_type",
    "weight_kg", "dimensions_cm",
    "sku", "upc_barcode", "hsn_code",
    "criticality", "investment_size",
    ...COMMON_OPS,
  ],
  furniture: [
    "brand", "manufacturer",
    "material", "finish_color",
    "weight_kg", "dimensions_cm",
    "criticality",
    ...COMMON_OPS,
  ],
  fixtures: [
    "brand", "manufacturer",
    "material", "finish_color", "load_capacity",
    "power_consumption_watts", "voltage_requirement",
    "weight_kg", "dimensions_cm",
    "criticality",
    ...COMMON_OPS,
  ],
  it_equipment: [
    "brand", "model", "manufacturer",
    "power_consumption_watts", "voltage_requirement",
    "capacity",
    "weight_kg", "dimensions_cm",
    "sku", "upc_barcode", "hsn_code",
    "criticality", "investment_size",
    ...COMMON_OPS,
  ],
  vehicles: [
    "brand", "model", "manufacturer",
    "capacity", "weight_kg", "dimensions_cm",
    "sku", "hsn_code",
    "criticality", "investment_size",
    ...COMMON_OPS,
  ],
  consumables: [
    "unit_of_measure", "vendor", "standard_price",
  ],
  general: ALL_FIELDS,
};

/**
 * Returns the set of visible template-specific field keys for a given asset type.
 * If assetType is null/undefined, defaults to "general" (all fields visible).
 */
export function getVisibleFields(assetType: string | null | undefined): Set<TemplateFieldKey> {
  const key = (assetType || "general") as AssetTypeValue;
  const fields = TEMPLATE_FIELDS[key] ?? ALL_FIELDS;
  return new Set(fields);
}

/**
 * Returns a human-readable label for an asset_type value.
 */
export function getAssetTypeLabel(assetType: string | null | undefined): string {
  if (!assetType) return "General";
  const opt = ASSET_TYPE_OPTIONS.find((o) => o.value === assetType);
  return opt?.label ?? assetType;
}
