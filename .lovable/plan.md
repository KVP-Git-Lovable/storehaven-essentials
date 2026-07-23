## Verified findings so far

- Source row counts currently are:
  - `customers`: 310
  - `inventory_items`: 12
  - `order_items`: 4
  - `orders`: 3
  - `profiles`: 3
  - `user_roles_master`: 2
- The source-side mirror triggers are present and enabled on all 6 source tables.
- The source-side backfill function is present and queues calls to the `backup-mirror` function.
- The latest source-side async HTTP responses show the backfill did run, but several table writes failed at the external destination:
  - `trayi_customers`: missing `city`
  - `trayi_orders`: missing `created_by`
  - `trayi_order_items`: missing `discount_percent`
  - `trayi_profiles`: missing `reports_to`
- `backup_mirror_failures` being empty is not enough proof of success because the current trigger uses async HTTP; external function failures are recorded in the async HTTP response table / function logs, not in `backup_mirror_failures`.
- The external destination URL and `trayi_` prefix are being reached, because the errors are coming from `trayi_*` destination tables.

## Plan

1. **Make the mirror auditable from this project**
   - Add a dedicated source-side audit table for backup mirror attempts.
   - Record per-table and per-batch results: source table, destination table, row count attempted, success/failure, HTTP status, and error message.
   - Update the `backup-mirror` function to write audit results back to this project using the existing secure backend key.
   - This fixes the current blind spot where async failures only appear in low-level HTTP logs.

2. **Add count-only external verification**
   - Add a protected audit action to the `backup-mirror` function that reads only row counts from the external `trayi_*` tables.
   - It will not read or return customer/order/user data values — only counts by table.
   - This is needed because the current design is write-only, so we cannot verify external population from this side without a count-only diagnostic path.

3. **Generate a complete external schema catch-up script**
   - Produce a new idempotent SQL script for the external backup project covering all mirrored columns for:
     - `trayi_customers`
     - `trayi_orders`
     - `trayi_order_items`
     - `trayi_inventory_items`
     - `trayi_profiles`
     - `trayi_user_roles_master`
   - Include the columns already confirmed missing and any other mirrored columns, so we do not hit one-missing-column-at-a-time failures.
   - You will need to run this in the external backup project because this app only has REST/service-key access there, not schema-change access.

4. **Make backfill execution safer and verifiable**
   - Update the backfill function so each table/batch gets a trace identifier.
   - After the external schema is fixed, re-run backfill table-by-table.
   - After each table backfill, verify:
     - source-side audit says success,
     - async HTTP responses are clean,
     - external count-only audit matches expected source count.

5. **Verify ongoing mirroring without changing business logic**
   - Confirm triggers remain enabled on all 6 source tables.
   - Confirm future inserts/updates will call the same audited mirror function.
   - If you approve a production-safe smoke test, perform one minimal update on a non-sensitive existing row and verify the audit trail and external count/status. If not, limit verification to trigger definitions plus backfill/audit proof.

6. **Final production report**
   - Provide a table-by-table report with:
     - source count,
     - external count,
     - latest successful mirror timestamp,
     - latest failure, if any,
     - trigger status.

## Technical notes

- The current root issue is confirmed as external destination schema mismatch plus insufficient async failure visibility.
- I will not change existing app flows or business logic.
- The backup remains additive: source tables continue working even if the external mirror fails.
- I will not expose or print any secret keys.