## Add Product Inquiry intent to WhatsApp inbound webhook

Extend `supabase/functions/whatsapp-inbound/index.ts` to detect product-related questions and reply with a fixed Twilio Content (template) message — without disturbing greeting handling, status callbacks, or the future-intent fallback.

### 1. Intent detection (added BETWEEN greeting check and fallback)

Keyword regex, case-insensitive, word-boundary based to avoid false positives inside other words:

```
const PRODUCT_INTENT_RE = /\b(products?|diamonds?|jewell?ery|collections?|items?)\b/i;
const PRODUCT_TEMPLATE_SID = "HX440122d86a157cb01de5f75a3aba1dd3";
```

Order of checks inside the `Deno.serve` POST handler stays:

```text
1. Greeting (existing)        → reply WELCOME via TwiML, log inbound + outbound, return
2. Product Inquiry (new)      → send template via Twilio REST, log inbound + outbound, return empty TwiML
3. Fallback (existing)        → log inbound, return empty TwiML
```

### 2. Sending the template

A template message cannot be returned via TwiML, so we send it through the Twilio REST API (same connector gateway pattern already used by `whatsapp-send`). The webhook still returns an empty TwiML response so Twilio doesn't retry.

Inside a new helper `sendProductTemplate(toNumber, fromNumber)`:

- Read `LOVABLE_API_KEY` and `TWILIO_API_KEY` from env (skip + log if missing — never throw, webhook must always reply with valid TwiML).
- Resolve `fromNumber`: prefer the inbound `To` field (already normalized), fallback to `whatsapp_config.sender_number`.
- POST to `https://connector-gateway.lovable.dev/twilio/Messages.json` with:
  - `To = whatsapp:<userPhone>`
  - `From = whatsapp:<senderNumber>`
  - `ContentSid = HX440122d86a157cb01de5f75a3aba1dd3`
  - `StatusCallback = ${SUPABASE_URL}/functions/v1/whatsapp-inbound?event=status` (so existing status branch still updates message logs)
- On success, insert an outbound row into `whatsapp_messages` (`message_type: "template"`, `status: data.status || "queued"`, `twilio_message_sid: data.sid`, `is_read: true`, `message: "[Product Inquiry template]"`) so the conversation thread stays intact.
- On failure, `console.error` the Twilio payload — still return empty TwiML (no user-facing break).

### 3. Inbound logging

Reuse existing `logMessages(false)` to persist the user's incoming text and customer lookup. The product-template outbound is logged separately by the helper above (mirroring how greeting logs its outbound row).

### 4. Constraints honoured

- Greeting branch and `event=status` branch are byte-for-byte unchanged.
- Free-form responses are NOT used for the product intent — only the predefined template.
- Fallback path remains a quiet empty TwiML for any unmatched message.
- Errors in template send never break TwiML — the webhook always returns `<Response/>`.

### 5. Files to edit

- **Edit** `supabase/functions/whatsapp-inbound/index.ts` — add `PRODUCT_INTENT_RE`, `PRODUCT_TEMPLATE_SID`, `sendProductTemplate()` helper, and slot the new branch between the greeting check and the fallback.

No DB migrations, no new tables, no UI changes, no new dependencies.