
# User Hierarchy-Based Visibility Implementation Plan

## Overview
This plan implements a comprehensive hierarchy-based visibility system where managers can see data from their direct and nested subordinates, while regular users only see their own data. This builds upon the existing `reports_to` field in the `profiles` table.

---

## Architecture Design

### Current State
- **User Hierarchy**: Already exists via `reports_to` field in `profiles` table (self-referencing UUID)
- **Store Access**: Already implemented via `useStoreAccess` hook and `store_user_access` table
- **Permissions**: Already implemented via `usePermissions` hook

### New Components
1. **Database Function**: `get_subordinate_user_ids(user_id)` - Recursively fetches all subordinate IDs
2. **React Hook**: `useHierarchyAccess` - Provides accessible user IDs and filtering utilities
3. **Module Updates**: Apply hierarchy filtering across all relevant modules

---

## Database Changes

### 1. Create Recursive Function to Get Subordinate User IDs

```sql
CREATE OR REPLACE FUNCTION public.get_subordinate_user_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE subordinates AS (
    -- Direct reports
    SELECT id FROM public.profiles WHERE reports_to = _user_id
    UNION ALL
    -- Nested subordinates
    SELECT p.id 
    FROM public.profiles p
    INNER JOIN subordinates s ON p.reports_to = s.id
  )
  SELECT id FROM subordinates;
$$;
```

### 2. Create Helper Function to Check If User Is Subordinate

```sql
CREATE OR REPLACE FUNCTION public.is_subordinate(_manager_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.get_subordinate_user_ids(_manager_id) WHERE get_subordinate_user_ids = _user_id
  )
$$;
```

### 3. Create Function to Get All Accessible User IDs (Self + Subordinates)

```sql
CREATE OR REPLACE FUNCTION public.get_hierarchy_accessible_users(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Include self
  SELECT _user_id
  UNION
  -- Include all subordinates
  SELECT id FROM public.get_subordinate_user_ids(_user_id);
$$;
```

---

## Frontend Changes

### 1. Create `useHierarchyAccess` Hook

**File**: `src/hooks/useHierarchyAccess.ts`

This hook will:
- Fetch subordinate user IDs via the database function
- Provide filtering utilities similar to `useStoreAccess`
- Cache results for performance

```typescript
type UseHierarchyAccessReturn = {
  accessibleUserIds: Set<string>;   // Self + all subordinates
  subordinateUserIds: Set<string>;  // Only subordinates (not including self)
  isAdmin: boolean;
  loading: boolean;
  filterByUser: <T>(data: T[], userIdField?: string) => T[];
  hasAccessToUser: (userId: string) => boolean;
  canManageUser: (userId: string) => boolean; // True if user is subordinate
};
```

### 2. Update Modules to Use Hierarchy Filtering

The following modules need hierarchy filtering applied:

| Module | File | User Field | Filtering Logic |
|--------|------|------------|-----------------|
| Dashboard | `src/pages/Dashboard.tsx` | Various | Filter counts by accessible users |
| Service Tickets | `src/pages/services/ServiceTickets.tsx` | `reported_by`, `assigned_to` | Show tickets created/assigned to subordinates |
| Task Adherence | `src/pages/operations/TaskAdherence.tsx` | `user_id` | Show task completions by team |
| User Management | `src/pages/admin/Users.tsx` | N/A | Show only subordinates in non-admin view |
| Approvals (Future) | N/A | `submitted_by` | See approval requests from subordinates |

### 3. Filter User Dropdowns

When selecting users in forms (e.g., "Assigned To"), show only:
- For Admins: All users
- For Managers: Self + subordinates only

---

## Detailed Implementation Steps

### Phase 1: Database Layer (Migration)

1. Create `get_subordinate_user_ids` function
2. Create `get_hierarchy_accessible_users` function
3. Create `is_subordinate` helper function
4. Test with existing user hierarchy data

### Phase 2: Frontend Hook

**Create `src/hooks/useHierarchyAccess.ts`:**

```typescript
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function useHierarchyAccess() {
  const { user, isAdmin } = useAuth();
  const [accessibleUserIds, setAccessibleUserIds] = useState<Set<string>>(new Set());
  const [subordinateUserIds, setSubordinateUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHierarchyAccess = async () => {
      if (!user?.id) {
        setAccessibleUserIds(new Set());
        setSubordinateUserIds(new Set());
        setLoading(false);
        return;
      }

      // Admins have access to all users
      if (isAdmin) {
        const { data: allUsers } = await supabase
          .from("profiles")
          .select("id");
        setAccessibleUserIds(new Set((allUsers || []).map(u => u.id)));
        setSubordinateUserIds(new Set((allUsers || []).map(u => u.id)));
        setLoading(false);
        return;
      }

      // Get subordinates via database function
      const { data: subordinates } = await supabase
        .rpc("get_subordinate_user_ids", { _user_id: user.id });

      const subIds = new Set((subordinates || []).map((r: { get_subordinate_user_ids: string }) => 
        r.get_subordinate_user_ids));
      
      // Accessible = self + subordinates
      const accessibleIds = new Set([user.id, ...subIds]);

      setSubordinateUserIds(subIds);
      setAccessibleUserIds(accessibleIds);
      setLoading(false);
    };

    fetchHierarchyAccess();
  }, [user?.id, isAdmin]);

  const filterByUser = useCallback(<T extends Record<string, unknown>>(
    data: T[],
    userIdField = "user_id"
  ): T[] => {
    if (isAdmin) return data;
    return data.filter(item => {
      const userId = item[userIdField];
      if (!userId) return true;
      return accessibleUserIds.has(userId as string);
    });
  }, [accessibleUserIds, isAdmin]);

  const hasAccessToUser = useCallback((userId: string): boolean => {
    if (isAdmin) return true;
    return accessibleUserIds.has(userId);
  }, [accessibleUserIds, isAdmin]);

  const canManageUser = useCallback((userId: string): boolean => {
    if (isAdmin) return true;
    return subordinateUserIds.has(userId);
  }, [subordinateUserIds, isAdmin]);

  return {
    accessibleUserIds,
    subordinateUserIds,
    isAdmin,
    loading,
    filterByUser,
    hasAccessToUser,
    canManageUser,
  };
}
```

### Phase 3: Update User Management Module

**Modify `src/pages/admin/Users.tsx`:**

- Non-admin users see only their direct and nested subordinates
- Admin users see all users (current behavior)
- Filter user list based on `accessibleUserIds`

### Phase 4: Update User Dropdowns Across Modules

**Files to update:**

| Component | Dropdown Field | Current Behavior | New Behavior |
|-----------|----------------|------------------|--------------|
| `UserFormDialog.tsx` | "Reports To" | Shows all users | Shows users in hierarchy context |
| `MaintenanceFormDialog.tsx` | "Assigned To" | Text input | User dropdown with hierarchy filter |
| `ServiceTicketDetailsDialog.tsx` | "Assigned To" | Text input | User dropdown with hierarchy filter |

### Phase 5: Apply to Dashboard & Reports

- Filter dashboard stats to show only data related to accessible users
- Filter activity feeds to show team activities
- Apply to any future reporting modules

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useHierarchyAccess.ts` | Hook for hierarchy-based user access |

## Files to Modify

| File | Changes |
|------|---------|
| Database Migration | Add recursive subordinate functions |
| `src/pages/admin/Users.tsx` | Filter users by hierarchy for non-admins |
| `src/components/admin/UserFormDialog.tsx` | Filter "Reports To" dropdown |
| `src/pages/services/ServiceTickets.tsx` | Optional: Filter by user hierarchy |
| `src/pages/operations/TaskAdherence.tsx` | Filter by accessible users |

---

## Security Considerations

### Backend Enforcement (Recommended Addition)
While frontend filtering provides UX, consider adding RLS policies for defense-in-depth:

```sql
-- Example: Managers can only view profiles of their subordinates
CREATE POLICY "Users can view own and subordinate profiles"
ON public.profiles FOR SELECT
USING (
  id = auth.uid()
  OR public.is_subordinate(auth.uid(), id)
  OR public.is_admin(auth.uid())
);
```

### Admin Bypass
All hierarchy functions include admin bypass:
- `is_admin()` check at the start
- Admins see all data without restriction

---

## Testing Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| Manager with 2 direct reports | Sees self + 2 subordinates |
| Manager with nested team (L1 > L2 > L3) | Sees all levels below |
| Regular user (no subordinates) | Sees only own data |
| Admin user | Sees all users |
| New user added under manager | Auto-visible without config |
| User moved to different manager | Visibility updates accordingly |

---

## Rollout Strategy

1. **Phase 1**: Deploy database functions (no frontend impact)
2. **Phase 2**: Deploy `useHierarchyAccess` hook (unused initially)
3. **Phase 3**: Enable on User Management page first
4. **Phase 4**: Gradually enable on other modules
5. **Phase 5**: Add optional RLS policies for backend enforcement

---

## Technical Notes

### Performance Optimization
- Recursive queries are efficient with proper indexing on `reports_to`
- Results are cached in React state (refreshes on auth change)
- Consider adding index: `CREATE INDEX idx_profiles_reports_to ON profiles(reports_to)`

### Edge Cases Handled
- Users with no subordinates: Only see own data
- Circular references: Prevented by recursive CTE (stops at visited nodes)
- Null `reports_to`: User is at top of hierarchy, shows own subtree
- Multiple hierarchy roots: Each root user sees only their subtree

