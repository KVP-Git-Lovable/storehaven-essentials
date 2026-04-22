

## WhatsApp Inbound Webhook with Greeting Auto-Reply

Create a new public Twilio webhook edge function that receives inbound WhatsApp messages, auto-replies to greetings ("hi", "hello", "hey", "start") with the Trayi Jewellery welcome line, and leaves room for future intent handling (orders, products, etc.).

### 1. New edge function — `supabase/functions/whatsapp-inbound/index.ts`

- **Public** (no JWT) — Twilio calls it directly. Add a config block in `supabase/config.toml`:
  ```toml
  [functions.whatsapp-inbound]
  verify_jwt = false
  ```
- Accepts Twilio's `application/x-www-form-urlencoded` POST. Parses `Body`, `From`, `To`, `MessageSid`, `ProfileName`.
- Returns **TwiML XML** (`Content-Type: text/xml`) — Twilio's standard reply mechanism, no outbound API call needed.

### 2. Greeting detection (runs FIRST, before any other intent logic)

```ts
const GREETING_RE = /^\s*(hi|hello|hey|start)[\s!.?,]*$/i;
const WELCOME = "Welcome to Trayi Jewellery. ✨ I am your StoreOps assistant. How may I assist you today?";

if (GREETING_RE.test(body)) {
  return twiml(WELCOME);
}
```

- **Case-insensitive** via `i` flag.
- Matches the word optionally followed by punctuation/whitespace, so `"Hi!"`, `"HELLO"`, `"  hey  "`, `"start."` all trigger.
- Whole-message match avoids false positives on phrases like "this is a high-priority order".

### 3. Fallback for non-greetings

If no greeting match, return an **empty TwiML response** (`<Response/>`) — Twilio sends nothing back, leaving the conversation open for existing/future intent handlers (orders, products, etc.) to be added later as additional `if` blocks before the empty fallback. Existing flows (`whatsapp-send`, `whatsapp-templates`, `whatsapp-senders`) are untouched.

### 4. TwiML helper

```ts
function twiml(message: string) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return new Response(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
}
```

Plus a small `escapeXml` for `& < > " '`.

### 5. Twilio configuration (one-time, manual by user)

After deploy, the webhook URL will be:
`https://fukkurwmuxcyoyqwchdb.supabase.co/functions/v1/whatsapp-inbound`

The user pastes that into the Twilio Console → WhatsApp Sender → "When a message comes in" (HTTP POST). I'll include the URL in the post-deploy chat message.

### 6. Constraints honored

- No DB lookups, no schema changes, no RLS edits.
- No changes to existing WhatsApp functions or any other module.
- Greeting check executes before any other intent logic.
- Empty fallback preserves room for orders/products/etc. flows without interfering.

### Files

- **New:** `supabase/functions/whatsapp-inbound/index.ts`
- **Edit:** `supabase/config.toml` — add `[functions.whatsapp-inbound]` with `verify_jwt = false`.

No other files modified.

