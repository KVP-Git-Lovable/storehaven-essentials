# Switch Email Sending to Twilio Email API

Replace the SendGrid Mail Send call inside `supabase/functions/email-send/index.ts` with a Twilio Email API (`POST https://comms.twilio.com/v1/Emails`) call authenticated via HTTP Basic Auth using the existing `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` secrets. No UI, schema, or workflow changes.

## Scope

Only `supabase/functions/email-send/index.ts` is modified. `EmailCenter.tsx`, journey/campaign flows, templates, scheduling UI, analytics, and DB schema stay as-is. The function keeps its current request contract (`to_email`, `subject`, `body`, optional `internal_caller`) so all existing callers continue to work.

## Changes to `email-send`

1. Remove SendGrid URL/key usage.
2. Read `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`; return 500 if either is missing.
3. Build the Twilio payload:
   - `from`: `{ address: "info@quickapp.ai", name: "QuickApp" }` (unchanged sender defaults; overridable by env `EMAIL_FROM_ADDRESS` / `EMAIL_FROM_NAME` if set, so sender stays configurable without a UI change).
   - `to`: `[{ address: to_email }]`.
   - `content`: `{ subject, text: emailBody, html: <emailBody wrapped in <p> if it looks like plain text, else passed through> }` — the existing EmailCenter sends plain text, so we send both `text` and a minimal HTML rendering to preserve current behavior.
   - `tags`: `{ channel: "email", environment: "production", source: internal_caller ? "internal" : "email-center" }`.
   - `headers`: `{ "X-CRM": "quickapp" }` (campaign/journey IDs will be added later when those callers pass them; current caller doesn't send them).
4. POST with `Authorization: Basic base64(SID:TOKEN)` and `Content-Type: application/json`.
5. Parse response: on success capture `operationId`; on failure log HTTP status + body and return 502 with a sanitized error (never echoing credentials).
6. Insert into `email_message_log` using the existing columns — store the Twilio `operationId` in the existing `sendgrid_message_id` column (kept as-is to avoid schema changes; it now holds the provider message/operation identifier regardless of provider). `from_email`, `subject`, `body`, `status`, `error_message`, `sent_by` continue to be populated the same way.
7. Return `{ success: true, message_id: operationId }` on success so the frontend contract is unchanged.

## Verification

- Redeploy `email-send`.
- From EmailCenter, send a test email to a real address; confirm 200 response, row inserted with `status='sent'` and Twilio operationId stored.
- Trigger an intentional failure (invalid recipient) and confirm 502 + `status='failed'` row with the Twilio error body captured.

## Out of scope

No changes to campaign/journey email node payloads yet — they already hit this function with the same shape. If/when those callers start passing campaign/journey IDs, we can extend the payload to populate `X-Campaign-ID` / `X-Journey-ID` headers and richer `tags` without another provider swap.
