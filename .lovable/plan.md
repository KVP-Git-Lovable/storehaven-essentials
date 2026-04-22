
## Fix: WhatsApp journey shows Failed even though template is approved

### What is happening now

The failure is real, not just a stale UI status:

- The latest journey sends for both contacts failed with provider error:
  - `63019`
  - `Twilio Error: [[handleMediaContent]fetchMediaContent Failed: (1/1) media content failed]`
- The local template record is already `approved`, and the public URL check for  
  `https://storeops.quickapp.ai/marketing/trayi-jewellery-10-percent-discount.jpg` returns `200 image/jpeg`.
- So the current blocker is no longer approval status. It is the **media fetch inside the approved Twilio media template**.

### Root cause to fix

There are two gaps in the current implementation:

1. **The app only stores body/status for WhatsApp templates, not the full Twilio media definition.**  
   That means the system cannot inspect or validate the exact media payload Twilio is using for `HX807de5f45cf0e60b26d89cb5d3617142`:
   - actual `twilio/media` object
   - media URL bound in Twilio
   - any media/header variables required at send time

2. **Journey state advances too early.**  
   `process-journeys` moves the enrollment forward as soon as the provider initially accepts the request (`queued/accepted`).  
   Later, the status callback correctly flips the message log to `failed`, but the enrollment may already be `completed`, so the journey cannot recover or retry correctly.

### Implementation plan

#### 1) Sync the full Twilio content definition into the template record
Update the template sync/import logic so each WhatsApp template stores the full Twilio Content API payload, not only body text.

Files:
- `supabase/functions/whatsapp-templates/index.ts`
- database migration if a new JSON column is needed on `whatsapp_templates`

Work:
- fetch both:
  - `GET /v1/Content/{sid}`
  - `GET /v1/Content/{sid}/ApprovalRequests`
- persist:
  - raw `types` JSON
  - detected template type (`twilio/media`, `twilio/text`, etc.)
  - any extracted media URL / media variable metadata
- make refresh and bulk-sync update those fields too

Result:
- the app will know the exact media object Twilio is using
- the template details screen can show whether the media URL is static, variable-based, or missing

#### 2) Fix media-template send logic to validate the actual media requirements
Update the send worker so it resolves variables using the full Twilio template metadata, not only placeholders found in the body.

Files:
- `supabase/functions/whatsapp-send/index.ts`

Work:
- when `twilio_content_sid` is present and template type is `twilio/media`:
  - inspect stored Twilio metadata
  - detect all required variables from both body and media/header sections
  - fail early with a clear error if a media URL variable or required content variable is missing
  - include debug-safe metadata in the returned error/log so analytics explains *why* the media send failed
- keep `Body` omitted for content-template sends
- preserve `ContentSid` + `ContentVariables` behavior

Result:
- if the issue is “approved template but missing media variable,” it will be caught explicitly
- if the issue is “Twilio content is pointing at a different/stale URL,” the app will surface that exact URL

#### 3) Correct journey delivery state handling
Do not treat `queued/accepted` as final success for WhatsApp journey nodes.

Files:
- `supabase/functions/process-journeys/index.ts`
- `supabase/functions/whatsapp-inbound/index.ts`
- database migration only if a new message/enrollment status is required

Work:
- in `process-journeys`:
  - for WhatsApp template nodes, create the message log row and send
  - if provider accepts, mark the message as pending delivery instead of completing the node immediately
  - do not advance the enrollment to the next node yet
- in `whatsapp-inbound` status callback:
  - on successful downstream states (`sent`, `delivered`, `read`), advance the enrollment to the next node
  - on failed states (`failed`, `undelivered`), mark the enrollment failed and store provider error details
- ensure retries do not duplicate sends for the same enrollment/node

Result:
- analytics and journey state will stay consistent
- a later provider failure will no longer coexist with a completed journey

#### 4) Improve the template diagnostics UI
Extend the template details page so it shows the real synced Twilio media configuration, not just a manual URL test box.

Files:
- `src/pages/communication/WhatsAppTemplateDetails.tsx`

Work:
- show:
  - synced template type (`twilio/media` / `twilio/text`)
  - approval status
  - detected media URL from Twilio content metadata
  - whether that media is static or variable-driven
  - required variables for body and media separately
- keep the existing “Test media URL” utility
- prefill the tester with the actual synced Twilio media URL when available

Result:
- you can verify the exact asset Twilio is trying to fetch, not only a manually pasted URL

#### 5) Reconcile the current broken journey after the code fix
After the logic is corrected, reset only the affected journey records so the two contacts can be reprocessed cleanly.

Backend work:
- clear stale failed rows for journey `9a60c8b6-0bd2-4ec6-9531-5fdbbc0792f9`
- restore the affected enrollments to the message node
- re-run them with the corrected media-template handling

Expected outcome:
- if Twilio content metadata is valid, both contacts should receive the message
- if Twilio content still references a different or invalid media asset, the app will expose that exact misconfiguration instead of only showing generic `63019`

### Technical details

```text
Current evidence
- Template local status: approved
- Media URL reachability test: 200 OK, image/jpeg
- Latest journey_message_log:
  - 63019
  - [handleMediaContent]fetchMediaContent Failed
- Current bug:
  queued/accepted -> enrollment advances
  later callback -> message marked failed
  enrollment already completed
```

```text
Likely real issue now
Twilio is failing on the actual media object inside the approved content template,
not on the local approval flag and not on the manually tested public URL alone.
```

### Files likely involved

- `supabase/functions/whatsapp-templates/index.ts`
- `supabase/functions/whatsapp-send/index.ts`
- `supabase/functions/process-journeys/index.ts`
- `supabase/functions/whatsapp-inbound/index.ts`
- `src/pages/communication/WhatsAppTemplateDetails.tsx`
- `supabase/migrations/*` if template metadata storage or new statuses are needed

### Verification

After implementation:

1. Open template `highvalue_8lakh`
   - it should show the synced Twilio content type as `twilio/media`
   - it should show the actual media URL or media variable source from Twilio metadata

2. Run the built-in media check from that exact synced URL
   - should return `200 OK`

3. Re-trigger the affected journey
   - initial status should show pending/queued, not falsely completed
   - callback should move logs to `delivered` on success, or `failed` with a precise reason on failure

4. Journey analytics should remain consistent
   - no more `completed` enrollments for failed WhatsApp sends
