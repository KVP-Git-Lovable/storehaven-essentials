# Plan: Guarantee Every Journey Variable Resolves to Real Data

## Goal
Eliminate the class of bug where a variable is selectable in the Journey Builder picker but resolves to empty/fallback text at send time (e.g. `customer_last_order_date` → `"Customer"`).

## Root cause
Today we maintain two disconnected lists:
- **Frontend:** `src/lib/whatsappVariables.ts` → `VARIABLE_REGISTRY` (what users can pick)
- **Backend:** `supabase/functions/process-journeys/index.ts` → `ENRICHABLE_TOKENS` + ad-hoc field mapping in `enrichContact` (what actually gets joined from the DB)

When someone adds a variable to the picker without also wiring it into `enrichContact`, sending silently falls back to the contact name. Nothing fails loudly.

## Solution: one declarative registry, two consumers

### 1. Convert `VARIABLE_REGISTRY` into a self-describing schema
Each leaf variable declares **how to resolve it**, not just its label:

```ts
type VariableLeaf = {
  name: string;              // "customer_last_order_date"
  label: string;             // "Last Order Date"
  source:                    // tells the backend where to read from
    | { kind: "contact"; field: string }                 // journey_contacts.<field>
    | { kind: "customer"; field: string; format?: "date" | "currency" | "number" }
    | { kind: "last_order"; field: string; format?: ... }
    | { kind: "store"; field: string }
    | { kind: "journey"; field: string }
    | { kind: "static"; value: string };
};
```

The picker keeps rendering `label`; the backend reads `source`.

### 2. Single shared resolver module
Create `supabase/functions/_shared/variable-resolver.ts` (and re-export the registry from a shared file usable by both Vite and Deno):
- `src/lib/variables/registry.ts` — pure data, no React imports.
- `supabase/functions/_shared/variable-resolver.ts` — imports the same registry via a relative path (`../../../src/lib/variables/registry.ts`) or a duplicated `.ts` kept in sync by a test (see §4).
- One function `resolveTokens(tokens, ctx)` walks the registry, fetches the minimum set of joins needed (customer, last order, store, journey), formats values, and returns `Record<string,string>`.

`process-journeys` then calls `resolveTokens` instead of the bespoke `enrichContact` + metadata-fallback dance.

### 3. Picker only shows resolvable variables
`InsertVariablePicker` filters out any leaf whose `source.kind` isn't implemented yet (a `RESOLVER_KINDS` set exported from the resolver). Adding a variable to the registry without a resolver means it simply won't appear in the UI — no silent failures.

### 4. Parity test (the safety net)
Add `src/lib/variables/__tests__/registry.test.ts` that, for every leaf in the registry:
- asserts `source` is present and uses a kind the resolver supports,
- asserts `source.field` exists in the corresponding Supabase type (`Database["public"]["Tables"][...]["Row"]`) — this catches typos and removed columns at build time,
- asserts the friendly token name is unique.

Runs in CI via `bunx vitest run`. A future PR that adds `customer_favourite_colour` to the picker but forgets to wire a resolver fails the test instead of shipping.

### 5. Backfill the existing gaps
While converting the registry, audit every current leaf:
- `customer_dob` → add resolver (customer.date_of_birth) or remove from registry.
- `lead_*`, `visitor_*`, `retailer_*`, `employee_*`, `order_item_*`, `product_*`, `journey_event_*` — currently in the picker, none resolved. For each: either implement the resolver or hide the group behind a feature flag until the entity is wired up.

### 6. Send-time guard
In `whatsapp-send` (and anywhere variables are substituted), if a token resolves to empty string **and** the registry says it should have a value, log a structured warning (`level=warn`, `token`, `journey_id`, `contact_id`) and substitute `""` (not the contact name). Update the existing `"Customer"` fallback path so unresolved variables never silently borrow a different field's value.

## Files touched
- **New:** `src/lib/variables/registry.ts`, `supabase/functions/_shared/variable-resolver.ts`, `src/lib/variables/__tests__/registry.test.ts`
- **Edit:** `src/lib/whatsappVariables.ts` (re-export from new registry for back-compat), `src/components/communication/InsertVariablePicker.tsx` (filter by resolver support), `supabase/functions/process-journeys/index.ts` (replace `enrichContact` + `ENRICHABLE_TOKENS` with `resolveTokens`), `supabase/functions/whatsapp-send/index.ts` (remove "Customer" fallback for known tokens; warn on empty)
- **Delete:** the duplicated `ENRICHABLE_TOKENS` list

## Rollout
1. Land registry + resolver + tests (no behaviour change — backend still uses old path).
2. Switch `process-journeys` to `resolveTokens`; verify on journey `7e83ec6f…` that `{{customer_last_order_date}}` renders the real date.
3. Switch picker to filter by `RESOLVER_KINDS`; entities without resolvers disappear from the UI.
4. Remove the legacy `enrichContact` code and `"Customer"` fallback.

## Outcome
After this lands, the only way to expose a variable to users is to declare its data source — making the bug you hit structurally impossible.
