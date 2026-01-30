
# Store Manager Selection and Data Visibility Implementation Plan

## Overview

This plan implements a comprehensive store manager assignment system where:
1. Store managers are selected from a dropdown of active users when adding/editing a store
2. Assigned store managers can only see data for their assigned store(s)
3. Admin users continue to see all store data across the application

---

## Current State Analysis

### Existing Infrastructure
- **Store Access Control**: The `store_user_access` junction table already exists and is used to restrict store visibility
- **Store Manager Field**: Currently stored as plain text (`manager` column in `stores` table)
- **Permission System**: Role-based permissions with `is_admin()` function that recognizes "Admin" and "Super Admin" roles
- **Store Filtering**: Already implemented in `StoresList.tsx`, `Utilities.tsx`, and `MeterReadingsSection.tsx`

### Gap Analysis
- Store manager is a text field, not linked to user profiles
- No automatic store access granted when assigned as manager
- Dashboard shows static data, not filtered by store access
- Inventory, POS, and other modules don't filter by store access

---

## Implementation Plan

### Phase 1: Database Schema Changes

**1.1 Add `manager_id` column to stores table**
```text
stores table:
  + manager_id (uuid, nullable, FK to profiles.id)
  - manager (text) - keep for backward compatibility, will be deprecated
```

**1.2 Create database trigger for automatic access management**
- When a user is assigned as store manager, automatically add entry to `store_user_access`
- When manager is changed, update the access records appropriately
- This ensures store managers always have access to their assigned store

### Phase 2: Store Form Updates

**2.1 Modify Store Schema** (`src/lib/schemas.ts`)
- Add `manager_id` field (optional UUID)
- Keep `manager` as optional for backward compatibility

**2.2 Update Store Add/Edit Form** (`src/pages/stores/StoresList.tsx`)
- Replace text input with a Select dropdown
- Populate dropdown with active users from `profiles` table
- Display user role alongside name for clarity
- On submit, save `manager_id` and derive `manager` name for display

**2.3 Update Store Details Page** (`src/pages/stores/StoreDetails.tsx`)
- Display manager name fetched via relationship
- Add edit capability for manager assignment

### Phase 3: Centralized Store Access Hook

**3.1 Create `useStoreAccess` Hook** (new file: `src/hooks/useStoreAccess.ts`)
```text
Purpose: Centralize store access logic across the application

Returns:
  - accessibleStoreIds: Set of store IDs user can access
  - isAdmin: Whether user bypasses store filtering
  - loading: Loading state
  - filterByStore: Helper function to filter data by store_id

Logic:
  1. Check if user is admin (Super Admin/Admin) -> return all stores
  2. Check store_user_access for explicit access records
  3. If no access records, return non-restricted stores
```

### Phase 4: Dashboard Store Filtering

**4.1 Update Dashboard** (`src/pages/Dashboard.tsx`)
- Fetch real data from database instead of static values
- Filter counts by accessible stores:
  - Total Stores: Count of accessible stores only
  - Active Assets: Assets in accessible stores
  - Open Incidents: Tickets from accessible stores
  - Pending Maintenance: PM tasks from accessible stores
  - Monthly Expenses: Expenses from accessible stores (if store-linked)
  - Total Staff: Employees in accessible stores (if store-linked)

**4.2 Update QuickActions and RecentActivity**
- Filter quick action links to accessible stores
- Filter recent activity to accessible stores

### Phase 5: Module-Wide Store Filtering

**5.1 Inventory Module** (`src/pages/inventory/*.tsx`)
- Filter inventory items by store_id
- Filter consumption logs by store_id
- Filter GRN, RTV, transfers by store_id
- Filter expiry alerts by store_id

**5.2 POS Module** (`src/pages/pos/*.tsx`)
- Filter orders by store_id (if store is tracked)
- Filter sales data by accessible stores

**5.3 Staff Module** (`src/pages/staff/*.tsx`)
- Filter employees by store assignment
- Filter attendance by accessible stores

**5.4 Security Module** (`src/pages/security/*.tsx`)
- Filter guards by store_id
- Filter patrol data by store_id
- Filter attendance by store_id

**5.5 Services Module** (`src/pages/services/*.tsx`)
- Filter service tickets by store_id
- Filter PM tasks by store_id
- Filter contracts by store association

### Phase 6: Automatic Access on Manager Assignment

**6.1 Database Trigger/Function**
```text
Function: sync_store_manager_access()
Trigger: AFTER INSERT OR UPDATE ON stores

Logic:
  1. When manager_id is set/changed
  2. Remove old manager's access (if changed)
  3. Add new manager's access to store_user_access
  4. Only affects non-admin users
```

---

## Technical Details

### Database Migration
```text
-- Add manager_id column
ALTER TABLE stores ADD COLUMN manager_id uuid REFERENCES profiles(id);

-- Create function to sync manager access
CREATE OR REPLACE FUNCTION sync_store_manager_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove old manager access if manager changed
  IF OLD.manager_id IS NOT NULL AND OLD.manager_id != NEW.manager_id THEN
    DELETE FROM store_user_access 
    WHERE store_id = NEW.id AND user_id = OLD.manager_id;
  END IF;
  
  -- Add new manager access
  IF NEW.manager_id IS NOT NULL THEN
    INSERT INTO store_user_access (store_id, user_id)
    VALUES (NEW.id, NEW.manager_id)
    ON CONFLICT (store_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER store_manager_access_sync
  AFTER INSERT OR UPDATE OF manager_id ON stores
  FOR EACH ROW
  EXECUTE FUNCTION sync_store_manager_access();
```

### useStoreAccess Hook Structure
```text
src/hooks/useStoreAccess.ts

export function useStoreAccess() {
  const { user, profile, isAdmin } = useAuth();
  const [accessibleStoreIds, setAccessibleStoreIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch store access based on:
    // 1. Admin status (gets all)
    // 2. store_user_access records
    // 3. Non-restricted stores as fallback
  }, [user?.id, isAdmin]);

  const filterByStore = useCallback((data, storeIdField = 'store_id') => {
    if (isAdmin) return data;
    return data.filter(item => accessibleStoreIds.has(item[storeIdField]));
  }, [accessibleStoreIds, isAdmin]);

  return { accessibleStoreIds, isAdmin, loading, filterByStore };
}
```

---

## Files to be Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `src/lib/schemas.ts` | Edit | Add manager_id to store schema |
| `src/pages/stores/StoresList.tsx` | Edit | Manager dropdown, save manager_id |
| `src/pages/stores/StoreDetails.tsx` | Edit | Display/edit manager from profile |
| `src/hooks/useStoreAccess.ts` | Create | Centralized store access hook |
| `src/pages/Dashboard.tsx` | Edit | Dynamic data with store filtering |
| `src/components/dashboard/QuickActions.tsx` | Edit | Filter by accessible stores |
| `src/components/dashboard/RecentActivity.tsx` | Edit | Filter by accessible stores |
| `src/pages/inventory/*.tsx` | Edit | Add store filtering (10 files) |
| `src/pages/pos/*.tsx` | Edit | Add store filtering (4 files) |
| `src/pages/staff/*.tsx` | Edit | Add store filtering (2 files) |
| `src/pages/security/*.tsx` | Edit | Add store filtering (8 files) |
| `src/pages/services/*.tsx` | Edit | Add store filtering (5 files) |
| Database Migration | Create | Add manager_id, trigger for auto-access |

---

## Edge Cases Handled

1. **User manages multiple stores**: The `store_user_access` junction table supports multiple store assignments
2. **Admin users**: `is_admin()` function bypasses all store filtering
3. **Manager reassignment**: Trigger removes old manager's access and adds new manager's access
4. **Backward compatibility**: Existing `manager` text field preserved during transition
5. **No store access**: Users without access records see non-restricted stores by default

---

## Testing Checklist

After implementation, verify:
- [ ] Manager dropdown shows active users when adding/editing store
- [ ] Assigned manager automatically gets access to the store
- [ ] Store manager sees only their assigned store(s) in All Stores
- [ ] Dashboard shows filtered stats for store managers
- [ ] Inventory pages filter by accessible stores
- [ ] POS pages filter by accessible stores
- [ ] Staff pages filter by accessible stores
- [ ] Security pages filter by accessible stores
- [ ] Service pages filter by accessible stores
- [ ] Utilities pages continue to filter correctly
- [ ] Admin users see all store data across all modules
- [ ] Changing store manager updates access correctly
