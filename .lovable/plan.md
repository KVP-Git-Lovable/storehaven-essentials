

## Journey Builder execution audit — findings & fixes

### Verdict: ❌ Current implementation does NOT satisfy the requirements.

The flow `Entry → Message → Exit` enrols the right audience, but the Message node **never actually sends a WhatsApp message** — it only writes a row to `journey_message_log`. Several other deviations below.

---

### Gaps found (validated against `journey-actions`, `process-journeys`, `whatsapp-send`, `list-view-resolve`)

| # | Stage | Gap | Impact |
|---|---|---|---|
| 1 | **Message delivery** | `process-journeys/index.ts` (lines 76–102) inserts a log row with `status: "sent"` but never calls `whatsapp-send` / Twilio. No template SID, no variables, no actual WhatsApp send happens. | **Critical** — “Sent” count is fake; customers receive nothing. |
| 2 | **Scheduler** | No cron / `pg_cron` job invokes `process-journeys`. Enrollments sit forever at `next_action_at = now()` with nothing draining them. | **Critical** — journey never advances even if (1) is fixed. |
| 3 | **Channel handling** | Message node stores `whatsapp_template_id`, `whatsapp_template_name`, `template_variables` (see `JourneyBuilder.tsx` defaults), but `process-journeys` ignores all of them and treats every message as a free-text body with naive `{name}` interpolation. | **Critical** — template integrity broken; configured SID not used. |
| 4 | **Audience source = Customers** | `resolveListViewContacts` filters customers, then re-filters via `journey_contacts` table. Customers not pre-loaded into `journey_contacts` are silently dropped. Audience preview (uses `customers` directly) ≠ enrolled set. | **High** — preview/enrolled mismatch ("audience leakage" in reverse). |
| 5 | **Phone normalisation** | Customer phones may be `+91…`, `91…`, or `9xxxxxxxxx`; `journey_contacts` join is exact-match on `phone`. | **High** — silent drops. |
| 6 | **De-dup / idempotency** | No unique constraint on `(journey_id, contact_id, current_node_id)` and no guard if `process-journeys` runs concurrently → same Message node could send twice. | **High** — duplicate sends. |
| 7 | **Exit termination** | Exit node logic is correct (sets `status='completed'`), but only fires on the *next* tick after Message advances. Acceptable, but combined with (2) it never actually fires. | Medium |
| 8 | **24-hour session enforcement** | User-initiated templates require an open session; we don't check the customer's last inbound timestamp before sending. | Medium (compliance risk) |
| 9 | **Outbound logging** | When fixed, each send must also write to `whatsapp_messages` so it appears in the Conversations dashboard. `whatsapp-send` already does this — must reuse it, not bypass it. | Medium |

---

### Required fixes

**A. Replace fake send with real Twilio call in `process-journeys`**

For `nodeType === "message"`:
1. Read `currentNode.data`: `whatsapp_template_id`, `whatsapp_template_name`, `template_variables`, `channel`.
2. Fetch contact's phone (already joined via `journey_contacts`).
3. Fetch active WhatsApp sender (`whatsapp_senders` where `is_active=true`, take first) for `from_number`.
4. Resolve template variables — replace `{customer_name}`, `{phone}`, etc. from contact fields per `template_variables` mapping.
5. Invoke `whatsapp-send` via service-role internal HTTP call with `{ template_id, to_number, from_number, variables, journey_enrollment_id }`. This guarantees:
   - exact ContentSid used
   - `whatsapp_message_log` + `whatsapp_messages` rows written
   - approval check enforced
6. On success → `journey_message_log` insert with `status='sent'` AND `twilio_message_sid`. On failure → `status='failed'`, `error_message`, **do not advance** (or advance to a configurable failure path; default: complete with `failed` status to prevent infinite retry).
7. Loosen the `whatsapp-send` approval check to allow `status='approved' OR user_initiated_approved=true` when invoked from a journey context (new optional `allow_user_initiated: true` body flag).

**B. Idempotency**

- Add unique partial index: `unique (enrollment_id, node_id) on journey_message_log` so a given enrollment cannot be sent the same Message node twice.
- Wrap message-step in: `INSERT … ON CONFLICT DO NOTHING` — if conflict, skip send and just advance.
- Add `node_id` column to `journey_message_log` (migration).

**C. Schedule the worker**

- Enable `pg_cron` + `pg_net`, schedule `process-journeys` every 1 minute via SQL:
  ```sql
  select cron.schedule('journeys-tick', '* * * * *',
    $$ select net.http_post(url := '<edge-url>/process-journeys', headers := '{"Authorization":"Bearer <service-role>"}'::jsonb) $$);
  ```

**D. Fix audience fidelity**

In `journey-actions` `resolveListViewContacts`:
- For `customers` entity: stop joining via `journey_contacts`. Build/upsert `journey_contacts` rows on the fly from the customers result set (one-to-one), then enrol — so preview count = enrolled count.
- Normalise phones to E.164 (`+` prefix, strip non-digits, prepend default country code from company info if missing) **before** upsert.
- Deduplicate by normalised phone.

**E. Activation safety**

- Already deletes stale `active`/`paused` enrollments on activate ✓ (good).
- Also delete orphan enrollments whose `contact_id` is no longer in the resolved set.

**F. (Optional, recommended) 24h window check**

Before sending a `user_initiated_approved` (non-business) template, query `whatsapp_messages` for the contact's most recent `direction='inbound'` within 24h. If none → mark message log `skipped_outside_session` and advance. This keeps WhatsApp policy compliance.

---

### Files to change

- **Edit** `supabase/functions/process-journeys/index.ts` — invoke `whatsapp-send`, idempotency, error handling, node_id tracking.
- **Edit** `supabase/functions/whatsapp-send/index.ts` — accept `allow_user_initiated` flag, return `twilio_message_sid` always.
- **Edit** `supabase/functions/journey-actions/index.ts` — upsert `journey_contacts` directly from customers query, normalise phones.
- **Migration**:
  - Add `node_id text` to `journey_message_log` + unique index `(enrollment_id, node_id)`.
  - Enable `pg_cron`, `pg_net` extensions and schedule `process-journeys` every minute.

### Confirmation after fix

Once applied, an `Entry (List View) → Message (template HX…) → Exit` journey will:
1. Resolve audience deterministically from list view → upsert into `journey_contacts` 1:1 → enrol exactly that set.
2. On each cron tick send the **exact** template SID + variables via Twilio, once per contact (idempotent).
3. Log to `whatsapp_messages` so it appears in Conversations.
4. Advance to Exit and mark enrollment `completed` — no further action.

