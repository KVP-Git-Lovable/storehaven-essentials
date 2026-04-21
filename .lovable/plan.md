

## Approval Workflow for Journeys

Add a "Submit for Approval" workflow to `/communication/journeys` without altering existing layout or behavior.

### 1. Database (migration)

Add nullable columns to `journeys` (additive, non-breaking):

- `approval_status` text — values: `draft`, `pending`, `approved`, `rejected` (default `draft`)
- `approver_id` uuid — references `profiles(id)`
- `submitted_at` timestamptz
- `approved_at` timestamptz
- `rejection_reason` text
- `approval_notes` text

Existing `status` column remains untouched. Existing rows get `approval_status = 'draft'` by default.

### 2. Frontend — `src/pages/communication/JourneyList.tsx`

**New "Submit" action button** in each row's actions cell:
- Icon: `Send` (lucide-react)
- Visible only when `journey.status === 'draft'` AND `approval_status` is `null`/`'draft'`/`'rejected'`
- Placed alongside existing Play/Pause/Analytics/Delete buttons (no layout change)

**Status column enhancement:** when `approval_status === 'pending'`, show an additional small badge "Pending Approval" next to the existing status badge. Approved/Rejected get matching badges. Existing badges and colors untouched.

**Submit for Approval Modal** (new `<Dialog>`), opens on Submit click. Sections:

- **A. Journey Summary**
  - Name, Status, Created By (from `profiles` lookup), Last Updated (`updated_at`)
- **B. Schedule Details**
  - Start Date / End Date / Frequency (derived from canvas Entry node config when available; show "—" if not set; read-only)
- **C. Channel Summary**
  - Scan `canvas_data.nodes` for `message` nodes, list channels in use (Email / SMS / WhatsApp / WhatsApp Template) with template names where applicable
- **D. Audience Summary**
  - List View name (already joined) + estimated audience size (reuse `executeListView({ countOnly: true })` — same pattern already used in this file)
- **E. Approver Selection** (required)
  - `SearchableSelect` populated from `profiles` joined to `user_roles_master`, filtered to roles `Store Manager` and `Super Admin` (these are the manager-level roles in this project)
- **F. Notes** (optional textarea: "Add notes for approver")

**Submit action** updates the journey row:
```
approval_status = 'pending'
approver_id = <selected>
submitted_at = now()
approval_notes = <notes>
```
On success: toast, close modal, invalidate `journeys` query.

**Post-submit UI behavior:**
- Submit button hidden (already covered by the visibility rule above)
- Pending Approval badge shown
- Existing Play action remains — but for governance we will additionally disable the Play (activate) button while `approval_status === 'pending'` so a draft cannot be activated until approved (small additive guard, no removal of existing logic)

### 3. Out of scope (future-ready, as noted)

Approve/Reject screens for the approver are not built in this round — only the schema fields and submission flow are added so the future approval UI can plug in directly.

### Files

**Migration (new):** add the six columns to `public.journeys`.

**Edit:** `src/pages/communication/JourneyList.tsx` — add Submit button, modal, helper queries (created-by profile, manager-eligible approvers), mutation, and pending/approved/rejected badges.

No other files need changes. Existing Journey Builder canvas, node panels, analytics, and list view sourcing remain intact.

