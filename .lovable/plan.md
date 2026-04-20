

Looking at the existing code:
- `JourneyList.tsx` already saves `list_view_id` on the journey
- `journey-actions/index.ts` already resolves `list_view_id` → contacts at activation
- `process-journeys/index.ts` only operates on already-enrolled contacts (so it's already scoped — good)
- `EntryNode.tsx` still shows static `segment_type` / city — doesn't reflect the bound List View
- `JourneyBuilder.tsx` (canvas) likely lets the Entry node be configured independently

The core data-flow scoping is mostly already correct (enrollments are created from list_view at activation, then process-journeys only reads those enrollments). The gaps are:

1. **Entry node UI** doesn't show the bound List View
2. **Entry node property panel** still allows segment_type / city edits when a List View is bound
3. **No re-resolution** at activation if filters are dynamic (e.g. "birthday in next 7 days") — already handled because resolver runs at activation, but **stale enrollments** persist if journey is re-activated
4. **No audience preview** from canvas
5. **Validation** that entity matches expected audience source

# Plan: Bind Entry Node to List View + Strict Audience Scoping

## 1. Entry Node UI (`src/components/journey/EntryNode.tsx`)

When journey has `list_view_id`:
- Header label: **"Customer (Filtered via List View)"**
- Show List View name + entity badge: *"From: High Value Birthdays (customers)"*
- Show live audience count badge (calls `list-view-resolve` with `mode=count`)
- "Preview Audience" link → opens small dialog with first 10 matching rows

When no list_view_id: keep current behavior (legacy segment_type display).

Pass `list_view_id` + `list_view_name` into the node's `data` from `JourneyBuilder.tsx` when building the canvas.

## 2. Node Property Panel (`src/components/journey/NodePropertyPanel.tsx`)

For Entry nodes:
- If `list_view_id` is bound on the journey: **disable** segment_type and city inputs, show banner *"Audience is controlled by the linked List View. Edit the List View or change it from journey settings."* with a "Open List View" link
- If no list_view_id: show current segment_type/city editor (legacy)

## 3. JourneyBuilder canvas wiring (`src/pages/communication/JourneyBuilder.tsx`)

- On load, fetch journey's `list_view_id` + linked `list_views.name` + `entity_type`
- Inject these into the Entry node's `data` so EntryNode renders correctly
- Add a top-bar pill: *"Audience: {list_view_name}"* with a "Change" button → opens a small picker (reuses the SearchableSelect of list views from JourneyList)

## 4. Audience Preview Dialog (new: `src/components/journey/AudiencePreviewDialog.tsx`)

- Calls `list-view-resolve` with `mode=rows`, displays first 10 records (name, phone, key fields)
- Shows total count
- Triggered from Entry node "Preview Audience" button

## 5. Strict scoping at activation (`supabase/functions/journey-actions/index.ts`)

Already resolves via `list_view_id` → already scoped. Add safety guards:
- **Re-resolve every activation** (already does — confirm by re-reading)
- On re-activate: clear stale `active` enrollments for this journey first, so dynamic filters (e.g. birthdays) produce a fresh audience set
- Validate `entity_type` is an audience source (`customers` or `orders`); reject with clear error otherwise
- If journey has `list_view_id`, **never** fall back to segment_type (current code already does this correctly via the if/else)

## 6. Process-journeys safety check (`supabase/functions/process-journeys/index.ts`)

Currently iterates `journey_enrollments` filtered by `journey_id` — already scoped. No fallback to entity tables exists, so data-flow enforcement is already correct. Add a comment block documenting this invariant. No code change required beyond the comment.

## 7. Validation rule

In `JourneyList.tsx` Create modal (already validates audience source via resolver error). Add the same check when **changing** a list view on an existing journey from the canvas top bar.

## Files Touched

**Edited:**
- `src/components/journey/EntryNode.tsx` — new bound display + audience count + preview button
- `src/components/journey/NodePropertyPanel.tsx` — disable manual entity edits when bound
- `src/pages/communication/JourneyBuilder.tsx` — fetch list view metadata, inject into Entry node data, top-bar audience pill
- `supabase/functions/journey-actions/index.ts` — clear stale enrollments on re-activation; explicit audience-source validation; documenting comment

**New:**
- `src/components/journey/AudiencePreviewDialog.tsx` — sample rows + count

**No DB changes required.** Existing schema already supports this (journeys.list_view_id + list_views table).

## Backward Compatibility

- Journeys with only `segment_type` (no list_view_id): Entry node renders legacy view, property panel allows edits — unchanged
- Journeys with `list_view_id`: new bound UI, manual entity overrides disabled
- Activation logic already prefers list_view_id over segment_type (existing code) — preserved

## Why this guarantees strict scoping

1. Audience set is built **only** from `list-view-resolve` output at activation
2. `journey_enrollments` table is the **only** source `process-journeys` reads
3. No node type (message/decision/delay/exit) reads the source entity table — they all operate on enrollments + their joined `journey_contacts`
4. Stale enrollments cleared on re-activation → dynamic filters (next N days, recurring birthdays) re-evaluated fresh

