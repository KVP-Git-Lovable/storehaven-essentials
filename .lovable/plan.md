## Summary
The `sendgrid-webhook` edge function already exists from the previous build and already works without `SENDGRID_WEBHOOK_PUBLIC_KEY` configured. I'll refine it to match the Phase‑1 spec (better logging, precise response counts, safer batch handling), then deploy it and hand you the public URL to paste into SendGrid.

## Changes to `supabase/functions/sendgrid-webhook/index.ts`

1. **Response shape** — return `{ success, processed, duplicates, ignored }` per spec (currently returns `{ ok, processed }`).
2. **Per-event try/catch** — wrap each event's mapping so a single malformed record never aborts the batch; increment `failed` counter and continue.
3. **Idempotency counters** — detect duplicates from the upsert (`onConflict: sg_event_id, ignoreDuplicates`) by diffing returned rows vs. submitted rows; only bump campaign counters for newly-inserted events (prevents double counting on SendGrid retries).
4. **Ignored events** — count events whose `event` type isn't in the supported list and skip DB insert for them.
5. **Structured logging** — single `console.log` line at start (`webhook received, n events`) and end (`processed / duplicates / ignored / failed`). Continue to log the "signature verification disabled" warning when key is absent. Never log signature headers or raw payload bodies.
6. **Signature verification stays optional** — existing behavior kept: when `SENDGRID_WEBHOOK_PUBLIC_KEY` is set, verify ECDSA P‑256; otherwise, log a warning and continue.
7. **Always 200** — even when individual events fail, respond 200 so SendGrid does not retry the whole batch.

## No changes elsewhere
- No DB migrations (tables `email_marketing_events`, `email_marketing_campaigns`, `email_marketing_suppressions` already exist with the right unique constraints).
- No changes to Twilio Compose Email, WhatsApp, Journey Builder, or any UI.
- No new secrets requested — `SENDGRID_WEBHOOK_PUBLIC_KEY` is already listed in project secrets and will be picked up automatically once you paste the real key from SendGrid.

## Deploy & handoff
- Deploy `sendgrid-webhook` immediately after edit.
- Give you the webhook URL:
  `https://pdtasnfsdnfttayxibqy.supabase.co/functions/v1/sendgrid-webhook`
- Next step on your side: SendGrid → Settings → Mail Settings → Event Webhook → paste URL, enable the events listed in the spec, enable Signed Event Webhook, then copy the Verification Key back to me so we can store it in `SENDGRID_WEBHOOK_PUBLIC_KEY` and enforce signature validation.
