

# Add Required Assets Section to NSO Store Checklists

## Problem Identified

The **Required Assets section is missing** from the New Store Opening checklist view. While assets ARE correctly copied from the master template when a checklist is assigned (the backend data exists in `nso_store_assets` table), there is NO UI to view or manage these assets in the store checklist.

### Current State:
- **NSOChecklistMaster.tsx**: Has a "Required Assets" tab where admins define template assets
- **NewStoreOpening.tsx**: Only has "Tasks" and "Budget" tabs - NO Assets tab
- **nso_store_assets table**: Contains the copied assets, but they're invisible to users

---

## Solution

Add a new **"Required Assets"** tab to the store checklist inline view in `NewStoreOpening.tsx` that:
1. Displays all assets copied from the template
2. Allows adding/editing/removing assets specific to this store
3. Shows asset values and totals (ties into budget tracking)

---

## Implementation Plan

### 1. Create New Component: `NSOStoreAssetsSection.tsx`

Create a dedicated component to manage store-specific assets:

**Features:**
- Display table of required assets with columns:
  - Asset Name
  - Category  
  - Unit Price (from Asset Master)
  - Quantity (editable)
  - Total Cost (calculated)
  - Status (pending/ordered/delivered)
  - Actions (edit/delete)
- Add new asset form (select from Asset Master)
- Show total asset costs summary
- Real-time updates when assets change

**Props:**
- `checklistId`: The store checklist ID
- `onAssetChange`: Callback to refresh budget calculations

### 2. Update NewStoreOpening.tsx

Add the "Required Assets" tab alongside Tasks and Budget:

```text
Tabs:
  - Tasks (existing)
  - Required Assets (NEW)
  - Budget (existing)
```

**Changes:**
- Add import for Package icon and new component
- Add TabsTrigger for "assets" 
- Add TabsContent rendering the NSOStoreAssetsSection component
- Add query for store assets with asset master details

### 3. Database Query for Assets

Fetch assets with joined Asset Master data:
```typescript
const { data: storeAssets = [] } = useQuery({
  queryKey: ["nso-store-assets", checklistId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("nso_store_assets")
      .select(`
        *,
        asset_masters(
          name,
          standard_price,
          criticality,
          categories(name)
        )
      `)
      .eq("checklist_id", checklistId)
      .order("sort_order");
    if (error) throw error;
    return data;
  },
});
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/nso/NSOStoreAssetsSection.tsx` | Asset management component for store checklists |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/stores/NewStoreOpening.tsx` | Add "Required Assets" tab with TabsTrigger, TabsContent, and component |

---

## UI Preview

The inline checklist view will have three tabs:

```text
+-----------------------------------------------------------+
| [Tasks] [Required Assets] [Budget]                         |
+-----------------------------------------------------------+
|                                                            |
| Required Assets Tab Content:                               |
|                                                            |
| [+ Add Asset]                                              |
|                                                            |
| +--------------------------------------------------------+ |
| | Asset Name | Category | Unit Price | Qty | Total | ... | |
| +--------------------------------------------------------+ |
| | AC - 1.5T  | HVAC     | ₹35,000    | 5   | ₹175,000    | |
| | Deep Freezer| Freezer | ₹45,000    | 3   | ₹135,000    | |
| +--------------------------------------------------------+ |
|                                                            |
| Total Asset Cost: ₹310,000                                 |
+-----------------------------------------------------------+
```

---

## Technical Details

### NSOStoreAssetsSection Component Structure

```typescript
interface NSOStoreAssetsSectionProps {
  checklistId: string;
  onAssetChange?: () => void;
}

// Features:
// - Query nso_store_assets with asset_masters join
// - Add asset mutation (select from available Asset Masters)
// - Update quantity mutation
// - Update status mutation (pending/ordered/delivered)
// - Delete asset mutation
// - Calculate totals in real-time
```

### Asset Status Options
- `pending` - Not yet ordered
- `ordered` - Order placed with vendor
- `delivered` - Received at store

---

## Benefits

1. **Visibility**: Users can see what assets are required for the store opening
2. **Tracking**: Track status of each asset (pending/ordered/delivered)
3. **Budget Integration**: Asset changes automatically reflect in Budget tab
4. **Customization**: Store-specific assets can be added/modified
5. **Accountability**: Clear view of what's needed vs what's delivered

