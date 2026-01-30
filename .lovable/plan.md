
# Permission Set Group Implementation Plan

## Overview

This plan transforms the current individual user-based permission system into a **Permission Set Group** model. Instead of assigning permissions directly to individual users, you will:

1. Create **Permission Set Groups** (e.g., "Store Operations Team", "Finance Access", "Security Patrol Team")
2. Configure permissions for each group across all modules
3. Assign multiple users to one or more groups
4. Users inherit permissions from all groups they belong to (additive)

---

## Database Changes

### New Tables

#### 1. `permission_set_groups` - Master table for groups
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Group name (e.g., "Finance Team Access") |
| description | TEXT | Optional description |
| status | TEXT | active/inactive |
| created_at | TIMESTAMP | Auto-generated |
| updated_at | TIMESTAMP | Auto-updated |

#### 2. `permission_set_group_permissions` - Permissions for each group
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| group_id | UUID | FK to permission_set_groups |
| module_key | TEXT | Module identifier |
| can_view | BOOLEAN | View permission |
| can_create | BOOLEAN | Create permission |
| can_edit | BOOLEAN | Edit permission |
| can_delete | BOOLEAN | Delete permission |

#### 3. `user_permission_set_groups` - Junction table linking users to groups
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to profiles |
| group_id | UUID | FK to permission_set_groups |
| created_at | TIMESTAMP | Auto-generated |

### Database Function Update

Update `get_user_permissions()` to include group permissions:

```text
Final Permission = Role Permission OR Group Permission(s)
```

The function will:
1. Get role-based permissions (from `role_permissions`)
2. Get all group permissions for the user (from groups they're assigned to)
3. Combine using OR logic (additive)

---

## UI Changes

### Restructured "Permission Set" Page

The page will have **two tabs**:

#### Tab 1: Role Permissions (unchanged)
- Select a role
- Configure permissions for that role
- Same as current behavior

#### Tab 2: Permission Set Groups (replaces "User Permissions")
- **Groups List Panel** (left side):
  - List all permission set groups
  - Add New Group button
  - Edit/Delete group buttons
  - Active/inactive status toggle

- **Group Configuration Panel** (right side when group selected):
  - Group name and description
  - **Permissions Matrix**: Same table as role permissions
  - **Assigned Users Section**:
    - List of users currently in this group
    - Add users button (opens multi-select dialog)
    - Remove user from group button

### New Dialog: Add/Edit Permission Set Group
- Group name (required)
- Description (optional)
- Status (active/inactive)

### New Dialog: Assign Users to Group
- Multi-select list of all active users
- Shows current group membership
- Checkbox to add/remove users

---

## Visual Flow

```text
+--------------------------------------------------+
| Permission Set                    [Save]          |
+--------------------------------------------------+
| [Role Permissions] [Permission Set Groups]        |
+--------------------------------------------------+
|                                                   |
| PERMISSION SET GROUPS TAB:                        |
|                                                   |
| +----------------+  +---------------------------+ |
| | Groups         |  | Finance Team Access       | |
| |----------------|  |---------------------------| |
| | + Add Group    |  | Description: Access to... | |
| |                |  |                           | |
| | [Finance Team] |  | PERMISSIONS:              | |
| | [Store Ops   ] |  | +-------+---+---+---+---+ | |
| | [Security    ] |  | |Module |All|V|C|E|D|   | |
| |                |  | +-------+---+---+---+---+ | |
| |                |  | |PettyCa|[x]|x|x|x|x|   | |
| |                |  | |Utiliti|[x]|x|x|x|x|   | |
| |                |  | +-------+---+---+---+---+ | |
| |                |  |                           | |
| |                |  | ASSIGNED USERS:           | |
| |                |  | [+ Add Users]             | |
| |                |  | - Shravya (Store Manager) | |
| |                |  | - Suyog (Store Manager)   | |
| +----------------+  +---------------------------+ |
+--------------------------------------------------+
```

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `src/components/admin/PermissionSetGroupDialog.tsx` | Create/Edit group dialog |
| `src/components/admin/AssignUsersDialog.tsx` | Multi-select users to assign to group |
| `src/components/admin/PermissionSetGroupsList.tsx` | Left panel showing all groups |
| `src/components/admin/PermissionSetGroupConfig.tsx` | Right panel with permissions matrix and users |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/admin/RolePermissions.tsx` | Replace "User Permissions" tab with "Permission Set Groups" |
| `src/hooks/usePermissions.ts` | No changes needed (reads from `get_user_permissions` which will be updated) |
| `src/components/auth/AuthProvider.tsx` | No changes needed (uses `get_user_permissions`) |
| Database migration | New tables + updated function |

---

## Permission Resolution Logic

The final permission for a user will be calculated as:

```text
User's Effective Permission = 
    (Role Permission) 
    OR (Group 1 Permission) 
    OR (Group 2 Permission) 
    OR ... 
```

**Example:**
- User "Shravya" has role "Store Manager" with view-only on PettyCash
- She's assigned to "Finance Team" group with full access to PettyCash
- **Result**: She gets full access to PettyCash (additive OR logic)

---

## Migration Path

1. Create new tables (`permission_set_groups`, `permission_set_group_permissions`, `user_permission_set_groups`)
2. Migrate existing `user_permissions` data:
   - For each unique set of user permissions, create a Permission Set Group
   - Assign the user to that group
3. Update `get_user_permissions()` function to include group permissions
4. Drop old `user_permissions` table (optional, can keep for backup initially)

---

## Security Considerations

- RLS policies on all new tables to ensure only admins can manage permission groups
- The `get_user_permissions()` function remains `SECURITY DEFINER` to prevent RLS recursion
- Admins can view and manage all groups; non-admins cannot access the configuration

---

## Testing Checklist

After implementation:
1. Create a Permission Set Group called "Extra Store Access"
2. Grant Petty Cash and Utilities full access to this group
3. Assign user "Shravya" to this group
4. Log in as Shravya and verify she has access to Petty Cash and Utilities
5. Remove Shravya from the group and verify access is removed
6. Verify that role-based permissions still work correctly
7. Test a user in multiple groups to confirm additive logic works
