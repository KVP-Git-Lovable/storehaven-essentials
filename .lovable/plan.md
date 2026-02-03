
# Fix: Preventive Maintenance "Add Schedule" Blank Page Error

## Problem Analysis

When clicking "Add Schedule" in Preventive Maintenance, the page shows a blank error screen. The root cause is in the `MaintenanceFormDialog.tsx` component on **line 468**:

```tsx
<SelectItem value="">None</SelectItem>
```

Radix UI's `SelectItem` component **does not allow empty string values**. This causes the component to crash when the dialog attempts to render, resulting in a blank error screen.

## Solution

Replace the empty string value `""` with a non-empty placeholder value like `"none"`, and update the form logic to handle this value appropriately:

1. Change the `SelectItem` value from `""` to `"none"`
2. Update the form submission logic to convert `"none"` back to `null` when saving
3. Update the form initialization logic to convert `null` to `"none"` when loading

---

## Implementation Details

### File: `src/components/maintenance/MaintenanceFormDialog.tsx`

**Change 1 - Line 468**: Update the "None" option to use a non-empty value

```text
Before: <SelectItem value="">None</SelectItem>
After:  <SelectItem value="none">None</SelectItem>
```

**Change 2 - Lines 128-136**: Update default form value

```text
Before: pmChecklistMasterId: "",
After:  pmChecklistMasterId: "none",
```

**Change 3 - Lines 158, 168**: Update form reset to use "none" instead of empty string

```text
Before: pmChecklistMasterId: initialData.pm_checklist_master_id || "",
After:  pmChecklistMasterId: initialData.pm_checklist_master_id || "none",

Before: pmChecklistMasterId: "",
After:  pmChecklistMasterId: "none",
```

**Change 4 - Line 259**: Update payload to convert "none" back to null

```text
Before: pm_checklist_master_id: data.pmChecklistMasterId || null,
After:  pm_checklist_master_id: data.pmChecklistMasterId === "none" ? null : (data.pmChecklistMasterId || null),
```

**Change 5 - Line 208**: Update the auto-select logic check

```text
Before: if (filtered.length === 1 && !form.getValues("pmChecklistMasterId")) {
After:  if (filtered.length === 1 && (!form.getValues("pmChecklistMasterId") || form.getValues("pmChecklistMasterId") === "none")) {
```

---

## Summary of Changes

| Location | Change |
|----------|--------|
| Line 135 | Default value `"none"` instead of `""` |
| Line 158 | Reset value uses `"none"` fallback |
| Line 168 | Add mode reset uses `"none"` |
| Line 208 | Auto-select check includes `"none"` |
| Line 259 | Convert `"none"` to `null` on save |
| Line 468 | SelectItem value `"none"` instead of `""` |

This is a focused fix that only addresses the crash without modifying any other workflows or UI structures.
