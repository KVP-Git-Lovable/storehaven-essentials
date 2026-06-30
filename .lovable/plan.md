## Goal
Add a new Journey node type — **Message Response** — that branches based on how a participant engaged with a previously sent WhatsApp Template message. Reuses existing webhook/event tracking, no schema migration, fully backward compatible with existing draft/active/paused journeys.

## Scope
Frontend (Journey Builder canvas + property panel + analytics) and the `process-journeys` edge function. No DB schema changes. No changes to existing node types, message sending, or webhook code.

---

## 1. New Node Component
**File:** `src/components/journey/MessageResponseNode.tsx` (new)
- Visual style mirrors `DecisionNode`: rounded card, target handle on top, two source handles (`yes` green / `no` red) on bottom.
- Icon: `MessageCircle` (lucide-react), accent color teal/cyan to distinguish from purple Decision node.
- Body shows: target template node label (e.g. "Welcome Template"), condition (e.g. "Read"), and wait period (e.g. "Wait 1h").

## 2. Register Node Type
**File:** `src/pages/communication/JourneyBuilder.tsx`
- Import `MessageResponseNode`, add `message_response: MessageResponseNode` to `nodeTypes`.
- Add a new toolbar button (between Decision and Exit) labeled "Message Response" with `MessageCircle` icon.
- Default node data: `{ target_node_id: null, condition: "read", wait_value: 1, wait_unit: "hours" }`.

## 3. Property Panel Editor
**File:** `src/components/journey/NodePropertyPanel.tsx`
Add a new editor block for `node.type === "message_response"` with:
- **Evaluate Message** dropdown — built from `nodes` prop, listing only message nodes that:
  - appear **before** the current node in the graph (BFS from entry, stop at current node), AND
  - have `channel === "whatsapp_template"` (or `message_type === "template"`).
  - Each option label = template name or node label; value = node id.
  - If no eligible upstream template node exists → show warning: *"Add a WhatsApp Template message node before this node to enable engagement tracking."*
- **Condition** dropdown — Delivered, Not Delivered, Read, Not Read, Replied, Not Replied, Failed, Undelivered.
- **Wait Period** — preset chips (Immediately, 30 min, 1 hr, 6 hr, 24 hr) + Custom (number + unit minutes/hours/days).
- Validation: if `target_node_id` references a deleted node, show red banner *"Referenced message node no longer exists — please reselect."*

## 4. Execution Logic
**File:** `supabase/functions/process-journeys/index.ts` — add a new `if (nodeType === "message_response")` branch (parallel to the existing `decision` block at line 1161).

Algorithm per enrollment:
1. Read `target_node_id`, `condition`, `wait_value`, `wait_unit` from node data.
2. **Wait gate** — compute `waitMs`; if `Date.now() < arrived_at + waitMs`, return without advancing (the existing `next_action_at` mechanism handles re-checking). On first visit, set `next_action_at = arrived_at + waitMs` so the cron picks it up at the right time.
3. **Find the sent message** — query `journey_message_log` for `(enrollment_id = X, node_id = target_node_id)` to get the `twilio_message_sid` (or fall back to `(contact_id, journey_id, node_id)` for older rows).
4. **Evaluate condition** against existing data:
   - `delivered` / `read` / `failed` / `undelivered` → check `journey_message_log.delivery_status` / `status`.
   - `replied` → check `whatsapp_messages` for inbound rows from the contact's phone with `created_at > sent_at`.
   - Negative conditions (`not_delivered`, `not_read`, `not_replied`) → invert the result.
5. Pick branch (`yes` / `no`) using the same `sourceHandle` matching pattern as the decision node, advance `current_node_id`.
6. Evaluate **once** per visit — no retry loop.

If the referenced template node was deleted or the message was never sent, route through `no` branch and log a warning event (so the journey doesn't deadlock).

## 5. Analytics
**File:** `src/hooks/useJourneyAnalytics.ts` and `src/pages/communication/JourneyAnalytics.tsx`
- For each `message_response` node in the canvas, compute and surface:
  - **Evaluated** — enrollments that passed through the node.
  - **Matched (Yes)** — routed down `yes` handle.
  - **Unmatched (No)** — routed down `no` handle.
  - **Match Rate %** — Matched / Evaluated.
- Reuse existing per-node aggregation pattern already used for message nodes; new metric rows appear in the Node Performance table with a distinct "Response" badge.

## 6. Backward Compatibility
- No DB schema changes.
- Existing journeys load unchanged (no `message_response` nodes present).
- New node type only activates when explicitly added.
- Existing `decision`, `message`, `delay`, `entry`, `exit` paths and webhook handlers untouched.

---

## Technical Notes (for developer reference)

**Canvas data shape (stored in `journeys.canvas_data` JSONB):**
```json
{
  "id": "node_xxx",
  "type": "message_response",
  "data": {
    "target_node_id": "node_yyy",
    "condition": "read",
    "wait_value": 1,
    "wait_unit": "hours"
  }
}
```

**Wait-gate persistence:** reuse `enrollment.next_action_at`. On first arrival at the node, if `next_action_at` was set at edge-traversal time (current behavior), compute `delayUntil = next_action_at + waitMs` and if `now < delayUntil`, push `next_action_at = delayUntil` and return; otherwise evaluate.

**Reply detection query:** `whatsapp_messages` where `direction='inbound'` and normalized phone matches `journey_contacts.phone` and `created_at >` the matching `journey_message_log.sent_at`.

**No new tables, no new columns, no migrations.**
