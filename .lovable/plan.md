## Goal
Reorganise the Gold Rate card on `/inventory/price-configuration` into two tabs — **SELL** (existing fields, untouched logic) and **BUY** (new 24K purchase price with derived karat rates).

## SELL tab
Move the current Date + 14K/18K/22K inputs and "Save Gold Rates" button inside a tab, with zero changes to state, query keys, table (`gold_rates`), variable names or save logic.

## BUY tab
- Brown note at the top: "This section is to update prices for Gold purchased from the customer. This is not Sales Invoice price"
- Date (today, disabled) + one input: "24K – Buy price for 1g (₹)" + Save button.
- After save (and on load of today's saved value), display three read-only derived prices:
  - 22K Buy price = 91.6% of 24K
  - 18K Buy price = 75% of 24K
  - 14K Buy price = 58.5% of 24K

## Technical details
- New table `public.gold_buy_rates` (`rate_date` unique, `price_per_gram_24k`, timestamps) with GRANTs for `authenticated`/`service_role`, RLS enabled and policies matching the existing `gold_rates` access pattern. The existing `gold_rates` table has a CHECK constraint limiting karat to 14K/18K/22K, so buy prices are kept in their own table rather than altering it — this also guarantees no sell-side pricing logic can pick up buy rates.
- Derived karat values are computed in the UI only (not stored), so the ratios stay in one place.
- Only `src/pages/inventory/PriceConfiguration.tsx` changes on the frontend; the Diamond/CS/Making sections and all order pricing code are untouched.
