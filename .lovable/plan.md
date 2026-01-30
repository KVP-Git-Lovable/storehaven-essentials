

# Store Access Control - Comprehensive Fix Plan

## Problem Summary

Store Managers like **Suyog** (assigned to "Polar Bear - Manna Gudda") are currently able to see data from **all stores** across multiple modules. The expected behavior is that users should only see data related to their assigned store(s).

**Current Data in Database:**
- Suyog (user_id: 35a0c4d0-65ac-4d43-8a87-f59c9af2d1bd) is assigned to store "Polar Bear - Manna Gudda" (store_id: 57fc3e12-fbd3-4c86-be4b-b188310d3a8d)
- Shravya (user_id: 4a65e375-e1a5-4d5c-9eb1-3e4f630d05c7) is assigned to store "Polar Bear - Kottara" (store_id: 799a8179-5f37-41a9-84fa-0a5419be922a)

The `store_user_access` table is correctly populated via the database trigger when a store manager is assigned.

---

## Root Cause Analysis

The application has a `useStoreAccess` hook that correctly:
1. Fetches accessible store IDs from the `store_user_access` table
2. Provides filtering utilities (`filterByStore`, `hasAccess`)
3. Returns `accessibleStoreIds` for query filtering

**However, most modules do NOT use this hook** to filter their data. They fetch all data from the database without applying store-based restrictions.

---

## Current State by Module

### Modules WITH Store Filtering (Working Correctly)
| Module | File | Status |
|--------|------|--------|
| Dashboard | `src/pages/Dashboard.tsx` | Uses `useStoreAccess` |
| Service Tickets | `src/pages/services/ServiceTickets.tsx` | Uses `useStoreAccess` |
| Preventive Maintenance | `src/pages/services/PreventiveMaintenance.tsx` | Uses `useStoreAccess` |
| Security Dashboard | `src/pages/security/SecurityDashboard.tsx` | Uses `useStoreAccess` |
| Recent Activity | `src/components/dashboard/RecentActivity.tsx` | Uses `useStoreAccess` |
| Utilities | `src/pages/Utilities.tsx` | Custom implementation |
| Stores List | `src/pages/stores/StoresList.tsx` | Custom implementation |
| Meter Readings | `src/components/utilities/MeterReadingsSection.tsx` | Custom implementation |

### Modules WITHOUT Store Filtering (Need to be Fixed)

#### High Priority (User-Reported Issues)
| Module | File | Data Table | Store Field |
|--------|------|------------|-------------|
| Asset Register | `src/pages/assets/AssetInventory.tsx` | `assets` | `store_id` |
| Spares Management | `src/pages/assets/SparesManagement.tsx` | `spares` | Needs `store_id` column |
| Service Contracts | `src/pages/services/ServiceContracts.tsx` | `service_contracts` | Via `service_contract_locations` |
| Security Guards | `src/pages/security/SecurityGuards.tsx` | `security_guards` | `store_id` |

#### Medium Priority (Other Modules)
| Module | File | Data Table | Store Field |
|--------|------|------------|-------------|
| Petty Cash | `src/pages/PettyCash.tsx` | `petty_cash` | `store_id` |
| Patrol Points | `src/pages/security/PatrolPoints.tsx` | `security_patrol_points` | `store_id` |
| Security Roster | `src/pages/security/SecurityRoster.tsx` | `security_roster` | Via guards |
| Guard Feedback | `src/pages/security/GuardFeedback.tsx` | `security_guard_feedback` | `store_id` |
| Inventory Requisitions | `src/pages/inventory/Requisitions.tsx` | `inventory_requisitions` | `store_id` |
| Goods Receipt | `src/pages/inventory/GoodsReceipt.tsx` | `goods_receipts` | `store_id` |
| Store Transfers | `src/pages/inventory/StoreTransfers.tsx` | `store_transfers` | `source_store_id` / `destination_store_id` |
| VM Compliance Tasks | `src/pages/vm/ComplianceTasks.tsx` | `vm_compliance_tasks` | `store_id` |
| Photo Submissions | `src/pages/vm/PhotoSubmission.tsx` | `vm_submissions` | `store_id` |
| Task Adherence | `src/pages/operations/TaskAdherence.tsx` | `task_completions` | Via store |
| Task Templates | `src/pages/operations/TaskTemplates.tsx` | `task_templates` | `store_id` |
| Store Heatmap | `src/pages/operations/StoreHeatmap.tsx` | `stores` | Direct filtering |

---

## Implementation Approach

### Step 1: Update Modules to Use `useStoreAccess` Hook

For each module that needs fixing, apply the following pattern:

```tsx
import { useStoreAccess } from "@/hooks/useStoreAccess";

export default function ModuleName() {
  const { accessibleStoreIds, isAdmin, loading: accessLoading } = useStoreAccess();
  
  useEffect(() => {
    if (!accessLoading) {
      fetchData();
    }
  }, [accessLoading, accessibleStoreIds]);
  
  const fetchData = async () => {
    const storeIds = Array.from(accessibleStoreIds);
    
    let query = supabase.from("table_name").select("*");
    
    // Apply store filter for non-admins
    if (!isAdmin && storeIds.length > 0) {
      query = query.in("store_id", storeIds);
    }
    
    const { data, error } = await query;
    // ...
  };
  
  // Filter store dropdowns in forms
  const filteredStores = stores.filter(s => 
    isAdmin || accessibleStoreIds.has(s.id)
  );
}
```

### Step 2: Filter Store Dropdowns in Forms

When a Store Manager creates new records, the store dropdown should only show their assigned store(s):

```tsx
// In form dialogs
<SelectContent>
  {stores
    .filter(s => isAdmin || accessibleStoreIds.has(s.id))
    .map((store) => (
      <SelectItem key={store.id} value={store.id}>
        {store.name}
      </SelectItem>
    ))}
</SelectContent>
```

### Step 3: Handle Tables Without Store ID

Some tables like `spares` don't have a `store_id` column. Options:
1. Add `store_id` column via migration
2. Link through parent table (e.g., spares linked to assets which have store_id)

For `service_contracts`, filter through the `service_contract_locations` junction table.

---

## Files to Modify

### Phase 1: Critical Modules (User-Reported)

| File | Changes |
|------|---------|
| `src/pages/assets/AssetInventory.tsx` | Add `useStoreAccess`, filter assets query, filter store dropdown |
| `src/pages/assets/SparesManagement.tsx` | Add `useStoreAccess`, filter by linked assets or add store_id |
| `src/pages/services/ServiceContracts.tsx` | Add `useStoreAccess`, filter by contract locations |
| `src/pages/security/SecurityGuards.tsx` | Add `useStoreAccess`, filter guards by store_id |

### Phase 2: Secondary Modules

| File | Changes |
|------|---------|
| `src/pages/PettyCash.tsx` | Add `useStoreAccess`, filter petty cash records, filter store dropdown |
| `src/pages/security/PatrolPoints.tsx` | Add `useStoreAccess`, filter patrol points |
| `src/pages/security/SecurityRoster.tsx` | Add `useStoreAccess`, filter roster by guard's store |
| `src/pages/security/GuardFeedback.tsx` | Add `useStoreAccess`, filter feedback by store |
| `src/pages/inventory/Requisitions.tsx` | Add `useStoreAccess`, filter requisitions |
| `src/pages/inventory/GoodsReceipt.tsx` | Add `useStoreAccess`, filter GRN records |
| `src/pages/inventory/StoreTransfers.tsx` | Add `useStoreAccess`, filter transfers |
| `src/pages/vm/ComplianceTasks.tsx` | Add `useStoreAccess`, filter tasks |
| `src/pages/vm/PhotoSubmission.tsx` | Add `useStoreAccess`, filter submissions |
| `src/pages/operations/TaskAdherence.tsx` | Add `useStoreAccess`, filter adherence data |
| `src/pages/operations/TaskTemplates.tsx` | Add `useStoreAccess`, filter templates |
| `src/pages/operations/StoreHeatmap.tsx` | Add `useStoreAccess`, filter store list |
| `src/components/maintenance/MaintenanceFormDialog.tsx` | Filter store dropdown |
| `src/components/security/GuardFormDialog.tsx` | Filter store dropdown |

---

## Database Considerations

### Optional: Add store_id to Spares Table

If spares need direct store filtering, add a migration:

```sql
ALTER TABLE spares ADD COLUMN store_id UUID REFERENCES stores(id);
```

### Row Level Security (Backend Safety)

For defense-in-depth, consider adding RLS policies that enforce store access at the database level. This prevents data leakage even if the frontend filtering is bypassed.

Example pattern:
```sql
CREATE POLICY "Users can only view assets for their accessible stores"
ON assets FOR SELECT
USING (
  store_id IN (
    SELECT store_id FROM store_user_access WHERE user_id = auth.uid()
  )
  OR is_admin(auth.uid())
);
```

---

## Testing Plan

After implementation:

1. **Login as Suyog** (Store Manager for "Polar Bear - Manna Gudda")
2. Verify these modules show ONLY data from "Polar Bear - Manna Gudda":
   - Asset Register
   - Spares Management
   - Service Contracts (if any linked to that store)
   - Security Guards (guards assigned to that store)
   - Petty Cash
   - All other modules
3. Verify store dropdowns ONLY show "Polar Bear - Manna Gudda"
4. **Login as Admin** - verify all stores and data are visible
5. **Login as Shravya** - verify only "Polar Bear - Kottara" data is visible

---

## Technical Details

### Key Files Reference
- **Hook**: `src/hooks/useStoreAccess.ts` - Provides store access utilities
- **Auth**: `src/hooks/useAuth.ts` - Provides `isAdmin` flag
- **Database Trigger**: `sync_store_manager_access` - Auto-populates `store_user_access` when manager is assigned

### Store Access Logic Flow
```text
User Logs In
    ↓
useStoreAccess Hook Executes
    ↓
Checks store_user_access table for user's records
    ↓
If records exist → User sees ONLY those stores
If no records → User sees all non-restricted stores
If isAdmin → User sees ALL stores
```

