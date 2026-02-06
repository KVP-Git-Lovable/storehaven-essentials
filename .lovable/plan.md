

# Template-Based Dynamic Fields for Asset Master

## Overview
Add an "Asset Type" selector to the Asset Master form that controls which fields are visible in the UI. This is a **UI-only change** -- the database schema, data model, and all auto-fill bindings with the Asset Register remain completely untouched.

## What Changes
- A new `asset_type` column will be added to the `asset_masters` database table (nullable, default null) to persist the selected template
- The Asset Master form dialog will show a new "Asset Type" dropdown as the first field
- Based on the selected type, only relevant fields will be rendered in the Basic tab
- The Lifecycle, Compliance, and Documents tabs remain unchanged (they are universal)
- All existing fields remain in the data model and schema -- hidden fields are simply not shown in the form

## What Does NOT Change
- The `asset_masters` table structure (no columns removed or renamed)
- The Asset Register form and its auto-fill logic (reads from the same columns as before)
- The Asset Master Details page (will show all populated fields regardless of template)
- Any other module bindings (Service Tickets, Preventive Maintenance, Dashboards, etc.)

## Asset Type Templates

| Template | Visible Fields (Basic Tab) |
|----------|---------------------------|
| **Electronics** | Brand, Model, Manufacturer, Power Consumption, Voltage, Energy Rating, Capacity, Weight, Dimensions, SKU, UPC/Barcode, HSN Code |
| **Refrigeration** | Brand, Model, Manufacturer, Power Consumption, Voltage, Temperature Range, Capacity, Refrigerant Type, Energy Rating, Weight, Dimensions, SKU, UPC/Barcode, HSN Code |
| **Furniture** | Brand, Manufacturer, Weight, Dimensions, SKU, HSN Code |
| **Fixtures** | Brand, Model, Manufacturer, Power Consumption, Voltage, Weight, Dimensions, SKU, HSN Code |
| **IT Equipment** | Brand, Model, Manufacturer, Power Consumption, Voltage, Capacity, SKU, UPC/Barcode, HSN Code |
| **Vehicles** | Brand, Model, Manufacturer, Capacity, Weight, Dimensions, SKU, HSN Code |
| **Consumables** | Brand, Manufacturer, Capacity, Weight, SKU, UPC/Barcode, HSN Code |
| **General** | All fields visible (current behavior, used as fallback) |

Common fields shown for ALL templates: Asset Name, Category Type, Criticality, Investment Size, Asset Value, Currency, Unit of Measure, Vendor, OEM, Asset Status, Service Engagement, Purchase Date, Description.

## Technical Details

### 1. Database Migration
Add a single nullable column to `asset_masters`:
```sql
ALTER TABLE public.asset_masters 
ADD COLUMN asset_type text DEFAULT NULL;
```
No constraints needed -- this is a UI hint, not a structural element.

### 2. AssetMasterFormDialog.tsx Changes

**New template configuration** (defined as a constant object):
- A mapping from each `asset_type` value to an array of field keys that should be visible
- A "General" type that includes all fields (backward-compatible default)

**New state/form field**:
- Add `asset_type` to the Zod schema (optional string)
- Add it as the first field in the Basic tab, rendered as a Select dropdown
- When the user selects a type, a helper function checks which fields are in that template's visibility list

**Conditional rendering**:
- Each field group in the Basic tab will be wrapped in a visibility check: `if (visibleFields.includes('brand'))` -- render the brand field, otherwise skip it
- Fields that are hidden simply don't render in JSX; they keep their default values in the form state
- On submit, all field values (including hidden ones) are sent as before -- no data loss

### 3. AssetMaster.tsx (List Page) Changes
- Display the Asset Type as a new column in the table (optional, for clarity)
- Add Asset Type to the search filter

### 4. AssetMasterDetails.tsx Changes
- Show the Asset Type badge in the header/basic info section
- Continue showing all populated fields in the detail view regardless of template (read-only view shows everything that has data)

### 5. Data Integrity Guarantees
- The `asset_type` field is nullable -- existing records without a type will default to "General" (all fields visible) in the UI
- No columns are removed, renamed, or have their types changed
- The Asset Register's auto-fill logic in `AssetInventory.tsx` reads `standard_price`, `default_vendor_id`, `default_oem_id`, `default_asset_status`, `default_service_engagement`, `default_purchase_date`, `warranty_start_date`, `warranty_end_date` -- none of these are affected
- All form field keys remain identical

## Files to Modify
1. **Database**: Add `asset_type` column via migration
2. **`src/components/assets/AssetMasterFormDialog.tsx`**: Add template selector and conditional field rendering
3. **`src/pages/assets/AssetMaster.tsx`**: Show asset type in list table
4. **`src/pages/assets/AssetMasterDetails.tsx`**: Show asset type in detail view

## Files NOT Modified
- `src/pages/assets/AssetInventory.tsx` (Asset Register -- zero changes)
- `src/lib/schemas.ts` (Asset Register schema -- zero changes)
- `src/integrations/supabase/types.ts` (auto-generated -- never edited)
- `src/integrations/supabase/client.ts` (auto-generated -- never edited)

