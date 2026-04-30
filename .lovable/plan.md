## Problem

Two distinct bugs cause Permission Set changes to not affect what the admin sees:

1. **Admin bypass.** In `src/components/layout/AppSidebar.tsx` and `src/hooks/usePermissions.ts`, admins are short-circuited to "see everything" (`isAdmin || hasPermission(...)`). So unticking "Point of Sale" for the Admin role has no visible effect — POS still appears.
2. **Stale permissions in memory.** Permissions are loaded once in `AuthProvider` on login / auth state change. Saving in `/admin/permissions` writes to the DB but the in-memory `permissions` array in `AuthProvider` is never refreshed, so the sidebar wouldn't update even after fix #1 — a hard refresh is currently required.

## Plan

### 1. Stop bypassing permissions for admins in the sidebar

In `src/components/layout/AppSidebar.tsx`, change the filter logic in `filteredNavigation` so that admins are filtered by the same `hasPermission(...)` checks as everyone else.

- Remove the `!isAdmin &&` short-circuit on the parent-module check.
- Remove the `isAdmin ||` short-circuit on the children filter.
- Apply the same change to the sub-section / sub-children filtering further down in the same file (the Admin > Master Data / Task Management / User Management / Company nested sections).

Effect: if an admin's role has POS unticked, the POS top-level item disappears. Admins still keep full functional access via routes/pages — this only changes sidebar visibility, matching the user's expectation that the Permission Set drives the menu.

Note: We do NOT change `usePermissions.hasPermission` itself (that would also block route access and other PermissionGate uses). We only stop the sidebar from ignoring it. If the user later wants the same behavior on direct URL access, that can be a follow-up.

### 2. Live refresh of permissions after Save

Expose a way to re-fetch permissions from `AuthProvider` and call it after saving in `RolePermissions.tsx`. Two coordinated changes:

**a. `src/components/auth/AuthProvider.tsx`**
- Add a new method `refreshPermissions()` to `AuthContextType` that re-runs `fetchUserPermissions(user.id)`.
- Include it in the context `value`.
- Update the default context in `src/hooks/useAuth.ts` to include a no-op `refreshPermissions`.

**b. `src/pages/admin/RolePermissions.tsx`**
- Pull `refreshPermissions` and current `profile` from `useAuth()`.
- After a successful save in `handleSaveRolePermissions`, if the saved `selectedRoleId` matches the current user's `profile.role_id`, call `await refreshPermissions()` before showing the success toast.
- Do the same in the Permission Set Group save path: pass an `onSaved` callback into `PermissionSetGroupConfig` (or invoke refresh through `handleGroupRefresh`) so that when the current user is a member of the saved group, their permissions reload.

**c. Realtime for other tabs/sessions (lightweight)**
- In `AuthProvider`, after the initial load, subscribe to Postgres changes on `role_permissions` (filtered by the user's `role_id`) and `permission_set_group_permissions` / `user_permission_set_groups` (filtered by the user's `id`). On any change, call `fetchUserPermissions(user.id)`.
- Unsubscribe on cleanup. This makes permission changes propagate even when the change is made by another admin in another session, without a page refresh.

### 3. Verify (after build)

- As `abhishek.kvp2979@gmail.com` (Admin), open `/admin/permissions`, untick all POS rows for Admin, click Save Permissions.
- Sidebar should immediately drop the "Point of Sale" group without a refresh.
- Re-tick POS and Save → group reappears immediately.
- Confirm other modules still work (Transactions, Admin > Permission Set itself remains reachable since we ensure usermanagement.permissions stays ticked; if an admin unticks their own access to Permission Set, document that they'd need another admin to restore it).

## Files to change

- `src/components/layout/AppSidebar.tsx` — remove admin bypass in nav filtering (top-level, children, and Admin sub-section filtering).
- `src/components/auth/AuthProvider.tsx` — add `refreshPermissions`, add realtime subscription for permission tables.
- `src/hooks/useAuth.ts` — add `refreshPermissions: async () => {}` to default context.
- `src/pages/admin/RolePermissions.tsx` — call `refreshPermissions()` after Save when affecting current user; wire group save path similarly.
- (If needed) `src/components/admin/PermissionSetGroupConfig.tsx` — accept/forward an `onSaved` callback so refresh fires after group permission saves.

## Out of scope

- Changing route-level access for admins (admins keep full access if they navigate by URL).
- Restructuring the modules registry or adding new permission keys.
