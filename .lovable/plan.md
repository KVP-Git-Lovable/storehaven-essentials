# Resume completed enrollments when the journey graph is extended

Add a "graph-extension" path to Resume so contacts whose `current_node_id` was a former terminal node (now has new outgoing edges) re-enter the engine at the newly appended node, without re-running anything upstream.

## Scope

- `supabase/functions/journey-actions/index.ts` — new `resume-preview` action + extend `resume` to perform the migration after confirmation.
- `src/pages/communication/JourneyBuilder.tsx` — replace the direct `pause → active` flip with a confirmation dialog that calls `resume-preview` first.
- New component `src/components/journey/ResumeJourneyDialog.tsx` — confirmation modal.
- No DB schema changes. No new tables. No changes to webhooks, audience evaluation, or `process-journeys` send paths.

## Eligibility rule (server-side, single source of truth)

An enrollment is eligible for graph-extension resume when ALL hold:

1. `journey_enrollments.journey_id = <this journey>`
2. `journey_enrollments.status = 'completed'`
3. `current_node_id` exists in the **current** `canvas_data.nodes`
4. That node's type is NOT `exit`
5. That node has **one or more outgoing edges** in the current canvas (it didn't, when this enrollment finished — otherwise the webhook would have advanced it)

Rows in `failed`, `active`, `pending_delivery`, or pointing at an `exit` node are never touched.

## New edge-function action: `resume-preview`

Request: `{ action: "resume-preview", journey_id }`

Logic:
- Load journey + `canvas_data`.
- Build a set of node IDs whose type ≠ `exit` AND that have at least one outgoing edge in the current canvas.
- Count enrollments grouped by `status` for this journey (single query, `.select("status, current_node_id")`).
- Eligible = `completed` rows whose `current_node_id` ∈ that set.
- For the dialog body, pick up to ~5 distinct `(terminal_node_id → next_node_id)` pairs and resolve them to friendly labels from `canvas.nodes[*].data` (template name, message-response condition + wait, etc.).

Response:
```json
{
  "eligible": 248,
  "remaining_completed": 12,
  "active": 0,
  "failed": 31,
  "transitions": [
    {
      "from_node_id": "...",
      "from_label": "Message: photo_collection_trayi",
      "to_node_id": "...",
      "to_label": "Message Response: Read within 3 days"
    }
  ]
}
```

No writes. Read-only.

## Extended `resume` action

Request: `{ action: "resume", journey_id, migrate_completed?: boolean }` (default `true`).

Sequence:
1. Re-compute eligibility (same rule as preview — never trust the client count).
2. If `migrate_completed` and eligible rows exist, for each eligible enrollment:
   - Determine `next_node_id` = first outgoing edge from `current_node_id` (prefer `sourceHandle === "yes"` only when the current node is a `decision`/`message_response`; otherwise just the first edge — appended chains we care about are linear from a former terminal).
   - Look up the contact's original send timestamp:
     ```ts
     supabase.from("journey_message_log")
       .select("sent_at, created_at")
       .eq("enrollment_id", e.id)
       .eq("node_id", e.current_node_id)
       .eq("channel", "whatsapp_template")
       .order("sent_at", { ascending: true, nullsFirst: false })
       .limit(1)
     ```
     Use `sent_at ?? created_at`. If neither exists (shouldn't happen for a `completed` row that passed through a message node), skip the row defensively.
   - Update only:
     ```
     status           = 'active'
     current_node_id  = next_node_id
     next_action_at   = <original sent_at>
     ```
   - Do this in batches of 200 via `.upsert(..., { onConflict: 'id' })` to keep round-trips bounded.
3. Flip `journeys.status = 'active'` (existing behavior).
4. Fire-and-forget `process-journeys` kickoff (existing behavior).
5. Return `{ success: true, resumed: <eligible_count>, transitions: [...] }`.

Why `next_action_at = original sent_at` works without any change to the engine:

`process-journeys/index.ts:1193` already does `arrived = enrollment.next_action_at` for `message_response` nodes and computes `dueAt = arrived + waitMs`. Seeding `next_action_at` with the original send timestamp means a "Read within 3 days" rule fires exactly 3 days after the template was sent, regardless of when the journey was resumed — matching the spec example.

If the new node is anything other than `message_response` (e.g. `delay`, `message`), `next_action_at = sent_at` is in the past, so the cron sweep at `:1363` (`.lte('next_action_at', now)`) picks it up immediately. Same behavior as if the node had existed all along.

## Duplicate-send protection (already in place — verified)

- Message node guards via unique insert on `journey_message_log (enrollment_id, node_id, channel)` at `process-journeys/index.ts:822-844`. Since we keep the same `enrollment.id`, a re-attempt to send the original Message node would be blocked and advance instead. We additionally avoid this by never pointing `current_node_id` back at the original message node — we point at `next_node_id`.
- Message Response evaluation at `:1205-1213` already queries `journey_message_log` by `enrollment_id + target_node_id`, so it will read the historical `delivered`/`read`/`replied` state correctly.
- Webhooks: late Twilio receipts for the original template still find the same `journey_message_log` row (by SID). For our migrated rows, `whatsapp-inbound:319` short-circuits when `delivery_status` is already `delivered`/`failed`, so it won't re-advance the enrollment. For rows still `pending` at resume time, the webhook will advance `current_node_id` to the new edge anyway — same outcome as the migration path, no conflict.

## UI: Resume confirmation dialog

`JourneyBuilder.tsx` currently calls `statusMutation.mutate("active")` directly for `paused → active`. Change that branch to:

1. Call `supabase.functions.invoke("journey-actions", { body: { action: "resume-preview", journey_id: id } })`.
2. Open `ResumeJourneyDialog` with the response.
3. On confirm, call `resume` action.
4. On cancel, do nothing.

`draft → active` activation flow is unchanged (still calls `activate`).

`ResumeJourneyDialog` (shadcn `AlertDialog`):
- Title: **Resume Existing Journey Participants**
- Body: lead sentence with `eligible` count, transitions list (`from_label → to_label`, max 5, "…and N more" if truncated), and a compact stats row showing **Resuming / Remaining completed / Active / Failed**.
- Footer note: the three "will NOT" guarantees from the spec.
- Buttons: **Cancel** / **Resume Journey**.
- If `eligible === 0`, skip the migration explanation and show "No completed participants need migration — the journey will simply resume." Single confirm button.

## Edge cases handled

- **Multiple new edges off the former terminal** (e.g. user added a `decision`): pick the first edge; if the former terminal is itself a `decision`/`message_response`, prefer the `yes` handle so resumed contacts route through the affirmative branch (their original message did succeed). Document this in code.
- **Former terminal was an `exit` node**: never eligible (rule 4).
- **`current_node_id` no longer exists** (rare, if the user deleted the node): never eligible (rule 3).
- **Enrollment already `pending_delivery`**: untouched. The next Twilio webhook will advance it through the new edge naturally.
- **Resume invoked twice**: second run finds zero eligible rows (status is now `active`), so it's a no-op flip.
- **Migration partially fails**: each batch upsert is independent; failures are logged but do not block journey activation. The processor will simply pick up whichever rows were updated.

## Out of scope (explicit)

- No change to `activate`, `pause`, audience resolution, or any send/webhook code.
- No change to analytics hooks — they read from `journey_message_log` / `journey_message_events`, both of which are untouched.
- No schema migrations.

## Verification

After implementation:
1. Build passes typecheck.
2. Deploy `journey-actions`.
3. Manual smoke on a test journey: add a Message Response node after a completed Message node, click Resume, confirm dialog shows correct counts, confirm, verify a sample enrollment now has `status='active'`, `current_node_id=<new node>`, `next_action_at=<original sent_at>`, and that the Message Response evaluates the historical log row.
