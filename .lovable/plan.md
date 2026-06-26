## Problem

The **Status code failures** page shows "0 unresolved contacts" for both 63049 and 63024, even though Recent Messages clearly lists rows with those error codes.

Root cause: `StatusCodeFailuresTable` queries `journey_message_log` with `.eq("status", "failed")` AND `.eq("error_code", code)`. In the database, Twilio's 63049/63024 responses are stored as `status = 'undelivered'` with `delivery_status = 'failed'`, **never** as `status = 'failed'`. So the query always returns 0 rows.

(Some 63049/63024 rows also exist with `status=sent, delivery_status=delivered` — i.e. Twilio reported the code on an interim event but the message eventually delivered. Those must remain excluded.)

## Fix

In `src/components/journey/StatusCodeFailuresTable.tsx`, change the primary fetch to filter purely by `error_code` (drop the `status='failed'` filter) and instead treat a row as a candidate failure when:

- `error_code = <code>`, AND
- it is not a successful send (i.e. `delivery_status` is not in the success set AND `status` is not in the success set).

The existing person-level success exclusion (looking for any later successful send to the same phone in this journey) stays as-is — it correctly removes contacts who eventually received any message in the journey.

Pseudocode change:

```ts
const candidates = pagedRows.filter(r => !isSuccessfulLog(r));   // drop sent/delivered
// then dedupe by person_key (latest), then exclude personKeys present in successByPerson
```

No other component needs changes. The `process-journeys` write path that stamps `error_code` is already correct.

## Verification

After the change, on a journey with known 63049 rows:
1. Open Status code failures → 63049 tab → list populates with the undelivered contacts (matching the Recent Messages screenshot).
2. Switch to 63024 tab → list populates similarly.
3. Contacts who later received a successful send in the same journey are not shown.
4. "Retry selected" still works (no change to the retry path).
