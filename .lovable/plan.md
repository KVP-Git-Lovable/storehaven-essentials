
# NSO Budget Flow - Implementation Plan

## Summary

After exploring the codebase, I found that **some components exist** but the **complete budget tracking flow does not**. This plan will implement the full NSO Budget feature.

---

## What Already Exists

| Component | Status |
|-----------|--------|
| Sq Ft Budget Master | Available at `/master/sqft-budget` |
| Store Size (Sq Ft) field | Available in store creation/edit |
| NSO Checklist assignment flow | Works correctly |
| nso_store_assets table | Tracks required assets per checklist |
| `planned_budget` & `prescribed_sqft` columns in masters | Already added |

---

## What Needs to Be Implemented

### 1. Database Schema Updates

Create new tables and columns to support budget tracking:

**New table: `nso_store_budget_items`**
- For additional line items (Rent, Labour charges, other expenses)
- Columns: `id`, `checklist_id`, `description`, `category`, `amount`, `sort_order`, `created_at`

**Add columns to `nso_store_checklists`:**
- `prescribed_budget` (auto-calculated, read-only)
- `budget` (editable by Admin/Store Manager)
- `final_budget` (editable)

### 2. Prescribed Budget Auto-Calculation Logic

When a checklist template is assigned to a store:
```text
Prescribed Budget = Store's Sq Ft × Active Sq Ft Budget Rate
```
- Fetch the store's `store_size_sqft` from the `stores` table
- Fetch the active rate from `sqft_budget_master` where `status = 'active'`
- Store the calculated value in `nso_store_checklists.prescribed_budget`

### 3. Budget Section UI Component

Create a new component `NSOStoreBudgetSection.tsx` that displays:

**Three Budget Fields:**
- **Prescribed Budget** - Auto-calculated, read-only, shows store sq ft × rate
- **Budget** - Editable input for planned budget
- **Final Budget** - Editable input for final approved budget

**Budget Usage Tracking:**
- **Asset Costs Total** - Sum of (asset value × quantity) from `nso_store_assets`
- **Additional Line Items Total** - Sum from `nso_store_budget_items`
- **Total Utilized** - Asset Costs + Additional Items
- **Remaining Budget** - Budget - Total Utilized

**Visual Indicators:**
- Green: Within budget (utilized < 80% of budget)
- Amber: Nearing limit (80-100% of budget)
- Red: Over budget (utilized > budget)

### 4. Additional Line Items Management

Within the Budget section, allow users to add line items:
- **Description** (text input)
- **Category** (dropdown: Rent, Labour Charges, Utilities, Marketing, Other)
- **Amount** (numeric input)

All items reduce the remaining budget in real-time.

### 5. Update Checklist Assignment Flow

Modify `NewStoreOpening.tsx` to:
1. Fetch store's sq ft when assigning a checklist
2. Fetch active Sq Ft Budget rate
3. Calculate and store `prescribed_budget` during assignment
4. Copy `planned_budget` from master as initial `budget` value

### 6. Real-Time Budget Updates

Ensure budget calculations update when:
- Assets are added/removed/quantity changed
- Line items are added/removed/amount changed
- Budget or Final Budget fields are edited

---

## Technical Details

### Database Migration SQL

```sql
-- Add budget columns to nso_store_checklists
ALTER TABLE nso_store_checklists
  ADD COLUMN prescribed_budget NUMERIC DEFAULT 0,
  ADD COLUMN budget NUMERIC DEFAULT 0,
  ADD COLUMN final_budget NUMERIC DEFAULT 0;

-- Create budget line items table
CREATE TABLE nso_store_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES nso_store_checklists(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  amount NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE nso_store_budget_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view budget items"
  ON nso_store_budget_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage budget items"
  ON nso_store_budget_items FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
```

### Files to Create

1. **`src/components/nso/NSOStoreBudgetSection.tsx`**
   - Budget display component with three fields
   - Asset costs breakdown
   - Line items management
   - Remaining budget with visual indicators

### Files to Modify

1. **`src/pages/stores/NewStoreOpening.tsx`**
   - Add Budget section/tab to inline expanded checklist view
   - Update assign mutation to calculate prescribed budget
   - Add queries for budget items and asset values

2. **`src/integrations/supabase/types.ts`**
   - Auto-updated after migration

---

## User Flow After Implementation

```text
1. Admin defines rate in Sq Ft Budget Master (e.g., ₹200,000 per sq ft)
2. Admin creates store with size (e.g., 1,500 sq ft)
3. Admin goes to NSO and assigns checklist template to the store
4. System auto-calculates: Prescribed Budget = 1,500 × ₹200,000 = ₹300,000,000
5. Budget section appears in the checklist with:
   - Prescribed Budget: ₹300,000,000 (read-only)
   - Budget: [editable field]
   - Final Budget: [editable field]
6. As assets are added (e.g., 5 × AC @ ₹15,000 = ₹75,000):
   - Asset Costs: ₹75,000
   - Remaining Budget updates automatically
7. Admin can add line items:
   - Rent: ₹100,000
   - Labour: ₹50,000
8. Total Utilized: ₹225,000
   Remaining: Budget - ₹225,000
```

---

## Estimated Changes

| Category | Count |
|----------|-------|
| New tables | 1 |
| New columns | 3 |
| New components | 1 |
| Modified pages | 1 |

This implementation provides complete budget tracking for NSO with real-time calculations and visual status indicators.
