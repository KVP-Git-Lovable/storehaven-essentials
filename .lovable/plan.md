# Preview Audience for Message Response Node

Add a **Preview Audience** button inside the Message Response node's property panel (right side editor). It evaluates, against the live `journey_message_log` for the selected upstream WhatsApp Template node, which contacts would currently satisfy the configured condition within the configured wait window.

## Where it appears

In `src/components/journey/NodePropertyPanel.tsx`, inside the existing `node.type === "message_response"` block (around line 693), directly below the **Wait Period** section. The button is enabled only when:
- An upstream template node is selected (`target_node_id` exists), AND
- Wait Period is set (any value, including 0 = "Immediately").

Disabled state shows a tooltip: *"Select an upstream template and wait period first."*

## What it does (no backend changes)

On click, opens a dialog that runs a Supabase query against the existing `journey_message_log` table — same source already powering Journey Analytics → View Logs.

Logic (client-side):
1. Compute `waitMs` from `wait_value` + `wait_unit` (minutes/hours/days).
2. Query rows for this journey scoped to the selected upstream message node:
   ```ts
   supabase.from("journey_message_log")
     .select("id, contact_id, status, delivery_status, sent_at, twilio_message_sid, journey_contacts(name, phone)")
     .eq("journey_id", journeyId)
     .eq("node_id", target_node_id)
     .not("sent_at", "is", null)
     .order("sent_at", { ascending: false });
   ```
   Paginated in 1000-row batches like `useJourneyMessageLogs` already does.
3. For the **Replied** / **Not Replied** conditions, also fetch inbound `whatsapp_messages` (paginated) and match by last-10-digits of phone with `created_at > sent_at` and `created_at <= sent_at + waitMs` — mirroring the existing `process-journeys` reply-detection rule, so preview matches the live evaluation.
4. For each contact, evaluate condition within the wait window:
   - **Delivered / Read / Failed / Undelivered / Replied**: status (or reply) achieved at any timestamp ≤ `sent_at + waitMs`.
   - **Not Delivered / Not Read / Not Replied**: contact has a `sent_at` row but did NOT reach the target status by `sent_at + waitMs` AND `now() >= sent_at + waitMs` (so we don't count contacts still inside the wait window as "Not …" yet).
5. Deduplicate by `contact_id` (keep most recent send).

## UI

- Button label: **Preview Audience** with refresh icon. Sits below Wait Period section.
- On click → `Dialog` titled "Audience Preview — {condition} within {wait_value} {wait_unit}".
  - Header: total matching count (e.g. "12 contacts will route to **Yes**").
  - Body: scrollable table with columns *Name, Phone, Sent At, Current Status, Window Ends At*.
  - Empty state: "No contacts match yet. The upstream template may not have been sent, or the wait window hasn't surfaced any matches."
- Read-only — no edits, no sends, no writes anywhere.

## Files touched

- `src/components/journey/NodePropertyPanel.tsx` — add button + dialog state.
- `src/components/journey/MessageResponseAudiencePreviewDialog.tsx` — new component encapsulating the query and table.

No edge function changes, no DB migration, no changes to evaluation logic in `process-journeys`, no changes to other node types.

## Example

Template sent to user A at 27 Jun 10:05 IST. Wait = 3 days, Condition = Read.
- Window ends 30 Jun 10:05 IST.
- If a `read`/`delivery_status=read` row exists for A with `sent_at` 27 Jun 10:05 (same row updated on Twilio webhook) and the read happened within the window → A appears in preview.
- If A only reached `delivered` and 30 Jun 10:05 has passed → A is excluded (preview is "would route Yes today").
