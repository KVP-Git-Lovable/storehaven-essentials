

# Add Searchable Dropdowns to Asset Register Form

## Overview

This plan adds search functionality to the dropdown fields in the "Add New Asset" dialog. Currently, the form uses standard Radix Select components which require scrolling through all options. With searchable dropdowns, users can quickly type to filter and find the desired option.

## What Changes

The following dropdown fields will become searchable:
- **Asset Name (Master)** - Can have many entries, search is essential
- **Store** - Multiple stores to choose from
- **Location** - Multiple locations to filter
- **Vendor Procured From** - List of vendors
- **OEM Name** - List of OEM vendors

The following fields will remain as standard dropdowns (small, fixed option lists):
- **Service Engagement** - Only 4 options
- **Asset Status** - Only 10 options

## Implementation Steps

### Step 1: Create a Reusable SearchableSelect Component

Create a new component `src/components/ui/searchable-select.tsx` that:
- Uses the existing `Command` components from cmdk
- Wraps in a `Popover` for dropdown behavior
- Supports single selection (unlike MultiSelectCombobox)
- Works seamlessly with react-hook-form's FormField pattern
- Displays selected value label in the trigger button
- Provides search input with real-time filtering
- Supports optional empty/placeholder states
- Handles the "none" value pattern for optional fields

### Step 2: Update AssetInventory.tsx Form

Replace the standard Select components for these fields:
1. **assetMasterId** - Asset Name (Master)
2. **storeId** - Store
3. **location** - Location
4. **vendorId** - Vendor Procured From
5. **oemId** - OEM Name

Each field will use the new SearchableSelect component with appropriate:
- Placeholder text
- Search placeholder text
- Empty state message
- Option list transformation

---

## Technical Details

### SearchableSelect Component Props

```text
type SearchableSelectProps = {
  options: { value: string; label: string; subtitle?: string }[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}
```

### Component Structure

```text
Popover
  PopoverTrigger (Button showing selected label)
  PopoverContent
    Command
      CommandInput (search box)
      CommandList
        CommandEmpty (no results message)
        CommandGroup
          CommandItem (for each filtered option)
```

### Form Integration Example

```text
<FormField
  control={form.control}
  name="storeId"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Store</FormLabel>
      <SearchableSelect
        options={stores.map(s => ({ value: s.id, label: s.name }))}
        value={field.value}
        onValueChange={field.onChange}
        placeholder="Select store"
        searchPlaceholder="Search stores..."
        emptyMessage="No stores found."
      />
      <FormMessage />
    </FormItem>
  )}
/>
```

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/ui/searchable-select.tsx` | Create |
| `src/pages/assets/AssetInventory.tsx` | Modify |

