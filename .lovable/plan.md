

## Multi-segment audience with combination logic

Add an optional **multi-segment audience builder** to journeys. Existing single–list-view journeys keep working unchanged: they only use the new builder if the user opts in.

### 1. Data model — additive, backward-compatible

New column on `journeys`:

```sql
alter table public.journeys
  add column audience_config jsonb;
-- shape (only used when present):
-- {
--   "segments": [
--     { "key": "A", "label": "Birthday this month", "list_view_id": "<uuid>" },
--     { "key": "B", "label": "High value buyers",   "list_view_id": "<uuid>" }
--   ],
--   "combinator": "union" | "intersection" | "difference" | "only_a" | "only_b",
--   "primary": "A"   // for difference / only_x — the side to keep
-- }
```

Rules:
- If `audience_config IS NULL` → legacy behaviour (uses `list_view_id` exactly as today). **No existing journey is affected.**
- If `audience_config IS NOT NULL` and has ≥1 segment → it wins; `list_view_id` is ignored at runtime but kept in sync to the first segment for backward-compat with the canvas EntryNode badge.

No new tables; no migration of existing rows.

### 2. UI — `AudienceBuilder` panel inside Create Journey dialog

Replace the current single "List View" dropdown in `JourneyList.tsx` (Create dialog) with a new component `src/components/journey/AudienceBuilder.tsx`:

```text
┌── Audience Segments ────────────────────────────────────────┐
│  Segment A   [List view ▾ Birthday-this-month]   👥 1,240   │
│  Segment B   [List view ▾ High-value-buyers ]   👥   312   │ [×]
│  [+ Add segment]                                            │
│                                                             │
│  Combine using:                                             │
│   ◯ Union (A ∪ B)         — all unique users                │
│   ◯ Intersection (A ∩ B)  — users in both                   │
│   ◯ Difference (A \ B)    — in A but not in B               │
│   ◯ Only Segment A                                          │
│   ◯ Only Segment B                                          │
│                                                             │
│  Live preview                                               │
│   A: 1,240   B: 312   A∩B: 87   A∪B: 1,465                  │
│   ➜ Final audience: 1,378 unique contacts                   │
└─────────────────────────────────────────────────────────────┘
```

Behaviour:
- Starts with 1 segment (Segment A) — visually identical to today's flow when only A is set, so single-segment users see almost no change.
- "Add segment" appears only after A is chosen; max 2 segments in this iteration (covers UNION/INTERSECTION/DIFFERENCE — the operators the user requested). Plan leaves `segments[]` open-ended in the JSON for future N-way support.
- Combinator/primary radio panel only shows when 2 segments are configured.
- **Live preview** uses a single new edge-function call (see §4) per segment-list change, debounced 400 ms. Counts cached per `list_view_id` in React Query (`["audience-count", listViewId]`).

The same builder is also embedded in `JourneyBuilder.tsx` Entry-node side panel (`NodePropertyPanel` entry branch) so users can edit a journey's audience after creation. The Entry node itself (`EntryNode.tsx`) gains a second-line summary chip when `audience_config` exists: `A ∩ B · 87 contacts`.

### 3. Edge function — extend `journey-actions` `activate` + new `audience-preview`

**`supabase/functions/_shared/journey-schedule.ts`** — add `resolveAudienceConfig(supabase, audience_config)`:

1. For each segment, call existing `resolveListViewContacts(supabase, segment.list_view_id)` → returns the segment's contact-id set (already deduped, opted-out filtered, journey_contacts upserted).
2. Combine in JS using `Set` operations — the universe is small (capped at 10k per segment by existing logic):
   - `union` → `new Set([...A, ...B])`
   - `intersection` → `[...A].filter(x => B.has(x))`
   - `difference` → `[...primarySet].filter(x => !otherSet.has(x))` (`primary` selects which side)
   - `only_a` / `only_b` → returns just that segment's set
3. Always returns deduped array (`Set` guarantees per-user uniqueness, satisfying the dedup requirement).
4. Counts (matched/skipped/firstError) are aggregated across segments.

**`journey-actions/index.ts`** `activate` branch:
- If `journey.audience_config?.segments?.length` → call `resolveAudienceConfig`, else fall back to existing `resolveAudience` (legacy path untouched).
- Validates each segment's list view is an audience source (re-uses existing `ALLOWED_ENTITIES` check).

**New endpoint** `audience-preview` (same function, new `action`):
```ts
// body: { action: "audience-preview", audience_config }
// returns: { perSegment: { A: 1240, B: 312 }, intersection: 87, union: 1465, final: <count for current combinator> }
```
- Resolves each segment's contact ids (no DB writes — uses the read part of `resolveListViewContacts`, which we'll split so `journey-preview` skips the `upsert` step). Adds a tiny helper `resolveListViewContactIdsReadOnly`.
- **Cache**: in-memory Map keyed by `list_view_id` with 60 s TTL inside the edge function process — keeps live-preview cheap when the user toggles combinators without changing segments.

This guarantees **preview = execution**: both code paths derive contact sets from the same `resolveListViewContacts` helper.

### 4. Client wiring

- `src/components/journey/AudienceBuilder.tsx` — new component, owns segments + combinator state, calls `supabase.functions.invoke("journey-actions", { body: { action: "audience-preview", audience_config }})`.
- `src/pages/communication/JourneyList.tsx` — Create dialog: replace single list-view picker with `<AudienceBuilder/>`; on submit, save `audience_config` and set `list_view_id = segments[0].list_view_id` for canvas back-compat.
- `src/components/journey/NodePropertyPanel.tsx` — Entry node branch: when journey has `audience_config`, show a compact read-only summary + "Edit audience" button that opens the AudienceBuilder in a dialog and updates `journeys.audience_config`.
- `src/components/journey/EntryNode.tsx` — render combinator label + final count when `audience_config` present (re-uses preview endpoint).

### 5. Backward compatibility & constraints honoured

- Legacy journeys (`audience_config IS NULL`) hit the **exact same** `resolveAudience` code path as today — verified by short-circuit in `journey-actions`.
- No changes to `list_views`, `journey_contacts`, `journey_enrollments` schema.
- Dedup guaranteed by `Set`-based combination + existing per-phone dedup in `upsertContactsFromCustomers`.
- Performance: each segment capped at 10k rows (existing limit); preview uses 60 s in-memory cache; React Query caches preview results client-side; combinations are O(n) over already-bounded sets.
- Preview ↔ execution consistency: both compute via `resolveListViewContacts` + identical Set-combination helper.

### 6. Files to add / change

- **DB migration** — add `audience_config jsonb` to `public.journeys` (nullable, no default).
- **New** `src/components/journey/AudienceBuilder.tsx` — the segment + combinator + live-count UI.
- **Edit** `src/pages/communication/JourneyList.tsx` — embed AudienceBuilder in Create dialog; persist `audience_config` + sync `list_view_id`.
- **Edit** `src/components/journey/NodePropertyPanel.tsx` — show audience summary + edit button for entry node.
- **Edit** `src/components/journey/EntryNode.tsx` — render multi-segment summary chip + final count.
- **Edit** `supabase/functions/_shared/journey-schedule.ts` — add `resolveListViewContactIdsReadOnly` + `resolveAudienceConfig` + Set-combination helper.
- **Edit** `supabase/functions/journey-actions/index.ts` — branch on `audience_config` in `activate`; add `audience-preview` action with 60 s in-memory cache.

