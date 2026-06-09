## Goal
Upgrade `/communication/journeys/:id/analytics` into a CRM-grade dashboard inspired by Salesforce / HubSpot, matching the attached reference. Strictly additive — no changes to Journey Builder logic, scheduling, Twilio, send pipeline, templates, or DB schema. Recent Messages becomes top-5 with Show More.

## Page Layout (top → bottom)

```text
[Header: title, status, created on, audience, type, channel | date range | Share | Export | Create Journey from Segment]

[Row 1: Executive KPI strip — 10 cards w/ trend arrows vs prev period]

[Row 2: Journey Funnel | Engagement Over Time (line) | Journey Health Score (gauge + strengths/areas)]

[Row 3: Node/Message Performance table | Best Time to Engage (heatmap) | Top Performing Segments]
                                                                       [AI Insights card]

[Row 4: Revenue Attribution (donut + windows) | Cost Breakdown (donut) | Cohort Analysis (retention table)]

[Row 5: Recent Journey Activity strip (top 5 + Show more)]

[Existing JourneyCostAnalytics + JourneyEngagementSummary kept below, lazy-loaded]
```

## Sections to build

1. **Executive KPI strip** (`ExecutiveKpiStrip.tsx`): Entered, Active, Completed, Delivery Rate, Read Rate, Click Rate, Reply Rate, Conversion Rate, Revenue, Total Spend, ROI. Each with delta vs previous equivalent window, color-coded arrow.
2. **Journey Funnel** (`JourneyFunnel.tsx`): Entered → Delivered → Read → Clicked → Replied → Order Placed, with count + conversion %. Click a stage → opens dialog listing contacts in that stage (reuses existing `journey_contacts` join).
3. **Engagement Over Time** (`EngagementTrendChart.tsx`): Daily/Hourly toggle line chart for delivered/read/clicked/replied from `journey_message_log` + `whatsapp_link_clicks`.
4. **Journey Health Score** (`JourneyHealthScore.tsx`): rule-based 0–100 score, strengths and areas to improve.
5. **Node / Message Performance** (`NodePerformanceTable.tsx`): aggregate per `node_id` from `journey_message_log`; flag best/worst/highest conversion.
6. **Best Time to Engage heatmap** (`EngagementHeatmap.tsx`): day-of-week × hour grid colored by read/click rate.
7. **Top Performing Segments** (`TopSegmentsTable.tsx`): groups recipients by score buckets / repeat-customer / new-lead and shows read/click/conversion rates.
8. **AI Insights** (`JourneyInsightsCard.tsx`): rule-based bullets ("Message 2 converts 3.2× better…", "Read rate dropped after Day 5", "Opt-out risk rising").
9. **Revenue Attribution** (`RevenueAttribution.tsx`): orders for journey contacts within 1/7/15/30 day windows after first delivered message; donut + AOV + RPC.
10. **Cost Breakdown** (`CostBreakdownDonut.tsx`): pulls from existing `useJourneyCostAnalytics` — no new pricing logic.
11. **Cohort Analysis** (`CohortRetentionTable.tsx`): groups contacts by enrollment week; columns Day 1/7/14/30 read % & converted %.
12. **Recent Journey Activity** (`RecentJourneyActivity.tsx`): top 5 events (delivery/click/reply/order/opt-out) with Show more expanding to 50.
13. **Recent Messages**: existing table — change default limit to 5 with "Show more…" toggle expanding to 50.
14. **Export menu** (`AnalyticsExportMenu.tsx`): CSV (client-side), Excel (xlsx via existing dep if present, else CSV fallback), PDF (window.print of analytics container), Copy shareable URL.
15. **Date range selector** (`AnalyticsDateRange.tsx`): Today / 7d / 30d / custom — drives all hooks via shared context.

## Data layer

Single new hook `useJourneyAnalytics(journeyId, range)` (in `src/hooks/useJourneyAnalytics.ts`) — runs parallel queries and returns memoized aggregates:
- enrollments, message log, link clicks, contact events, orders for contact ids, prev-period log for deltas.
- Returns: kpis{}, funnel[], trend[], heatmap[][], nodes[], segments[], cohorts[], attribution{}, insights[], health{}.

Sentiment/engagement scoring computed client-side from existing event data using the spec's weights (delivered+1, read+3, click+5, positive reply+7, order+20, repeat+40, failed -2, opt-out -50, negative reply -10). Negative reply detection: regex match on body for `stop|not interested|don't send|unsubscribe|no thanks` (case-insensitive). Score and segment views computed per render — no schema change.

All queries scoped to `journey_id = :id` with `react-query` caching (`staleTime: 60s`). Lazy-load heavy cards via `React.lazy`.

## Files
- New: 15 components above + `useJourneyAnalytics.ts` + small `src/lib/journeyInsights.ts` (rules) + `src/lib/journeyScoring.ts`.
- Edited: `src/pages/communication/JourneyAnalytics.tsx` — restructured layout, Recent Messages collapsed to 5 + Show more. Existing `JourneyCostAnalytics` and `JourneyEngagementSummary` retained and kept mounted at bottom.

## Constraints respected
- No schema changes, no edge function changes, no Twilio changes, no changes to Journey Builder pages/components.
- Reuses existing tables: `journeys`, `journey_enrollments`, `journey_message_log`, `journey_contacts`, `journey_contact_events`, `whatsapp_link_clicks`, `orders`, `journey_cost_settings`, `whatsapp_pricing_config`.
- Cost section uses existing `useJourneyCostAnalytics` — pricing logic untouched.
- Recent Messages and all current cards keep working; new cards are additive.

## Open question
Ok to proceed with this scope in one pass, or would you like me to ship in phases (Phase 1: KPI strip + Funnel + Health + Recent Messages top-5; Phase 2: Node/Heatmap/Segments/Insights; Phase 3: Cohorts/Attribution/Export)?
