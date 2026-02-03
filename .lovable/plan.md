
# Handle Orphaned Assets and Implement Soft-Delete Cascade

## Problem Analysis

The investigation found that:
- Asset "DG 1010 / DG 1" has `asset_master_id = null` - it was created before asset master linkage was enforced (Jan 9, 2026)
- The database has a foreign key from `assets.asset_master_id` to `asset_masters.id` with NO ACTION on delete
- When an Asset Master is deleted, associated assets become "orphaned" but still display in the Asset Register

## Solution Overview

This plan implements proper handling for orphaned assets:

1. **Add a new status for orphaned assets**: Instead of a separate "Deleted Products" table, add an `orphaned` status to assets
2. **Update Asset Master deletion**: When deleting an Asset Master, mark associated assets as orphaned
3. **Filter Asset Register view**: Exclude orphaned assets from the main list and show them in a separate tab/filter
4. **Fix existing orphaned data**: Clean up the DG 1 asset by marking it as orphaned

---

## Implementation Steps

### 1. Update Asset Status Options

Add a new status option `orphaned` to handle assets whose Asset Master has been deleted.

**File: `src/pages/assets/AssetInventory.tsx`**

Add to `assetStatusOptions` array:
```text
{ value: "orphaned", label: "Orphaned (No Master)" }
```

### 2. Update Asset Master Delete Handler

Modify the delete function in `AssetMaster.tsx` to mark associated assets as orphaned before deletion.

**File: `src/pages/assets/AssetMaster.tsx`**

Update `handleDelete` function:
- Before deleting the asset master, update all assets with that `asset_master_id`
- Set their `asset_status` to `orphaned` and `asset_master_id` to `null`
- Record status change in `asset_status_history`
- Then delete the Asset Master

### 3. Filter Orphaned Assets from Main View

Update the Asset Register to:
- Exclude orphaned assets from the main table by default
- Add a filter toggle or separate tab to view orphaned assets
- Show orphaned assets with a visual indicator (warning badge)

**File: `src/pages/assets/AssetInventory.tsx`**

Add:
- State for showing orphaned assets: `showOrphaned`
- Filter logic to exclude orphaned assets unless explicitly showing them
- A toggle button or filter option to view orphaned assets

### 4. Add Visual Indicator for Orphaned Assets

When viewing orphaned assets, display:
- Warning badge/icon indicating the asset has no valid Asset Master
- Message explaining why the asset is orphaned
- Option to reassign to a valid Asset Master via Edit

### 5. Fix Existing Orphaned Asset (DG 1)

Run a database update to mark the existing orphaned asset:

```sql
UPDATE assets 
SET asset_status = 'orphaned'
WHERE asset_master_id IS NULL AND asset_status != 'orphaned';
```

Also record in status history for audit trail.

---

## Technical Details

### Modified handleDelete in AssetMaster.tsx

```text
const handleDelete = async () => {
  if (!deleteAssetId) return;

  // First, mark associated assets as orphaned
  const { error: updateError } = await supabase
    .from("assets")
    .update({ 
      asset_status: "orphaned"
    })
    .eq("asset_master_id", deleteAssetId);

  if (updateError) {
    toast({ 
      title: "Error", 
      description: "Failed to handle associated assets", 
      variant: "destructive" 
    });
    return;
  }

  // Record status change history for affected assets
  const { data: affectedAssets } = await supabase
    .from("assets")
    .select("id")
    .eq("asset_master_id", deleteAssetId);

  if (affectedAssets && affectedAssets.length > 0) {
    await supabase.from("asset_status_history").insert(
      affectedAssets.map(a => ({
        asset_id: a.id,
        status: "orphaned",
        changed_by: "System (Asset Master Deleted)"
      }))
    );
  }

  // Then delete the asset master
  const { error } = await supabase
    .from("asset_masters")
    .delete()
    .eq("id", deleteAssetId);

  if (error) {
    toast({ 
      title: "Error", 
      description: "Failed to delete asset master", 
      variant: "destructive" 
    });
  } else {
    toast({ 
      title: "Success", 
      description: "Asset master deleted. Associated assets marked as orphaned." 
    });
    fetchData();
  }
  setDeleteAssetId(null);
};
```

### Filter Logic in AssetInventory.tsx

```text
// State for filter
const [showOrphaned, setShowOrphaned] = useState(false);

// Updated filtering
const filteredAssets = useMemo(() => {
  return assets.filter((asset) => {
    // Filter by orphaned status
    if (!showOrphaned && asset.asset_status === "orphaned") {
      return false;
    }
    if (showOrphaned && asset.asset_status !== "orphaned") {
      return false;
    }
    
    // Existing search filter
    const matchesSearch = 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.asset_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });
}, [assets, searchQuery, showOrphaned]);
```

### UI Toggle for Orphaned Assets View

Add a toggle button next to the search:
```text
<Button
  variant={showOrphaned ? "default" : "outline"}
  onClick={() => setShowOrphaned(!showOrphaned)}
  className="gap-2"
>
  <AlertTriangle className="h-4 w-4" />
  {showOrphaned ? "Show Active Assets" : "Show Orphaned Assets"}
</Button>
```

---

## Files to Modify

| File | Action |
|------|--------|
| `src/pages/assets/AssetMaster.tsx` | Modify delete handler to cascade orphan status |
| `src/pages/assets/AssetInventory.tsx` | Add orphaned filter, status option, and toggle UI |
| Database | Migration to add orphaned status to existing null-master assets |

---

## Database Migration

Mark existing orphaned assets:

```sql
-- Mark assets without asset_master_id as orphaned
UPDATE assets 
SET asset_status = 'orphaned'
WHERE asset_master_id IS NULL;

-- Add status history for audit trail
INSERT INTO asset_status_history (asset_id, status, changed_by)
SELECT id, 'orphaned', 'System (Data Cleanup)'
FROM assets
WHERE asset_master_id IS NULL;
```

---

## User Experience

After implementation:

1. **Asset Register (default view)**: Shows only assets with valid Asset Masters
2. **"Show Orphaned Assets" toggle**: Reveals assets that have no valid master
3. **Orphaned assets display**: 
   - Shows with warning indicator
   - Can be edited to reassign to a valid Asset Master
4. **Asset Master deletion**: 
   - Warns user that X assets will be marked as orphaned
   - Updates status and maintains audit trail
