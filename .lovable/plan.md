## Goal
Add a "Send Video Only" section on the template details page (`/communication/templates/173fc431-...`) that sends just the video media to a chosen WhatsApp recipient — no template, no caption text required.

## WhatsApp constraint (important)
WhatsApp Business API only allows **freeform** (non-template) messages to a number that has messaged the business within the last 24 hours (the "service window"). The DB already has `is_in_service_window(phone, at)` for this exact check.

- If recipient is **inside** the 24h window → freeform video media message goes through directly.
- If **outside** the window → WhatsApp/Twilio will reject it. The UI must surface this clearly; the only workaround is to first re-engage via an approved template.

## UI changes — `src/pages/communication/WhatsAppTemplateDetails.tsx`
New card "Send Video Only" (visible only when the template's media is a video URL, which this template is):
- Recipient picker: same contact/phone input pattern already used for the existing template test-send on this page.
- Read-only preview of the video URL (pre-filled from the template's media URL).
- Optional caption textarea (max 1024 chars; WhatsApp video caption limit).
- "Check 24h Window" indicator that calls the DB helper and shows ✅ in-window / ⚠️ out-of-window before allowing send.
- "Send Video" button → calls new edge function (below). Disabled while out-of-window with a tooltip explaining why.
- Result toast with message SID + status; link to Message Log.

## Backend — new edge function `whatsapp-send-media`
`supabase/functions/whatsapp-send-media/index.ts` (CORS, JWT verify in code, Zod input validation):

Input: `{ to_number: string, media_url: string, caption?: string, from_number?: string }`

Flow:
1. Validate input; normalize `to_number` via `_shared/phone-india.ts`.
2. Resolve `from_number` from `whatsapp_config` if not provided.
3. Call `is_in_service_window(to_number, now())` — if false, return 409 with a clear error code so the UI can show the out-of-window message.
4. Sanitize `media_url` (reuse the same single-slash sanitizer used in `whatsapp-templates`) to avoid the 21620 error class.
5. POST to Twilio gateway `/Messages.json` with form-encoded `To`, `From` (both `whatsapp:` prefixed), `MediaUrl`, and `Body` (caption) — no `ContentSid`, so it's a freeform media message.
6. Log to `whatsapp_message_log` and `whatsapp_messages` with `direction='outbound'`, `message_type='freeform_media'`, template_id = null.
7. Return `{ sid, status }`.

Register in `supabase/config.toml` with `verify_jwt = false` (in-code JWT validation, matching sibling functions).

## Out of scope
- No template changes, no DB migrations, no changes to existing template send paths.
- No bulk send — single recipient only for this section.

## Files touched
- `src/pages/communication/WhatsAppTemplateDetails.tsx` — add the new card + handler.
- `supabase/functions/whatsapp-send-media/index.ts` — new.
- `supabase/config.toml` — register new function.
