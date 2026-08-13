# Audit: Twilio "Marketing Messages API" for the 63049 Retry button

## Short answer

Not feasible as a code change — and not needed. Twilio's Marketing Messages API is **not a separate API endpoint you call**. Per Twilio's official WhatsApp documentation, it is an account-level capability you switch on for your WhatsApp Business Account:

1. In WhatsApp Manager, open **Overview > Alerts**
2. Review and accept the **Marketing Messages API Terms of Service**
3. After acceptance it is enabled automatically — Twilio states explicitly: "no code changes are required in Twilio"

Once accepted, marketing template sends made through the same `/Messages.json` endpoint (which this app already uses) get routed by Meta through the marketing-optimised path — which is exactly what reduces 63049 ("Meta chose not to deliver this marketing message"). There is no alternate endpoint, request format, ContentSid handling, or webhook shape to migrate to, and nothing that could be scoped to a single button.

## 1. Current architecture (how a journey WhatsApp message is sent)

```text
Journey engine (process-journeys)  ->  whatsapp-send edge function
Retry selected (63049 tab)         ->  retry-journey-message  ->  whatsapp-send
whatsapp-send  ->  POST connector-gateway.lovable.dev/twilio/Messages.json
                   ContentSid + ContentVariables + StatusCallback
Twilio  ->  Meta  ->  Customer
Status callback  ->  whatsapp-inbound?event=status  ->  journey_message_log.delivery_status
```

Template management is separate and stays as-is: `whatsapp-templates` talks to `content.twilio.com/v1`; `whatsapp_templates.category` already stores MARKETING / UTILITY / AUTHENTICATION, and `twilio_content_sid` holds the approved Content SID.

## 2. Current 63049 handling

- Arrives as `code: 63049` in the Twilio error body (or via the status webhook) and is stored on `journey_message_log.error_code`, with the text in `error_message`.
- Never auto-retried. Retries are strictly manual, from the Status code failures page.
- `retry-journey-message` re-resolves variables from the journey node, honours `journey_excluded_contacts`, skips rows already delivered or in flight, and re-sends via `whatsapp-send`.
- The client paces retries at one call every 12 seconds via `retryRunner`.

This is already the correct, safe behaviour for 63049 — it is a Meta delivery decision, not a transient error, so immediate or looping retries would only burn quota.

## 3. Recommendation

**Step A (you, no code):** Accept the Marketing Messages API terms in WhatsApp Manager > Overview > Alerts. Nothing in this app changes; delivery of MARKETING-category templates improves at the Meta level, including the manual retries from the 63049 tab.

**Step B (optional, in-app):** If you want the app to reflect this, I can add — only on your confirmation:

- A read-only category badge on the 63049 tab (MARKETING / UTILITY) sourced from `whatsapp_templates.category`, so it is obvious which sends are affected.
- A short "why this failed and what to do" note on the 63049 tab pointing at the WhatsApp Manager opt-in.
- A warning before retrying a contact who has already hit 63049 more than a set number of times in this journey.

None of these touch the send path, templates, RLS, schema, or inbound handling.

## 4. Database changes

None required for either step.

## 5. Rollback

Nothing to roll back for Step A — it is a Meta-side setting, reversible in WhatsApp Manager. Step B is UI-only.

## Confirm before I build

Tell me whether you want Step B, or whether the Step A answer is all you needed. No send logic will change either way.