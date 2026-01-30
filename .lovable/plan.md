

# Permissions Management Module - Test and Improvement Plan

## Current State Analysis

After thorough exploration of the codebase and database, here is the current state of the permissions system:

### What Works Correctly

1. **Permission Matrix UI**: The RolePermissions page correctly displays and manages:
   - Role-based permissions (Role Permissions tab)
   - User-specific permission overrides (User Permissions tab)
   - Visual indicators showing "R" (from Role) and "U" (User Override) badges

2. **Database Structure**:
   - `role_permissions` table stores permissions per role
   - `user_permissions` table stores user-specific overrides
   - `get_user_permissions()` function merges both using COALESCE logic

3. **Navigation Filtering**: The sidebar correctly filters menu items based on "view" permissions

### Critical Gaps Identified

1. **No Permission Enforcement on Actions**: While the permission data is stored and retrieved correctly, most pages **do not actually check permissions** before showing action buttons (Edit, Delete, Create). Examples:
   - `Users.tsx` - Delete button always visible
   - `UserRoles.tsx` - Delete button always visible
   - `Vendors.tsx` - No delete functionality at all
   - `StoresList.tsx` - No delete button, create always visible

2. **PermissionGate Component Unused**: A reusable `PermissionGate` component exists but is **never imported** anywhere in the application

3. **Database Function Logic**: The `get_user_permissions()` function uses `COALESCE(up.can_delete, rp.can_delete, false)` which means:
   - User permissions **override** role permissions (not additive)
   - If role has `can_delete=true` but user has `can_delete=false`, the result is `false`
   - This conflicts with the current UI design that shows user permissions as "additional" (additive)

---

## Test Scenario Implementation

To test the specific scenario requested (remove Delete from Store Manager role, grant Delete at user level for one user):

### Step 1: Update Store Manager Role Permissions
Remove `can_delete` from the Store Manager role for a specific module (e.g., `usermanagement.users`).

### Step 2: Add User-Level Delete Permission
Grant `can_delete` to one specific user (e.g., Suyog) for `usermanagement.users`.

### Step 3: Verify Expected Behavior
- User "Shravya" (Store Manager, no user override): Should NOT see delete button
- User "Suyog" (Store Manager, with user override): Should see delete button

---

## Implementation Fixes Required

### 1. Enforce Permissions on Create/Edit/Delete Buttons

Update affected pages to use the `PermissionGate` component or `hasPermission()` hook to conditionally render action buttons.

**Files to Update:**
- `src/pages/admin/Users.tsx`
- `src/pages/admin/UserRoles.tsx`
- `src/pages/Vendors.tsx`
- `src/pages/stores/StoresList.tsx`
- `src/pages/stores/StoreDetails.tsx`
- `src/pages/services/ServiceContracts.tsx`
- `src/pages/services/ServiceTickets.tsx`
- `src/pages/security/SecurityGuards.tsx`
- (and other CRUD pages)

**Example Pattern:**
```tsx
import { usePermissions } from "@/hooks/usePermissions";

// Inside component:
const { hasPermission } = usePermissions();
const canCreate = hasPermission("usermanagement.users", "create");
const canDelete = hasPermission("usermanagement.users", "delete");

// Conditional rendering:
{canCreate && (
  <Button onClick={() => setDialogOpen(true)}>
    <Plus className="mr-2 h-4 w-4" />
    Add User
  </Button>
)}

{canDelete && (
  <Button variant="ghost" size="icon" onClick={() => handleDelete(user)}>
    <Trash2 className="h-4 w-4" />
  </Button>
)}
```

### 2. Fix Database Function Logic (Optional - Based on Desired Behavior)

If user permissions should be **additive** (grant extra permissions on top of role), modify the `get_user_permissions()` function:

```sql
-- Additive logic: user permissions ADD to role permissions
SELECT 
  COALESCE(rp.module_key, up.module_key) as module_key,
  COALESCE(rp.can_view, false) OR COALESCE(up.can_view, false) as can_view,
  COALESCE(rp.can_create, false) OR COALESCE(up.can_create, false) as can_create,
  COALESCE(rp.can_edit, false) OR COALESCE(up.can_edit, false) as can_edit,
  COALESCE(rp.can_delete, false) OR COALESCE(up.can_delete, false) as can_delete
FROM ...
```

If user permissions should **override** role permissions (current behavior), keep the existing function but update the UI to reflect this.

### 3. Add Route-Level Permission Check

Wrap routes with permission checks to prevent direct URL access:

```tsx
// In App.tsx or a new ProtectedRouteWithPermission component
<Route 
  path="/admin/users" 
  element={
    <PermissionGate moduleKey="usermanagement.users" fallback={<AccessDenied />}>
      <Users />
    </PermissionGate>
  } 
/>
```

---

## Technical Details

### Database Tables Involved
- `role_permissions` - Role-based permission matrix
- `user_permissions` - User-specific overrides
- `profiles` - User profiles with role_id

### Key Functions
- `get_user_permissions(_user_id uuid)` - Returns merged permissions
- `get_role_permissions_for_user(_user_id uuid)` - Returns role-only permissions
- `is_admin(_user_id uuid)` - Checks if user has admin role

### Files to Create/Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/pages/admin/Users.tsx` | Modify | Add permission checks for Create/Edit/Delete |
| `src/pages/admin/UserRoles.tsx` | Modify | Add permission checks for Create/Edit/Delete |
| `src/pages/Vendors.tsx` | Modify | Add Edit/Delete functionality with permission checks |
| `src/pages/stores/StoresList.tsx` | Modify | Add permission checks for Create |
| Multiple other pages | Modify | Same pattern as above |
| Database migration | Create | Optional: Fix function logic if additive behavior desired |

---

## Verification Steps

After implementation:

1. Log in as a Super Admin and remove Delete permission from Store Manager role for `usermanagement.users`
2. Add Delete permission at user level for user "Suyog" on `usermanagement.users`
3. Log in as "Shravya" (Store Manager without override) - verify Delete button is hidden on Users page
4. Log in as "Suyog" (Store Manager with Delete override) - verify Delete button is visible on Users page
5. Test that navigation still works correctly based on view permissions
6. Verify that direct URL access is blocked for unauthorized modules

