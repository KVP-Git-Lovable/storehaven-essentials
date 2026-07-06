
# Email Marketing Module (SendGrid) — Plan

Additive feature. **Compose Email stays exactly as-is** (Twilio, existing edge function, existing UI). Everything below is new.

---

## 1. Page structure

`src/pages/communication/EmailCenter.tsx` becomes a tabbed shell with two tabs:

- **Compose Email** — the current page, extracted verbatim into `ComposeEmailTab.tsx`. Zero behavioral change.
- **Email Marketing** — new module (below).

Tab state is URL-synced (`?tab=marketing`) so deep links + refresh work.

---

## 2. Secrets & sender

- Ask for and store `SENDGRID_API_KEY` via `add_secret` (backend-only, never in the client).
- Reuse the already-verified SendGrid sender/domain. On page load, the marketing tab calls a new edge function that hits `GET /v3/verified_senders` + `GET /v3/whitelabel/domains` and returns the list of usable From identities.
- If none are verified: show an inline warning card ("No verified sender found in SendGrid") and disable campaign send/schedule actions. No new verification workflow is built.

---

## 3. New database tables (Email Marketing only — isolated from Journey Builder)

Migration adds the following in `public`, each with GRANTs to `authenticated` + `service_role`, RLS enabled, and `has_role(auth.uid(),'admin')`-style policies plus permission-based read/write:

- `email_marketing_campaigns` — id, name, subject, preview_text, from_name, from_email, reply_to, html, audience_config (jsonb, same shape as `AudienceConfig`), status (`draft|scheduled|sending|sent|paused|failed`), scheduled_at, timezone, sendgrid_single_send_id, sendgrid_list_id, created_by, created_at, updated_at, sent_count, delivered_count, open_count, click_count, bounce_count, spam_count, unsubscribe_count.
- `email_marketing_recipients` — id, campaign_id, email, contact_ref (jsonb: entity_type + entity_id), merge_vars (jsonb), status, created_at. Unique on (campaign_id, email).
- `email_marketing_events` — id, campaign_id, recipient_email, event_type (`processed|delivered|open|click|bounce|dropped|deferred|spamreport|unsubscribe|group_unsubscribe`), url, reason, sg_event_id (unique), sg_message_id, timestamp, raw jsonb.
- `email_marketing_templates` — id, name, category (`welcome|promotions|offers|newsletters|followup|custom`), subject, preview_text, html, thumbnail_url, created_by, created_at, updated_at.
- `email_marketing_suppressions` — id, email (unique), reason (`unsubscribe|bounce|spamreport|manual`), campaign_id (nullable), created_at.
- `email_marketing_test_sends` — id, campaign_id, recipients text[], sent_by, sent_at (kept out of analytics counts).

Indexes on campaign_id, status, scheduled_at, and email lookups.

---

## 4. Permissions

Three new module keys added to `src/lib/modules.ts` (kept separate from existing `communication.email`):

- `communication.marketing` (view)
- `communication.marketing.campaigns` (view/create/edit/delete)
- `communication.marketing.send` (create — required to launch/schedule a send)

Existing Compose Email permissions are untouched. `PermissionGate` wraps the marketing tab, list actions, and the launch button.

---

## 5. UI — Email Marketing

All under `src/pages/communication/marketing/` and `src/components/marketing/`.

### Dashboard (`MarketingDashboard.tsx`)
CRM-style: KPI strip (total sent, avg open rate, avg CTR, bounce rate over 30d) + four grouped sections (Draft / Scheduled / Running / Completed). Each row shows: name, subject, audience label + count, created by, scheduled time, status badge, sent, delivered, opened, clicked, bounce %, unsubscribe %.
Row actions: New Campaign, Duplicate, Edit (drafts/scheduled), Delete, Pause (scheduled→paused), Resume, View Analytics.

### Campaign Wizard (`CampaignWizard.tsx` — 5 steps, stepper UI matching existing wizards)
1. **Details** — name, subject, preview text, from name, from email (dropdown of verified senders), reply-to.
2. **Audience** — reuses `AudienceBuilder.tsx` as-is (customers/leads/orders list views, union/intersection/difference). Live preview count via existing `journey-actions` `audience-preview` action.
3. **Designer** — TipTap-based rich HTML editor (`EmailHtmlEditor.tsx`) with toolbar for headings, bold/italic/link, images, buttons, dividers, columns (2-col table), merge variables inserter ({{first_name}}, {{last_name}}, {{email}}, {{company}}, {{city}}, plus any custom from `variables/registry.ts`). Output is serialized to **email-safe HTML with inlined CSS** using `juice` (added via `bun add juice`), wrapped in a table-based shell + mandatory footer (company name, physical address from `company_information`, unsubscribe link `{{unsubscribe_url}}`).
4. **Review** — summary card (sender, subject, audience count, estimated emails after suppression, schedule). Buttons: **Preview** (renders inlined HTML in an iframe) and **Send Test** (writes to `email_marketing_test_sends`, ships via SendGrid single-recipient v3 mail send, excluded from analytics).
5. **Schedule** — Send Now / Schedule (date + time + IANA timezone select, default from browser). Large-audience confirm dialog when estimated recipients > 1,000: shows name, size, estimated emails, requires typed confirmation.

### Templates (`MarketingTemplates.tsx`)
List + wizard (name, category, subject, preview, HTML via same editor). Actions: Save, Edit, Duplicate, Delete. "Use Template" prefills the campaign wizard step 3.

### Analytics (`CampaignAnalytics.tsx`)
Per-campaign drill-in: KPI cards (Sent, Delivered, Opens, Open Rate, Clicks, CTR, Bounce, Spam, Unsub) + three time-series charts (Delivery Trend, Opens Over Time, Clicks Over Time) built from `email_marketing_events` bucketed by hour/day. Top clicked URLs table.

---

## 6. Backend — edge functions (new, all under `supabase/functions/`)

All use CORS, Zod validation, service-role client, and the SendGrid REST API (`https://api.sendgrid.com/v3`) with `Authorization: Bearer ${SENDGRID_API_KEY}`. **No SendGrid SDK.** Twilio credentials are not touched.

- `sendgrid-senders` — `GET /v3/verified_senders` + authenticated domains → returns usable From identities.
- `marketing-campaign-launch` — Given `campaign_id`:
  1. Resolve `AudienceConfig` server-side (reuse `list-view-resolve` logic) → dedupe emails → filter against `email_marketing_suppressions` and SendGrid global unsubscribes.
  2. Upsert recipients into `email_marketing_recipients` and into a SendGrid list via `PUT /v3/marketing/contacts` (async import). Poll `GET /v3/marketing/contacts/imports/{job_id}` up to a bounded window; if still pending, mark campaign `sending` and let a follow-up run continue (idempotent by `campaign_id`).
  3. Create a **Single Send** via `POST /v3/marketing/singlesends` with our inlined HTML, subject, sender_id, send_to.list_ids. Store `sendgrid_single_send_id`.
  4. If Send Now → `PUT /v3/marketing/singlesends/{id}/schedule` with `send_at: now`. If Scheduled → schedule with the chosen ISO time.
- `marketing-campaign-control` — pause/resume/delete via `/singlesends/{id}/schedule` DELETE and re-schedule; syncs local status.
- `marketing-campaign-test` — sends a test to manually entered addresses using `POST /v3/mail/send` (transactional endpoint), with subject prefixed `[TEST]`. Writes to `email_marketing_test_sends`. Does **not** touch `email_marketing_events`.
- `sendgrid-webhook` — public endpoint (no JWT). Verifies SendGrid ECDSA signature (`X-Twilio-Email-Event-Webhook-Signature` + `-Timestamp`) using the stored `SENDGRID_WEBHOOK_PUBLIC_KEY` secret (asked for at setup). Ingests events into `email_marketing_events` (idempotent on `sg_event_id`), and increments denormalized counters on `email_marketing_campaigns` for fast dashboard reads. Unsub/bounce/spam events also insert into `email_marketing_suppressions`.
- `marketing-unsubscribe` — public GET/POST. GET validates a signed token (HMAC of email+campaign_id using a new `MARKETING_UNSUB_SECRET` generated via `generate_secret`), returns state. POST records the unsubscribe in `email_marketing_suppressions` and calls SendGrid `POST /v3/asm/suppressions/global` to mirror it globally.
- `marketing-suppressions-sync` — optional admin trigger to pull SendGrid bounces/blocks/spam reports into local suppressions.

Each function ends with the standard classic-deploy pattern (auto-deployed).

---

## 7. Unsubscribe page (in-app)

New public route `/unsubscribe` (`src/pages/UnsubscribePage.tsx`, unauthenticated). Reads `?token=`, calls `marketing-unsubscribe` GET to show `confirm | already-unsubscribed | invalid`, POSTs on confirm, shows success with brand footer. The `{{unsubscribe_url}}` merge variable in every marketing email is replaced server-side at send time with `https://<app>/unsubscribe?token=...`.

---

## 8. Compliance footer (mandatory, injected server-side)

At launch, before creating the Single Send, `marketing-campaign-launch` appends a footer block to the editor HTML containing: company name + physical address (from `company_information`), and the unsubscribe link. Editor HTML cannot omit it. Preview shows the same combined HTML.

---

## 9. Future Journey compatibility (design-only, no code)

- `email_marketing_events` schema mirrors the event types Journey will later need (delivered/opened/clicked/bounced/unsubscribed).
- `AudienceConfig` reuse means Journey nodes can point at the same list_views.
- No changes to Journey Builder tables or edge functions in this feature.

---

## Technical details

- **Files to add (approx.)**
  - `src/pages/communication/EmailCenter.tsx` (converted to tab shell), `communication/ComposeEmailTab.tsx` (extracted existing UI, unchanged behavior).
  - `src/pages/communication/marketing/{MarketingDashboard,CampaignWizard,CampaignAnalytics,MarketingTemplates}.tsx`
  - `src/pages/UnsubscribePage.tsx`
  - `src/components/marketing/{CampaignTable,CampaignStatusBadge,LaunchConfirmDialog,EmailHtmlEditor,MergeVarInserter,EmailPreviewIframe,SenderPicker,TemplateCard,VerifiedSenderGuard}.tsx`
  - `src/lib/email/{inlineHtml.ts,mergeVars.ts,unsubscribeToken.ts}`
  - `supabase/functions/{sendgrid-senders,marketing-campaign-launch,marketing-campaign-control,marketing-campaign-test,sendgrid-webhook,marketing-unsubscribe,marketing-suppressions-sync}/index.ts`
  - One migration for the six new tables + GRANTs + RLS.
- **Deps**: `bun add juice @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image @tiptap/extension-table` (all client-side; edge functions use fetch only).
- **Secrets requested**: `SENDGRID_API_KEY` (add_secret, user-provided), `SENDGRID_WEBHOOK_PUBLIC_KEY` (add_secret, from SendGrid Mail Settings → Event Webhook), `MARKETING_UNSUB_SECRET` (generate_secret, 64 chars).
- **Router**: register `/unsubscribe` as public (outside `ProtectedRoute`); marketing tab guarded by new permission keys.
- **Untouched**: `email-send` edge function, Compose Email UI, Twilio secrets, WhatsApp, Journey Builder, `AudienceBuilder.tsx` internals, `list_views`.

---

## Rollout order after approval
1. Ask for `SENDGRID_API_KEY` (+ webhook verification key).
2. Migration for new tables.
3. Edge functions + secrets.
4. Tab shell + extracted Compose tab.
5. Marketing dashboard, wizard, templates, analytics, unsubscribe page.
6. Wire webhook URL — surface it in the UI for the user to paste into SendGrid Mail Settings → Event Webhook.
