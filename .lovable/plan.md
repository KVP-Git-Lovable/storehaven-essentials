

## Show user-initiated approved templates in journey Message node

### Problem

Twilio templates can be approved in two scopes:

- **Business-initiated** — formal Content Template Approval (`approvalRequests.whatsapp.status === 'approved'`). Required to message a contact outside the 24-hour session window.
- **User-initiated** — eligible for sending inside an active 24-hour customer session window. In Twilio's console this shows as "WhatsApp user initiated" and is granted broadly to most well-formed templates, even when the formal business-initiated approval is still `pending`.

Today our sync only flips a template to `status='approved'` when `whatsapp.status === 'approved'`. Templates like `highvalue_8lakh` (formally `pending`, but user-initiated eligible) stay as `submitted` and are excluded from the journey Message node's "Approved Template" dropdown.

### Approach

Add a second eligibility field — **`user_initiated_approved` (boolean)** — on `whatsapp_templates`, populated from Twilio. Keep the existing `status` column unchanged so business-initiated logic and the Templates list view stay intact. Loosen the journey dropdown to include any template that is either business-initiated approved OR user-initiated approved.

### Changes

**1. Database migration**

- Add column `whatsapp_templates.user_initiated_approved boolean NOT NULL DEFAULT false`.
- Backfill: for every row with a `twilio_content_sid`, set `true` when `status` is one of `approved`, `submitted`, `pending` (i.e. not `rejected`/`draft`). Final source of truth is the next sync. Mark `highvalue_8lakh` (`HX807de5f45cf0e60b26d89cb5d3617142`) as `true` immediately so it surfaces right away.

**2. Edge function `whatsapp-templates`**

For all three sync paths (`import-from-twilio`, `bulk-sync`, `refresh-status`), interpret Twilio's `ApprovalRequests` response:

- A template is **business-initiated approved** when `whatsapp.status === 'approved'` → keep writing `status='approved'`.
- A template is **user-initiated approved** when the template has a valid `twilio_content_sid` and is not `rejected` (matches Twilio's UI behavior of granting user-initiated to any well-formed template). Set `user_initiated_approved=true`. If `whatsapp.status === 'rejected'`, set it to `false`.
- Loosen `bulk-sync` to also pull in templates currently marked `submitted` (already does) and update both fields.

**3. Journey Message node — `src/components/journey/NodePropertyPanel.tsx`**

- Replace the `.eq("status","approved")` filter with `.or("status.eq.approved,user_initiated_approved.eq.true")`.
- Select the new column.
- In the dropdown, append a small inline tag next to each template name: **"Business"** if `status='approved'`, **"User-initiated"** otherwise. This makes it clear which approval scope each template carries (helpful because user-initiated only works inside a 24-hour customer session).
- Show a one-line muted helper under the select: *"User-initiated templates can only be sent within 24h of a customer's last inbound message."*

**4. Templates list — `src/pages/communication/WhatsAppTemplates.tsx` (small visual update)**

- Add a "User-initiated" badge next to the existing status badge when `user_initiated_approved=true` and `status !== 'approved'`. No filter changes; non-disruptive.

**5. Untouched**

- `whatsapp-send` still requires `status='approved'` for business-initiated sends. (Sends inside an open session that should rely on user-initiated eligibility are out of scope of this change — journeys today fire as business-initiated; the dropdown change just makes the template choosable. If you want sends to honor user-initiated for in-session customers, that's a separate follow-up.)
- Templates page filters, status enum, and `whatsapp_message_log` are unchanged.

### Files

- **Migration**: add `user_initiated_approved` column + backfill.
- **Edit**: `supabase/functions/whatsapp-templates/index.ts` — set the new column in all three sync paths.
- **Edit**: `src/components/journey/NodePropertyPanel.tsx` — broaden filter, show scope tag and helper text.
- **Edit**: `src/pages/communication/WhatsAppTemplates.tsx` — add "User-initiated" badge.

After the migration runs, click **Bulk Sync** on the Templates page once to refresh `user_initiated_approved` for all existing rows; `highvalue_8lakh` will then be selectable in the Message node immediately (already backfilled).

