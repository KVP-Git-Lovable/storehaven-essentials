

# Plan: Generic List Views Module + Journey Builder Integration

## Overview

Build a brand-new **List Views** module (entity-agnostic saved filter system) covering Customers, Orders, Revenue, Products, Items, and Schemes. Replace the static "Target Segment" dropdown in Journey Builder with a "Target Segment (List View)" picker that resolves to a real audience at runtime. Old `segment_type` remains as fallback.

## 1. Database — `list_views` table (migration)

```sql
CREATE TABLE public.list_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  entity_type text NOT NULL,        -- 'customers' | 'orders' | 'revenue' | 'products' | 'items' | 'schemes'
  selected_fields jsonb NOT NULL DEFAULT '[]',
  filters jsonb NOT NULL DEFAULT '[]',  -- [{ field, operator, value }]
  visibility text NOT NULL DEFAULT 'private',  -- 'private' | 'shared'
  tags text[] DEFAULT '{}',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- RLS: users see own + 'shared'; admins see all; insert/update/delete by owner or admin
```

Add `list_view_id uuid REFERENCES list_views(id)` to `journeys` (nullable; coexists with `segment_type`).

## 2. List View Builder UI (new module)

**Route:** `/list-views`, `/list-views/:id`
**Sidebar:** Add under existing **Communication Center** → "List Views" (so it's discoverable next to Journey Builder).

**Files:**
- `src/pages/listviews/ListViewsList.tsx` — Table of saved views (name, entity, owner, tags, audience size, actions: Edit / Duplicate / Delete).
- `src/pages/listviews/ListViewBuilder.tsx` — Two-pane builder:
  - **Entity selector** (Customers / Orders / Revenue / Products / Items / Schemes)
  - **Field picker** (multi-select from entity schema)
  - **Filter rows** (field → operator → value). Operators auto-adapt to field type: string (equals/contains/starts with), numeric (=, ≠, >, <, between), date (=, before, after, between, last N days), boolean.
  - **Live preview table** (first 25 rows) + total count badge.
  - **Save** (name, description, visibility, tags).
- `src/components/listviews/FilterRow.tsx` — Single filter condition editor.
- `src/lib/listViewSchema.ts` — Per-entity field metadata (label, key, type, options). Hand-curated for the 6 entities so the UI stays type-safe.

## 3. List View Execution Engine

**File:** `src/lib/listViewExecutor.ts` — Client-side helper that takes a list view and returns a Supabase query (`.from(entity).select(...).eq/gt/lt/ilike/...`). Used both in the preview pane and analytics.

**File:** `supabase/functions/list-view-resolve/index.ts` — Server-side resolver.
- Input: `{ list_view_id }` (or inline definition for preview)
- Output: `{ count, rows? }`
- Validates entity name against an allow-list, applies filters using the Supabase client. Used by Journey activation.

## 4. Journey Builder Integration

**File:** `src/pages/communication/JourneyList.tsx` (Create modal)
- Replace static "Target Segment" `<Select>` with **SearchableSelect** of List Views, labelled `"View Name (Entity)"`.
- Helper text: *"Select a pre-configured list view to define your target audience"*.
- Quick action button: **+ Create New List View** → opens `/list-views/new` in a new tab (preserves modal state).
- Show **estimated audience size** badge once a view is selected (calls `list-view-resolve` with `count` only).
- Saves `list_view_id` on the journey; leaves `segment_type` null for new journeys.

**File:** `src/pages/communication/JourneyList.tsx` (table)
- "Segment" column shows the linked list view name when `list_view_id` is set, otherwise falls back to `segment_type` ("legacy").

## 5. Audience Resolution at Activation

**File:** `supabase/functions/journey-actions/index.ts` (existing)

Update the `activate` action:
1. If `journey.list_view_id` is set:
   - Call `list-view-resolve` to get matching rows from the linked entity.
   - Map entity rows → contacts: for `customers` use phone/email directly; for `orders` resolve via `customer_id`; for other entities (products/items/schemes/revenue) we cannot enroll directly — return a clear error: *"Selected list view's entity isn't an audience source. Use a Customers or Orders view."* (This avoids silent failure for the non-audience entities the user listed.)
2. Else fall back to existing `segment_type` logic against `journey_contacts` (legacy).

## 6. Backward Compatibility

| Scenario | Behavior |
|---|---|
| Existing journey with only `segment_type` | Works unchanged via fallback path |
| New journey with `list_view_id` | Uses new resolver |
| Journey list table | Shows list view name OR legacy segment label |
| Edit existing journey | Can switch to a List View; segment_type cleared on save |

## 7. Module Registration

`src/lib/modules.ts` — Add `communication.listviews` (parent: `communication`).
`src/components/layout/AppSidebar.tsx` — Add "List Views" entry under Communication Center.
`src/App.tsx` — Lazy-load and route `/list-views` and `/list-views/:id`.

## Files Touched

**New:**
- `supabase/migrations/<ts>_list_views.sql`
- `supabase/functions/list-view-resolve/index.ts`
- `src/pages/listviews/ListViewsList.tsx`
- `src/pages/listviews/ListViewBuilder.tsx`
- `src/components/listviews/FilterRow.tsx`
- `src/lib/listViewSchema.ts`
- `src/lib/listViewExecutor.ts`

**Edited:**
- `supabase/functions/journey-actions/index.ts` (activation logic)
- `src/pages/communication/JourneyList.tsx` (create modal + table column)
- `src/lib/modules.ts`
- `src/components/layout/AppSidebar.tsx`
- `src/App.tsx`

## Out of Scope / Notes

- Products/Items/Schemes/Revenue are kept as List View entities (per your selection) but flagged at activation time as non-audience entities — they're useful for analytics/reporting list views, not for enrolling contacts into journeys.
- No drag-and-drop field reordering in v1 (multi-select only); easy to add later.
- No changes to existing WhatsApp, templates, analytics, or canvas builder.

