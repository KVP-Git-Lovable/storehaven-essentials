# Meta Marketing Module (under Communication)

A new **Meta** section that lets users connect their Meta Business account via Facebook Login and manage Facebook/Instagram marketing. No existing `/communication` logic is touched — this is purely additive.

## Phase 1 (this build)

### 1. Navigation & permissions
- New sidebar item **Meta** under Communication, with sub-items: Connection, Campaigns, Organic Posts.
- Register module keys `communication.meta`, `communication.meta.connection`, `communication.meta.campaigns`, `communication.meta.organic` in `src/lib/modules.ts` + `routeToModuleKey`, so they appear in Permission Set.
- Routes: `/communication/meta`, `/communication/meta/campaigns`, `/communication/meta/campaigns/:id`, `/communication/meta/organic`.

### 2. Database (Lovable Cloud)
Platform-agnostic naming so Google/LinkedIn/X can be added later without redesign — every table carries a `platform` column (default `meta`).

- `social_connections` — platform, connected user id/name, business name, encrypted long-lived token, token expiry, default page/ig/ad-account ids, status.
- `social_pages` — FB pages (page id, name, encrypted page token, linked IG business account id/username).
- `social_ad_accounts` — ad account id, name, currency, timezone, status.
- `social_campaigns` — name, objective, buying type, budget type/amount, status, special ad category, start/end, `external_id` (Meta campaign id), `published_at`.
- `social_ad_sets` — all fields from Page 3 (schedule, placements JSONB, targeting JSONB, optimization goal, billing event, bid strategy), `external_id`.
- `social_ads` — creative type, media refs, headline/primary text/description, destination URL, display link, CTA, UTM, status, `external_id`, `creative_external_id`.
- `social_posts` — organic posts: type, content, media, destination (facebook/instagram/both), schedule, status, returned post ids.
- `social_insights` — daily metrics per campaign/ad set/ad (reach, impressions, clicks, spend, leads, purchases, conversions).
- Storage bucket `social-media` (private) for uploaded ad/post images and videos.
- RLS + GRANTs on every table (authenticated users of the app; service_role for edge functions). Tokens are only ever read by edge functions.

### 3. Backend (edge functions)
- `meta-oauth-start` — builds the Facebook Login URL with required scopes (`pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, `ads_management`, `ads_read`, `business_management`).
- `meta-oauth-callback` — exchanges code → short token → **long-lived token**, fetches `/me`, `/me/accounts` (pages + page tokens + linked IG accounts), `/me/adaccounts`, `/me/businesses`; encrypts tokens (AES-GCM with an app-held key) and stores them. Returns only non-sensitive summary to the UI.
- `meta-token-refresh` — scheduled job that re-extends long-lived tokens before expiry and marks connections needing re-auth.
- `meta-api` — single authenticated gateway used by all later actions (create campaign / ad set / creative / ad, upload media, publish organic post, pause/resume/delete, fetch insights, sync status). Phase 1 implements: publish organic post, publish campaign, pause/resume/delete campaign, sync status.

Secrets needed from you: `META_APP_ID`, `META_APP_SECRET`, plus a generated `META_TOKEN_ENC_KEY`. Redirect URI to register in your Meta app will be the `meta-oauth-callback` function URL — I'll give you the exact string during the build.

### 4. Page 1 — Connection (`/communication/meta`)
Card **Meta Business Connection** with a large **Connect with Facebook** button (OAuth popup). After connect: green ✓ Connected Successfully panel showing Facebook user, business name, and lists of Pages / Instagram accounts / Ad accounts, plus three dropdowns for defaults and a **Save Configuration** button. Disconnect + re-sync actions. No manual token/ID entry anywhere.

### 5. Page 2 — Campaigns (`/communication/meta/campaigns`)
Card/table dashboard of campaigns with **+ Create Campaign**. Create/edit dialog with all specified fields (name, objective, buying type, budget type + amount, status, special ad category, start/end dates). Saved as local drafts; a **Publish** action pushes to Meta and stores the returned Campaign ID. Row actions: View, Edit, Duplicate, Pause, Delete.

### 6. Page 7 — Organic Posts (`/communication/meta/organic`)
Text / Image / Video post composer, destination Facebook / Instagram / Both, optional schedule, live preview, and Publish (via `meta-api`), with post history and returned post IDs.

## Later phases (after Phase 1 is verified)
- **Phase 2** — Ad Sets page (full targeting, placements, schedule, bidding) and Ads page (creatives, media upload, CTA, UTM).
- **Phase 3** — Preview tabs (FB Feed / Story, IG Feed / Story / Reel) and the Publish flow with progress and returned Campaign/AdSet/Ad/Creative IDs + publishing time.
- **Phase 4** — Reporting dashboard: KPI cards (Reach, Impressions, Clicks, CTR, CPC, CPM, Leads, Purchases, Conversions, Spend, ROAS) and campaign performance table, backed by a scheduled insights sync.

## Technical notes
- All Graph API calls happen server-side; tokens are encrypted at rest and never returned to the browser.
- Tables and edge-function routing are keyed by `platform`, so adding Google Ads / LinkedIn / X / YouTube / TikTok / Pinterest later means a new provider adapter plus a sidebar entry — no schema or UI redesign.
- UI uses existing shadcn cards, theme tokens, toasts and skeleton loaders; nothing in existing Communication pages is modified.
