
# Delete Location Master and Remove Dependencies

## Overview

This plan removes the Location Master feature entirely from the system. The investigation found that:

- The `locations` table has **no data** (0 records)
- The `assets.location` field stores location as **plain text** (not a foreign key)
- **No other tables** have foreign key dependencies on the locations table
- The **only usage** is in Asset Register (Add/Edit Asset) where it fetches location names for a dropdown

## What Changes

### 1. Asset Register - Change Location Field to Free Text Input

In the Add/Edit Asset dialog, the Location field currently fetches from the locations table for a dropdown. Since Location Master is being removed:

- Replace the `SearchableSelect` dropdown with a simple text `Input` field
- Remove the locations state variable and fetch call
- Users can type any location text directly

### 2. Remove Location Master Page

Delete the entire Location Master page file:
- `src/pages/master/LocationMaster.tsx`

### 3. Remove Navigation and Routing

Remove Location Master from:
- **App.tsx**: Remove the import and route `/master/location`
- **AppSidebar.tsx**: Remove the sidebar navigation entry
- **modules.ts**: Remove the module registration

### 4. Database Cleanup

Drop the `locations` table from the database (it's empty and unused):
- The table has no data
- No foreign keys reference it
- Safe to remove

---

## Files to Modify

| File | Action |
|------|--------|
| `src/pages/assets/AssetInventory.tsx` | Modify - Change Location from SearchableSelect to text Input, remove locations fetch |
| `src/pages/master/LocationMaster.tsx` | Delete |
| `src/App.tsx` | Modify - Remove LocationMaster import and route |
| `src/components/layout/AppSidebar.tsx` | Modify - Remove Location Master nav item |
| `src/lib/modules.ts` | Modify - Remove master.location entry |
| Database migration | Create - Drop the `locations` table |

---

## Technical Details

### AssetInventory.tsx Changes

**Remove:**
- The `Location` type definition
- The `locations` state: `const [locations, setLocations] = useState<Location[]>([]);`
- The fetch call: `supabase.from("locations").select("id, name")...`
- The `setLocations(locationsRes.data || [])` line

**Replace the Location field:**

Current (SearchableSelect dropdown):
```text
<FormField
  name="location"
  render={...}
    <SearchableSelect
      options={locations.map((loc) => ({ value: loc.name, label: loc.name }))}
      ...
    />
  ...
/>
```

New (simple text Input):
```text
<FormField
  name="location"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Location</FormLabel>
      <FormControl>
        <Input placeholder="Enter location (e.g. Back Office, Sales Floor)" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Database Migration

```sql
DROP TABLE IF EXISTS public.locations;
```

### Schema Validation

The `assetSchema` in `src/lib/schemas.ts` already defines location as:
```text
location: z.string().trim().min(1, "Location is required")
```

This works perfectly with a text input field, no changes needed to the schema.
