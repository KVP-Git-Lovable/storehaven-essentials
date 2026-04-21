

## Journey List — Filters & Active Row Highlighting

Add a filter bar above the journeys table on `/communication/journeys` and visually highlight active (live) journeys. All changes are additive to `src/pages/communication/JourneyList.tsx` — no DB, no API, no workflow changes.

### 1. Filter bar (above the table, inside the existing `<Card>`)

A compact, single-row toolbar (wraps on mobile) with:

- **Status** — multi-select (`MultiSelectCombobox`): Draft, Pending Approval, Approved, Active, Rejected.
  - Maps to: `Draft` → `status='draft' AND approval_status IN (null,'draft')`; `Pending Approval` → `approval_status='pending'`; `Approved` → `approval_status='approved' AND status!='active'`; `Active` → `status='active'`; `Rejected` → `approval_status='rejected'`.
- **Frequency** — multi-select: One-time, Recurring, Trigger-based.
  - Source: prefer `journey_schedules.type` (`one_time` → One-time, `recurring` → Recurring); fallback to entry node `data.frequency` / `data.triggerType` in `canvas_data` to detect `trigger`/`event` → Trigger-based.
- **Channel** — multi-select: WhatsApp, Email, SMS, Voice. Derived from message nodes in `canvas_data` (same `deriveJourneyMeta` helper already in file, extended to return all channels).
- **Created By** — `SearchableSelect` populated from the `profiles` of `created_by` ids present in the loaded journeys (no extra query — we already join names elsewhere; we'll add a small lookup map mirroring `submitterMap`).
- **Created date range** — two `<Input type="date">` (From / To) applied to `created_at`.
- **Clear filters** button on the right when any filter is active.

All filters combine with **AND** logic and run **client-side** over the existing `journeys` query (dataset is small; no new API). React's `useMemo` produces `filteredJourneys` rendered by the table.

### 2. Active row highlighting

In the `journeys.map(...)` row render, add a conditional class on `<TableRow>` when `j.status === 'active'`:

```
className={cn("cursor-pointer", j.status === 'active' && "bg-green-50 hover:bg-green-100")}
```

Uses Tailwind tokens already used elsewhere in the file (`bg-green-100`, `text-green-800`) so it stays inside the existing palette — no new colors. Text remains the default foreground for full readability. Highlight persists regardless of active filters and works with sorting/pagination (none added here; existing order is preserved).

### 3. Status badges (already present, lightly extended)

The existing badges (`statusColors`, `approvalBadgeClass`) already render green/yellow/red for Active/Pending/Rejected. We'll just ensure:
- `active` → green (already `bg-green-100 text-green-800`).
- `pending` → yellow (already).
- `rejected` → red (already).
- Add `approved` to `statusColors` mapping rendering as green outline so an "Approved (not yet active)" journey is also visually distinct.

No new badge components introduced.

### 4. Empty / count state

Below the filter bar, show a small muted line: `Showing {filteredJourneys.length} of {journeys.length} journeys` when any filter is active. The "No journeys yet" empty state is replaced with "No journeys match the selected filters" when filters are active and the result is empty.

### 5. Constraints honored

- No changes to Journey Builder canvas, approval workflow, scheduling, mutations, or backend.
- No new tables, edge functions, or RLS changes.
- No layout restructure — filter bar slots above the existing table inside the same `<Card>`.
- No new color tokens; reuses existing Tailwind green/yellow/red shades already in the file.

### Files

- **Edit only:** `src/pages/communication/JourneyList.tsx`
  - Add filter state (`statusFilter`, `frequencyFilter`, `channelFilter`, `createdByFilter`, `dateFrom`, `dateTo`).
  - Add `filteredJourneys` `useMemo` applying AND-combined filters.
  - Add filter toolbar JSX above the `<Table>` using existing `MultiSelectCombobox`, `SearchableSelect`, and `Input` components.
  - Extend `deriveJourneyMeta` to also expose channels for list rows (already does for inbox).
  - Add green row class for `status === 'active'`.
  - Add `approved` entry to `statusColors`.

No other files modified.

