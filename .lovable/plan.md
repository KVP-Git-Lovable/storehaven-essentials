
Use the existing Stores module as the single source of truth, and make it easier to discover from Employee creation.

## What already exists today

A store management area is already present in the app:

- **Route:** `/stores`
- **Sidebar location:** **Finance Overview → All Stores**
- **Create store:** available in `src/pages/stores/StoresList.tsx` via the **Add Store** dialog
- **Edit store:** available in `src/pages/stores/StoreDetails.tsx`
- **Delete store:** available through `StoreDeleteConfirmDialog` from the Stores list row actions
- **Employee “Deployed Store” source:** the employee form in `src/pages/staff/Employees.tsx` already reads from the `stores` table

So this is not missing backend logic; the main issue is **discoverability and clarity**.

## Plan

### 1. Make Stores clearly visible as the master page
Improve navigation wording so users can easily find where stores are managed.

Recommended change:
- Rename the sidebar section/item presentation so it is more obvious that `/stores` is the store master.
- Keep the same route, but make the label clearer, e.g.:
  - Section: **Store Management**
  - Child: **Stores**
  instead of only showing it under **Finance Overview → All Stores**

This avoids duplicate store modules and keeps one clean source of truth.

### 2. Add a direct “Manage Stores” entry point from Employee creation
In the **Add New Employee** dialog (`src/pages/staff/Employees.tsx`), add a small inline action near **Deployed Store**:

- **Manage Stores** button/link
- Opens `/stores`
- Optional helper text: “Stores listed here come from the Stores master”

This makes it obvious where the dropdown values come from and gives users a direct path to add/edit/delete stores.

### 3. Make the employee dropdown intentionally source from store master
Keep the **Deployed Store** dropdown bound to the `stores` table, but tighten the behavior:

- Show only valid store records from `stores`
- Preferably restrict to `status = "active"` for deployment selection
- Keep selected store IDs tied to store master records only

This ensures the employee form always reflects the current managed store list.

### 4. Keep store CRUD centralized in `/stores`
Do not create a second store-maintenance screen inside Employees.

Instead, continue using:
- `StoresList.tsx` for create + browse
- `StoreDetails.tsx` for edit
- `StoreDeleteConfirmDialog.tsx` for delete

This prevents data duplication and keeps the store table as the single source for:
- Employee deployed store
- POS store selectors
- service/store dropdowns elsewhere in the app

### 5. Optional usability enhancement
If the user’s permissions hide the Stores page, add a graceful cue in Employee creation:

- If store-management permission exists: show **Manage Stores**
- If not: show muted helper text like “Stores are managed from the Stores master”

This avoids confusion if the navigation is hidden by role permissions.

## Files to update

### Edit
- `src/components/layout/AppSidebar.tsx`
  - make the Stores navigation easier to find / rename labels for discoverability
- `src/pages/staff/Employees.tsx`
  - add “Manage Stores” shortcut and helper text near the Deployed Store field
  - optionally limit the dropdown query to active stores

### Keep using as-is / verify
- `src/pages/stores/StoresList.tsx`
- `src/pages/stores/StoreDetails.tsx`
- `src/components/stores/StoreDeleteConfirmDialog.tsx`

## Outcome

After this:
- You will have one clear place to **add, edit, delete, and manage stores**
- The **Deployed Store** dropdown in Employee creation will clearly be sourced from that store master
- Users will be able to navigate to store management directly from the employee workflow
- No duplicate store-maintenance pages will be introduced

## Technical details

Current implementation already confirms:
- Employee form loads stores from `supabase.from("stores").select("id, name")`
- Store creation exists in `StoresList.tsx`
- Store editing exists in `StoreDetails.tsx`
- Store deletion exists in `StoreDeleteConfirmDialog.tsx`
- `/stores` route is already registered in `src/App.tsx`

Implementation will therefore be a **UI discoverability and source-of-truth cleanup**, not a new backend module.
