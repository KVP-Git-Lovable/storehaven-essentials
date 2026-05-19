# Hierarchical Insert Variable Picker

Refactor the **Insert Variable** control inside the Create/Edit WhatsApp Template modal (`/communication/templates`) into a 3-level drill-down picker. Strictly a UI/UX change — no backend, no Twilio, no schema, no variable-syntax changes.

## Scope

- **File changed:** `src/pages/communication/WhatsAppTemplates.tsx` — replace the existing `DropdownMenu` block that lists `VARIABLE_GROUPS` flat.
- **File added:** `src/components/communication/InsertVariablePicker.tsx` — the new hierarchical Popover component.
- **File extended:** `src/lib/whatsappVariables.ts` — add a new `VARIABLE_REGISTRY` constant (Entity → Category → Variables). The existing `VARIABLE_GROUPS`, `ALL_VARIABLES`, `extractFriendlyVariables`, `transformFriendlyToTwilio`, `parseStoredBody`, `validateFriendlyBody`, and marker logic stay untouched so Twilio mapping and send/preview behavior are identical.

## New registry shape (frontend-only)

```ts
// whatsappVariables.ts (added, existing exports preserved)
export type VariableEntity = {
  key: string;         // "customer", "lead", "order", ...
  label: string;       // "Customer"
  categories: {
    key: string;       // "name", "contact", "date", "address", "financial", "order", "custom"
    label: string;     // "Name Fields"
    variables: { name: string; label: string }[]; // name is the friendly token used in {{...}}
  }[];
};
export const VARIABLE_REGISTRY: VariableEntity[] = [ /* see below */ ];
```

Initial entities seeded: **Customer, Lead, Visitor, Order, Order Item, Product, Retailer, Employee, Journey, Journey Event, Store**. Each entity carries the category buckets the user listed (Name / Contact / Date / Address / Financial / Order / Custom). Variable tokens preserve the existing dot-friendly convention already accepted by `extractFriendlyVariables` (regex `[a-zA-Z_][a-zA-Z0-9_]*` — note: current regex does NOT allow dots, so tokens will be of the form `customer_first_name`, `order_last_amount`, etc., matching the existing flat set's style). This keeps the Twilio numeric remap working with zero engine changes.

> The user's example `{{customer.first_name}}` would break the existing regex/marker contract. We will use `{{customer_first_name}}` style to stay compliant with the "do not modify variable syntax/parser" constraint. Will be called out in the closing message.

## Component design — `InsertVariablePicker`

A single `Popover` (replaces the existing `DropdownMenu`) that internally manages a 3-step view via local state `step: "entity" | "category" | "variable"`.

```text
+-------------------- Popover (w-72) --------------------+
| < Back   [crumb: Customer > Date Fields]        [x]   |
| [ Search... ]                                          |
| ----------------------------------------------------- |
| Step 1: list of entities  (Command list, scrollable)  |
| Step 2: list of categories for chosen entity          |
| Step 3: list of variables for chosen category         |
+--------------------------------------------------------+
```

- Built with existing `Popover` + `Command`/`CommandInput`/`CommandList`/`CommandItem` (shadcn) for searchable lists at each level — matches the pattern already used in `HierarchicalCategorySelector`.
- Search box is scoped to the current step (entity names, category labels, or variable labels/tokens).
- Breadcrumb shows the trail; clicking a crumb (or the Back chevron) returns to that step.
- Step 3 `onSelect` calls the existing `insertVariableAtCursor(varName)` (unchanged), then closes the popover.
- Compact: `w-72`, `max-h-80 overflow-auto`. Works on mobile (popover auto-positions; uses `align="end"`).
- **Lazy rendering:** only the current step's list is rendered. Variables for a category are only mapped when step 3 is active.
- **Remember last entity:** persisted in `localStorage` under key `wa.insertVar.lastEntity`. On open, picker starts at step 2 with that entity preselected (Back returns to step 1). Falls back to step 1 if absent.

## WhatsAppTemplates.tsx edit

Replace lines ~727–759 (the `TooltipProvider > Tooltip > DropdownMenu...` block) with:

```tsx
<InsertVariablePicker onInsert={insertVariableAtCursor} />
```

The tooltip explaining auto-mapping moves inside the new component's trigger to preserve the existing hint. Nothing else in the modal, validation, save flow, or preview is touched.

## What is NOT changed

- `insertVariableAtCursor` body, textarea ref, `form.body` state.
- `VARIABLE_GROUPS`, `ALL_VARIABLES`, marker regex, `buildStoredBody`, `parseStoredBody`, `stripMarker`, `validateFriendlyBody`.
- `whatsapp-send` edge function, Twilio payload, template DB schema, preview rendering, `WhatsAppTemplateDetails`.
- Show-All/Show-Mine toggle and any other recent template page behavior.

## Acceptance

- Clicking **Insert Variable** opens a small popover showing only entities (or the remembered entity's categories).
- Each step has its own search and a Back/breadcrumb.
- Choosing a variable inserts the same `{{token}}` string that the existing flat picker would have inserted for that token, and the Twilio submission still produces identical `{{1}}, {{2}}` output.
- No edge-function or DB migration required; build passes.
