# Home Dashboard Redesign — Executive Marketing + Business Overview

Replace the current operations-style dashboard at `/dashboard` with a crisp, executive marketing + business snapshot. Reuses existing tokens (`stat-card`, navy/teal palette, Inter/Plus Jakarta Sans), shadcn components, and existing tables — **no schema, API, permission, or workflow changes**.

## Layout (max 8 widgets)

```text
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Customers /  │   Orders     │   Revenue    │  Marketing   │   Section 1: KPI row
│   Leads      │              │              │   Activity   │   (4 cards)
└──────────────┴──────────────┴──────────────┴──────────────┘
┌─────────────────────────────────────┬──────────────────────┐
│  Revenue & Orders Trend (30 days)   │  Communication       │   Section 2 + 3
│  (single line/area chart)           │  Health (WA/Voice/   │
│                                     │  Email compact)      │
└─────────────────────────────────────┴──────────────────────┘
┌──────────────────┬──────────────────┬─────────────────────┐
│  Quick Actions   │  Recent Activity │  Top Channel +      │   Sections 4, 5, 6+7+8
│  (5 buttons)     │  (5–8 items)     │  Team + AI Insights │
│                  │                  │  (stacked compact)  │
└──────────────────┴──────────────────┴─────────────────────┘
```

Total widgets: 4 KPI cards + Trend chart + Communication Health + Quick Actions + Recent Activity + Top Channel + Team Snapshot + AI Insights = within the 8-component executive scope (the KPI row counts as one band).

## Widget specs

1. **KPI Card — Customers / Leads**: `customers` count, `leads` count, MoM growth % (compare current vs previous calendar month on `created_at`).
2. **KPI Card — Orders**: this-month orders, completed (`status='completed'`), pending (`status='pending'`).
3. **KPI Card — Revenue**: SUM(`orders.total_amount`) this month, growth % vs last month, `en-IN` formatting (₹1,00,000 / ₹1.2L).
4. **KPI Card — Marketing Activity**: counts of active journeys (`journeys.status='active'`), active WhatsApp/Voice/Email campaigns derived from `journeys` channel types already present in canvas_data (best-effort, fallback 0 if not derivable without new logic).
5. **Revenue & Orders Trend**: single Recharts composed chart (area for revenue, line for orders) over last 30 days from `orders` grouped by `created_at::date`. Reuse existing Recharts theme.
6. **Communication Health**: compact card with three rows (WhatsApp delivery/read %, Voice connected % & voice orders, Email open/click %) computed from `journey_message_events` event_type aggregation + `whatsapp_message_log`. Today's total messages/calls shown as header chip.
7. **Quick Actions**: replace current ops actions with: Create Journey (`/communication/journeys/new`), Send Campaign (`/communication/whatsapp`), Add Customer (`/transactions/customers?action=add`), Create Order (`/pos`), Add Product (`/transactions/products?action=add`). Reuse existing `Button` styles from current `QuickActions.tsx`.
8. **Recent Activity**: unified feed (journeys created, campaigns sent, orders placed, leads added, customers added) — query latest 5–8 rows across `journeys`, `orders`, `leads`, `customers`, `journey_message_events`, sort by created_at desc.
9. **Top Performing Channel** (compact): compare WhatsApp vs Voice vs Email engagement % over last 30d from `journey_message_events`; show winner with "X% better than Y" delta.
10. **Team Snapshot** (compact): active users from `profiles` (status='active'), online-now placeholder using last login if available else hidden, top user by orders created in last 30d (`orders.created_by`).
11. **AI Insights** (compact, max 3 bullets): purely derived deltas from existing metrics (engagement +/- vs previous period, conversion trend, delivery dip). No new AI calls — simple computed deltas styled as insight chips. Sparkles icon header.

Widgets 9, 10, 11 stack inside the right column of the bottom row to keep the visible widget count low and the layout executive.

## Technical details

**Files**
- `src/pages/Dashboard.tsx` — rewrite to compose the new layout.
- `src/components/dashboard/KpiCard.tsx` (new) — multi-line KPI variant (primary + 2 sub-metrics + delta).
- `src/components/dashboard/RevenueOrdersTrend.tsx` (new) — Recharts ComposedChart, 30-day window.
- `src/components/dashboard/CommunicationHealth.tsx` (new).
- `src/components/dashboard/MarketingQuickActions.tsx` (new) — replaces existing `QuickActions` usage on dashboard only (leave the old file untouched in case used elsewhere).
- `src/components/dashboard/MarketingRecentActivity.tsx` (new) — separate from existing ops `RecentActivity.tsx`.
- `src/components/dashboard/TopChannelCard.tsx` (new).
- `src/components/dashboard/TeamSnapshotCard.tsx` (new).
- `src/components/dashboard/AIInsightsCard.tsx` (new).
- `src/hooks/useDashboardMetrics.ts` (new) — single hook batching the supabase queries with `useQuery`, scoped by existing `useStoreAccess` for store-restricted users (preserve current access pattern).

**Data sources (read-only, existing tables)**
- `customers`, `leads`, `orders`, `journeys`, `journey_message_events`, `whatsapp_message_log`, `profiles`.
- All filtering respects `useStoreAccess` exactly as the current Dashboard does for store-scoped tables (`orders.store_id`).

**Design tokens**
- Reuse `stat-card`, semantic colors (`primary`, `success`, `warning`, `destructive`, `muted-foreground`), `text-xs/sm/2xl` scale, en-IN currency, `whitespace-nowrap` per project standards. No new colors.
- Responsive: KPI grid `grid-cols-2 md:grid-cols-4`; mid row `lg:grid-cols-3` (chart spans 2); bottom row `lg:grid-cols-3` stacking on mobile.

**Out of scope (explicitly NOT added)**
- Journey funnel, segments, cohorts, heatmaps, attribution, conversion tables — those stay in Journey Analytics.
- No schema/migration changes, no edge function changes, no permission edits.
- Existing `QuickActions.tsx` and `RecentActivity.tsx` files remain untouched (only the dashboard page stops importing them).

## Acceptance
- `/dashboard` renders the new layout with all 8 widget areas populated from live data.
- Layout works at 1052px (current viewport) and on mobile (`grid-cols-2` for KPIs).
- No console errors; existing store-access filtering preserved on order/revenue widgets.
