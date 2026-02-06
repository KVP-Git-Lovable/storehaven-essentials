/**
 * Asset Type Template Configuration
 * 
 * Controls which template-specific fields are visible in the Asset Master form's Basic tab.
 * This is a UI-only concern — all fields remain in the data model regardless of template.
 * 
 * Common fields (always visible for ALL templates):
 *   Asset Name, Category Type, Criticality, Investment Size, Asset Value, Currency,
 *   Unit of Measure, Vendor, OEM, Asset Status, Service Engagement, Purchase Date, Description.
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
  | "brand"
  | "model"
  | "manufacturer"
  | "power_consumption_watts"
  | "voltage_requirement"
  | "energy_rating"
  | "capacity"
  | "weight_kg"
  | "dimensions_cm"
  | "sku"
  | "upc_barcode"
  | "hsn_code"
  | "temperature_range"
  | "refrigerant_type";

/** All possible template field keys (used for "General" = show everything) */
const ALL_FIELDS: TemplateFieldKey[] = [
  "brand",
  "model",
  "manufacturer",
  "power_consumption_watts",
  "voltage_requirement",
  "energy_rating",
  "capacity",
  "weight_kg",
  "dimensions_cm",
  "sku",
  "upc_barcode",
  "hsn_code",
  "temperature_range",
  "refrigerant_type",
];

/** Mapping from asset_type value → visible template-specific field keys */
const TEMPLATE_FIELDS: Record<AssetTypeValue, TemplateFieldKey[]> = {
  electronics: [
    "brand", "model", "manufacturer",
    "power_consumption_watts", "voltage_requirement", "energy_rating",
    "capacity", "weight_kg", "dimensions_cm",
    "sku", "upc_barcode", "hsn_code",
  ],
  refrigeration: [
    "brand", "model", "manufacturer",
    "power_consumption_watts", "voltage_requirement",
    "temperature_range", "capacity", "refrigerant_type", "energy_rating",
    "weight_kg", "dimensions_cm",
    "sku", "upc_barcode", "hsn_code",
  ],
  furniture: [
    "brand", "manufacturer",
    "weight_kg", "dimensions_cm",
    "sku", "hsn_code",
  ],
  fixtures: [
    "brand", "model", "manufacturer",
    "power_consumption_watts", "voltage_requirement",
    "weight_kg", "dimensions_cm",
    "sku", "hsn_code",
  ],
  it_equipment: [
    "brand", "model", "manufacturer",
    "power_consumption_watts", "voltage_requirement",
    "capacity",
    "sku", "upc_barcode", "hsn_code",
  ],
  vehicles: [
    "brand", "model", "manufacturer",
    "capacity", "weight_kg", "dimensions_cm",
    "sku", "hsn_code",
  ],
  consumables: [
    "brand", "manufacturer",
    "capacity", "weight_kg",
    "sku", "upc_barcode", "hsn_code",
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
