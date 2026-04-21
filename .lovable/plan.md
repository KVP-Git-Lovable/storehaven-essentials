

## Approval Inbox for Journey Builder

Add a "View Approvals" button (with pending count badge) and an inbox modal to `/communication/journeys` so approvers can act on pending journey approvals from one place.

### 1. Frontend — `src/pages/communication/JourneyList.tsx` (additive only)

**Header action bar (next to "Create Journey")**
- New secondary `Button` (variant `outline`): label "View Approvals". 
- When `pendingCount > 0`, show inline count badge: "View Approvals (N)".
- Always visible to all users (per spec). If user has no assigned approvals, the inbox shows an empty state: "No approvals assigned".

**Pending count query**
- `useQuery(["journey-approvals-count", user.id])`: counts journeys where `approval_status = 'pending'` AND `approver_id = current user`.
- Re-fetched on inbox open and after every approve/reject (invalidation).

**View Approvals modal** (new `<Dialog>`, large width)
- Tabs: **Pending** (default) · **Approved** · **Rejected**.
- Each tab is a table fed by a query filtered by `approval_status` and `approver_id = current user`.
- Columns: Journey Name, Submitted By (lookup `profiles.username` from `created_by`), Submitted Date (`submitted_at`), Schedule (derived from `canvas_data` entry node, same helper already used for the submit modal), Channels (derived from `canvas_data` message nodes), Audience (`list_view.name`), Actions.
- **Pending tab actions per row:**
  - **Approve** — mutation: update `approval_status = 'approved'`, `approved_at = now()`, clear `rejection_reason`. Toast + invalidate inbox + count.
  - **Reject** — opens a small inline prompt requiring `rejection_reason` (textarea, required). Mutation: update `approval_status = 'rejected'`, `rejection_reason`. Toast + invalidate.
- **Approved / Rejected tabs:** read-only history (no actions). Rejected tab also shows the `rejection_reason`.
- Optional filter inputs above the table: by channel (multi-select derived from current rows) and by submission date range. Implemented as simple client-side filters over the fetched list.

**Backward compatibility**
- All existing `journeys` rows have `approval_status` defaulted to `'draft'` by the migration already applied.
- Any journey that was previously submitted (i.e. has `approval_status = 'pending'` and a non-null `approver_id`) will appear in the Pending tab automatically — no data migration needed.
- Rows with `approval_status` null/missing are treated as Draft and excluded from the inbox; rendering elsewhere is unchanged.

**Access control**
- Inbox queries always filter by `approver_id = current user`, so non-approvers see an empty list (and a 0 badge).
- The button itself stays visible to everyone — the modal handles the empty state.

### 2. Backend / Database

No schema changes required. The columns added in the previous step (`approval_status`, `approver_id`, `submitted_at`, `approved_at`, `rejection_reason`, `approval_notes`) cover the entire workflow.

All approve/reject/list/count operations use direct `supabase.from("journeys")` queries with filters — no new edge functions or RPCs.

### 3. Real-time refresh

After each Approve/Reject the relevant queries are invalidated (`journeys`, `journey-approvals-pending`, `journey-approvals-count`), so the badge count and the row list update immediately. No polling/realtime channel added (keeps it lightweight); the count refetches on window focus per react-query defaults.

### 4. Constraints honored

- Journey Builder canvas, node panels, analytics, list-view sourcing, existing Submit-for-Approval modal, and existing row actions are untouched.
- No theme/color changes; reuses existing badge classes (`approvalBadgeClass`) and `Button` variants.
- No existing data is altered or deleted.

### Files

**Edit only:** `src/pages/communication/JourneyList.tsx` — add the View Approvals button, count query, inbox `Dialog` with three tabs, approve/reject mutations, and a small reject-reason sub-dialog.

No other files, no new migrations, no new edge functions.

