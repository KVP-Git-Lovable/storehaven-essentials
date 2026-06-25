## Problem

In `src/hooks/useJourneyAnalytics.ts`, the Journey Funnel currently counts **message rows** (events), and those rows are further restricted by the date-range filter (`Last 30 days`, etc.).

That's why "Delivered" goes down over time — older delivered messages fall out of the window, and the same contact is counted once per message instead of once per journey.

## Fix (scoped to the funnel + Entered Journey only)

Rework the funnel block in `useJourneyAnalytics.ts` so every funnel stage is a **distinct count of `contact_id`s in this journey** who ever reached that stage, ignoring the date-range filter. Other widgets (Engagement Over Time trend, heatmap, node performance, cohorts, attribution, KPI strip rates) stay as-is.

### New funnel logic

Iterate over the full `messagesQ.data` (not `filteredMsgs`) and build per-contact Sets:

- `deliveredContacts` — contact ids with at least one row where `status ∈ {delivered, read}` or `delivery_status = 'delivered'`.
- `readContacts` — contact ids with at least one row where `status = 'read'`.
- `clickedContacts` — contact ids whose phone appears in `whatsapp_link_clicks` for this journey (already journey-scoped).
- `repliedContacts` — contact ids whose phone has an inbound message after their first-ever `sent_at` in this journey (compute `firstSentByPhone` from all messages, not filtered).
- `orderContacts` — distinct contacts among `ordersAttributed` (already attributed to first send).

Funnel becomes:

```text
Entered Journey  = uniqueEnrollments.length          (unchanged; already deduped by contact)
Delivered        = deliveredContacts.size
Read             = readContacts.size
Clicked          = clickedContacts.size
Replied          = repliedContacts.size
Order Placed     = orderContacts.size
```

Percentages on the funnel bars continue to be `count / entered * 100`.

### Entered Journey

Already deduped by `contact_id` (latest enrollment per contact). Confirmed correct — for the example journey it equals the audience size (1,000). No change needed beyond keeping the existing dedupe.

### What does NOT change

- KPI strip values (`sent`, `delivered`, `read`, `failed`, `delivery rate`, `read rate`, etc. used by the top cards) keep their current event-count semantics and continue to respect the date range. Only the **Journey Funnel** array uses the new unique-contact counts.
- `Engagement Over Time` trend, heatmap, node performance, cohorts, attribution windows, health score, insights — unchanged.
- No UI / layout / component changes. No DB or edge-function changes.

### Files touched

- `src/hooks/useJourneyAnalytics.ts` — add the unique-contact Sets computed over the unfiltered `messages` array and swap the `funnel = [...]` values to use those Set sizes. ~25 lines.
