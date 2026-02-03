
# Add Edit Button to Asset Register Actions Column

## Overview

This plan adds an Edit button alongside the existing View (Eye) button in the Asset Register's Actions column. Clicking the Edit button will open a dialog to modify the asset's details using the same form fields as the "Add Asset" dialog.

## What Changes

The Asset Register table currently has only a View button in the Actions column. After this change:
- An **Edit button** (Pencil icon) will appear next to the View button
- Clicking Edit opens a dialog pre-populated with the asset's current values
- Users can modify any field and save changes
- The existing View functionality remains unchanged

## Implementation Approach

### 1. Add State for Edit Mode

Add new state variables to track:
- `editOpen` - controls the edit dialog visibility
- `editingAsset` - stores the asset being edited

### 2. Create Edit Handler Function

Add a `handleEdit` function that:
- Sets the asset being edited
- Pre-populates the form with the asset's current values using `form.reset()`
- Opens the edit dialog

### 3. Modify Form Submission

Update the `onSubmit` function to:
- Check if editing or adding (based on `editingAsset` state)
- Use `update` instead of `insert` for edits
- Record status history if status changed during edit
- Reset form and close dialog after success

### 4. Add Edit Dialog

Either repurpose the existing dialog with conditional title/button text, or create a separate edit dialog. The recommended approach is to reuse the existing dialog with:
- Dynamic title: "Add New Asset" vs "Edit Asset"
- Dynamic submit button: "Add Asset" vs "Save Changes"

### 5. Add Edit Button in Table

Add a Pencil icon button next to the Eye button in the Actions column:
- Uses same styling as View button (ghost variant, size icon)
- Stops click propagation to prevent row navigation
- Calls `handleEdit(asset)` on click

---

## Technical Details

### New State Variables

```text
const [editOpen, setEditOpen] = useState(false);
const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
```

### handleEdit Function

```text
const handleEdit = (asset: Asset) => {
  setEditingAsset(asset);
  form.reset({
    assetMasterId: asset.asset_master_id || "",
    assetNumber: asset.asset_number || "",
    storeId: asset.store_id || "",
    location: asset.location || "",
    condition: asset.condition || "under-warranty",
    assetStatus: asset.asset_status || "requisition-raised",
    purchaseDate: asset.purchase_date || "",
    value: asset.value || 0,
    vendorId: asset.vendor_id || "",
    oemId: asset.oem_id || "",
    warrantyStartDate: asset.warranty_start_date || "",
    warrantyEndDate: asset.warranty_end_date || "",
  });
  setEditOpen(true);
};
```

### Updated onSubmit Logic

```text
if (editingAsset) {
  // Update existing asset
  const { error } = await supabase
    .from("assets")
    .update({...fields...})
    .eq("id", editingAsset.id);
    
  // Track status change if applicable
  if (data.assetStatus !== editingAsset.asset_status) {
    await supabase.from("asset_status_history").insert({...});
  }
} else {
  // Insert new asset (existing logic)
}
```

### Actions Column Update

```text
<TableCell>
  <div className="flex items-center gap-1">
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={(e) => {
        e.stopPropagation();
        handleEdit(asset);
      }}
    >
      <Pencil className="h-4 w-4" />
    </Button>
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/assets/inventory/${asset.id}`);
      }}
    >
      <Eye className="h-4 w-4" />
    </Button>
  </div>
</TableCell>
```

### Files to Modify

| File | Action |
|------|--------|
| `src/pages/assets/AssetInventory.tsx` | Modify - Add edit functionality |

### Import Changes

Add `Pencil` to the lucide-react imports.

