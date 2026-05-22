
## Journey Cost Analytics — Additive enhancement

Adds a new "Journey Cost Analytics" section to `/communication/journeys/:id/analytics`. No changes to scheduling, sending, Twilio, templates, wallet, or existing analytics.

### 1. Pricing & FX configuration (DB)

New tables (admin-editable, future-ready):

- `whatsapp_pricing_config`
  - `id`, `region` (default `IN`), `currency` (default `INR`)
  - `category` enum: `MARKETING | UTILITY | AUTHENTICATION | FAILED_FEE`
  - `service_window` enum: `inside | outside | n_a`
  - `meta_fee_usd numeric`, `twilio_fee_usd numeric`, `total_usd numeric` (generated)
  - `effective_from timestamptz`, `is_active boolean`
  - Seeded with the defaults from the spec (Marketing 0.0094+0.005, Utility/Auth inside 0+0.005, outside 0.0034+0.005, Failed 0.001).

- `fx_rates`
  - `id`, `from_currency` (`USD`), `to_currency` (`INR`)
  - `rate numeric`, `source text` (`manual | rbi | api`), `fetched_at`
  - Seeded with `95` fallback. A small edge function `fx-refresh` (new, isolated) optionally refreshes daily from a public FX API; falls back to last stored value, then to 95.

- `journey_cost_settings` (per-journey overrides, optional)
  - `journey_id`, `estimated_in_window_pct int default 0` (admin assumption for projected utility/auth in-window split)
  - `entry_point_type text default 'normal'` (`normal | click_to_whatsapp | customer_initiated`) — stored for future use, not yet wired into pricing.

RLS: authenticated read; admin write.

### 2. Service window detection (read-only, no send-path changes)

Add a SQL function `public.is_in_service_window(_contact_id uuid, _at timestamptz)`:
- Returns true if there is an inbound WhatsApp message from that contact in `whatsapp_inbound_messages` (or equivalent existing inbound table — verified at implementation) within 24h before `_at`.
- Used only by analytics queries; never invoked by the sender.

If no inbound-messages table exists, fall back to: any `journey_message_log` row where `provider_metadata->>'direction' = 'inbound'`. Decision finalized while reading code, not in this plan.

### 3. Cost computation (client-side, lazy)

A new hook `useJourneyCostAnalytics(journeyId)`:
- Loads pricing config + active FX rate (TanStack Query, `staleTime: 1h`).
- Loads enrollments, message log (already fetched on the page — reused via shared query keys), template categories, and per-message service-window flag (single RPC).
- Computes:
  - **Projected**: per node — recipients × category rate. Utility/Auth split by `estimated_in_window_pct`. Marketing always at outside rate.
  - **Actual**: per delivered message → category × in/outside. Failed → failed fee. Undelivered → 0.
- Returns totals, per-category, per-step, and time-series buckets (day/week/month) for recurring journeys.

All formatting via existing `en-IN` locale conventions; show INR primary, USD secondary.

### 4. UI — `JourneyCostAnalytics.tsx`

New component rendered inside `src/pages/communication/JourneyAnalytics.tsx`, lazy-loaded via `React.lazy` with a `Suspense` skeleton so the existing page renders immediately.

Sections:

1. **Summary cards** — Projected Spend, Actual Spend, Delivered, Failed, Cost/Delivered, Cost/Recipient. Each amount shows `₹X,XXX` with `($Y.YY)` below.
2. **Category breakdown** — Marketing (orange), Utility (blue), Authentication (green) badges + amounts + count.
3. **Step costing table** — Step name, category, delivered, in-window/out, cost.
4. **Wallet impact** — Reuses existing `WalletBalanceCard` query (`twilio-balance`) + FX rate; shows `Wallet`, `Projected Remaining`, `Actual Remaining`. Informational only.
5. **Cost trends** — Recharts line/bar with daily/weekly/monthly toggle. Only shown when journey has >1 day of history.
6. **Disclaimer footer** — "Projected spend is estimated…" copy from spec.

### 5. Admin config UI (small)

Inside the same analytics page header for the cost section, a "Settings" popover (admin-gated via `is_admin`):
- Edit `estimated_in_window_pct` for this journey.
- Link/button "Edit global pricing" → routes to a new admin sub-page `/admin/whatsapp-pricing` showing the `whatsapp_pricing_config` table with inline edit + FX rate override. Admin-only via RLS + `PermissionGate`.

### 6. Files to add

- `supabase/migrations/<ts>_journey_cost_analytics.sql` — tables, seed, RLS, `is_in_service_window` fn.
- `supabase/functions/fx-refresh/index.ts` — optional cron-driven FX refresh.
- `src/lib/journeyCost.ts` — pure cost math + types.
- `src/hooks/useJourneyCostAnalytics.ts` — data + computation.
- `src/components/journey/JourneyCostAnalytics.tsx` — UI.
- `src/components/journey/JourneyCostSettingsPopover.tsx` — per-journey assumption editor.
- `src/pages/admin/WhatsAppPricing.tsx` — global pricing editor (registered in `App.tsx` + sidebar/admin nav).
- Edit `src/pages/communication/JourneyAnalytics.tsx` — lazy mount `<JourneyCostAnalytics journeyId={id} />` below existing sections.

### 7. Out of scope / explicitly untouched

- `process-journeys`, `whatsapp-send*`, `journey-actions`, `twilio-balance`, schedule logic, message log writes, template APIs, wallet card.
- Click-to-WhatsApp free-entry pricing — only the `entry_point_type` field is added, no pricing branch.

### 8. Verification

- Build passes.
- Existing analytics page renders unchanged when the new section is collapsed/loading.
- Seeded pricing matches spec totals (₹ values at FX=95).
- Spot-check on the existing "Test Journey - 19th May": projected vs actual figures non-negative, undelivered excluded, failed billed at ₹0.095.
