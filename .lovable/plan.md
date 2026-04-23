

## Add Message Type selection (Template vs Free-form, multi-channel)

Restructure the Journey Builder Message node so the user first picks a Message Type, then sees a UI tailored to that mode. Template mode keeps today's WhatsApp template flow untouched. Free-form mode is new and supports WhatsApp, SMS, and Email — all three using the same body text per node.

### 1. Property panel UI (`NodePropertyPanel.tsx`)

Replace the current single Channel dropdown for Message nodes with this layout:

- **Message Type** (new top-level dropdown, first field)
  - `Template` (default for backward compat — every existing node has `channel: "whatsapp_template"`)
  - `Free-form`
- **If Template** → render the EXISTING block exactly as today:
  - Label remains **"WhatsApp Template"**
  - Approved Template dropdown, body preview, variable bindings
  - No channel checkboxes (template = WhatsApp only)
- **If Free-form** → render a new block:
  - **Channels** (checkbox group, one or more required): ☑ WhatsApp · ☑ SMS · ☑ Email
  - **Message** (textarea, supports emojis natively, ~6 rows). Helper line: "Same message will be used across all selected channels."
  - When WhatsApp is checked, show an inline note in light-orange (`bg-orange-50 border-orange-200 text-orange-800`):
    > ⚠ WhatsApp free-form messages may fail outside the 24h window, as per existing policy from Meta.

### 2. Node data model (backward compatible)

Stored on the message node's `data`:

```
{
  message_type: "template" | "freeform",   // NEW (default "template")
  // Template mode (unchanged):
  channel: "whatsapp_template",
  whatsapp_template_id, whatsapp_template_name,
  template_body, template_variables,
  // Free-form mode (NEW):
  freeform_channels: ("whatsapp" | "sms" | "email")[],
  freeform_body: string,
  freeform_subject?: string  // only used for email; auto-generated from journey name if blank
}
```

Migration rule in the panel: if `message_type` is missing, treat as `"template"` so existing journeys keep working. Switching modes preserves the other mode's stored fields so users can flip back without losing config.

### 3. Canvas card (`MessageNode.tsx`)

When `message_type === "freeform"`, replace the single channel chip with:
- Title: "Free-form message"
- A row of small chips for each selected channel using existing icons (WhatsApp logo for WhatsApp, `Mail` for Email, `MessageSquare` for SMS)
- Body preview (line-clamp-2)
- Drop the WhatsApp template approval warning (doesn't apply to free-form)

Template mode card is unchanged.

### 4. Execution (`process-journeys/index.ts`)

In the message-node branch:

- **Template mode** (`message_type === "template"` or legacy `channel === "whatsapp_template"`): keep current path — single `whatsapp-send` call, single `journey_message_log` row. No change.
- **Free-form mode**: for each selected channel, create one `journey_message_log` row (so Analytics shows per-channel delivery), send via the right transport, then collapse the multi-channel result into one enrollment advancement.

Per-channel transport:
- **WhatsApp free-form** → call a new `whatsapp-send-freeform` edge function (sister to `whatsapp-send`) that posts `Body=...` directly to Twilio without a `ContentSid`. No 24h pre-check; Twilio's response carries the failure reason (e.g. error 63016 = outside 24h window) which is captured in `error_message` + `error_code`.
- **SMS** → new `sms-send` edge function. Uses the existing Twilio connector via the gateway (`POST /Messages.json`, `From` = SMS sender from `whatsapp_config` or new env `TWILIO_SMS_FROM`).
- **Email** → new `journey-email-send` edge function using the **Lovable Email** infrastructure (set up via the email scaffolder). Will trigger the email-domain setup dialog if no domain exists yet.

After all per-channel sends finish, advance the enrollment exactly once: if at least one channel was accepted by its provider, mark `pending_delivery` (24h hold for status webhooks); if all failed, mark enrollment `failed`. This preserves today's idempotency model.

### 5. Logging schema usage

`journey_message_log` already has the fields we need: `channel`, `status`, `error_message`, `error_code`, `provider_metadata`. We will:
- Set `channel` to `"whatsapp"`, `"sms"`, or `"email"` (template mode keeps `"whatsapp_template"`).
- Insert one row per channel per enrollment for free-form sends.
- Stop using the old `(enrollment_id, node_id)` claim shortcut for free-form; instead use `(enrollment_id, node_id, channel)` so each channel is independently logged. A small migration adds a partial unique index on those three columns to keep the existing idempotency guarantees.

### 6. Analytics page (`JourneyAnalytics.tsx`)

- Add a **Channel-wise delivery summary** card row above the recent-messages table: WhatsApp / SMS / Email tiles each showing Sent · Delivered · Failed counts, computed from `journey_message_log` grouped by `channel`.
- In the recent-messages table, add a **Reason** column that surfaces `error_message` (truncated, with full text in a tooltip) so 24h-window failures and other provider errors are visible per user.
- Existing Open/Click/Completed tiles stay as-is.

### 7. Files to change / add

- Edit `src/components/journey/NodePropertyPanel.tsx` — Message Type dropdown, conditional UI, free-form fields, orange WhatsApp note.
- Edit `src/components/journey/MessageNode.tsx` — render free-form chips when in free-form mode.
- Edit `src/pages/communication/JourneyAnalytics.tsx` — channel summary + reason column.
- Edit `supabase/functions/process-journeys/index.ts` — per-channel fan-out for free-form.
- New `supabase/functions/whatsapp-send-freeform/index.ts` — Twilio free-form WhatsApp send.
- New `supabase/functions/sms-send/index.ts` — Twilio SMS send.
- New `supabase/functions/journey-email-send/index.ts` — Lovable email dispatcher (needs scaffold).
- DB migration: partial unique index on `journey_message_log(enrollment_id, node_id, channel)` for free-form idempotency.

### Constraints honored

- Template flow is byte-for-byte unchanged when `message_type === "template"` (and for any legacy node without `message_type`).
- New fields are additive; old `canvas_data` JSON keeps working.
- UI is conditional — channel checkboxes and the orange note only appear in free-form mode.

### Decisions needed before implementation

1. **Email provider for free-form Email**: use Lovable's built-in email (default, requires running the email-domain setup dialog if not done) — confirmed unless you tell me otherwise.
2. **SMS sender number**: do you already have a Twilio SMS-capable number we should hard-code in `whatsapp_config`, or should we add a new `sms_sender_number` column to `whatsapp_config` (renaming the table later if needed)?
3. **Email subject**: leave a free "Subject" field in the property panel for free-form Email mode, or auto-derive from the journey name?

