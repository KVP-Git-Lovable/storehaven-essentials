

# Plan: Friendly Variable Picker for WhatsApp Templates

## Approach

Keep storage and Twilio submission in the existing `{{1}}, {{2}}` numeric format (no DB schema changes, full backward compatibility). Layer a friendly variable picker on top of the create dialog that lets users insert named variables like `{{customer_name}}`, then transform to numeric form on submit. Store the friendly→numeric mapping inside the existing `body` field as a hidden marker comment so old templates keep working unchanged.

## 1. New Variable Registry (frontend constant)

**New file:** `src/lib/whatsappVariables.ts`

A single source of truth — grouped variables. No backend API needed (keeps things simple; can later move to DB).

```ts
export const VARIABLE_GROUPS = {
  Order: ['order_id', 'order_status', 'order_date', 'order_total'],
  Customer: ['customer_name', 'phone_number', 'email'],
  Product: ['product_name', 'quantity', 'price'],
  Store: ['store_name', 'store_address'],
};
```

Plus helpers:
- `transformFriendlyToTwilio(body)` → returns `{ twilioBody, mapping }`
- `transformTwilioToFriendly(body, mapping)` → reverse for editing

## 2. Update Create Template Dialog

**File:** `src/pages/communication/WhatsAppTemplates.tsx`

Replace the current `+ Variable` button with:
- **Insert Variable dropdown** (grouped DropdownMenu) — categories as labels, variables as items. On select, inserts `{{variable_name}}` at the textarea cursor position.
- **Live Preview panel** below the textarea with two tabs:
  - "Friendly view" — shows `Hello {{customer_name}}, your order {{order_id}}...`
  - "Twilio format" — shows the auto-numbered `Hello {{1}}, your order {{2}}...`
- **Validation badge** showing detected variables and any malformed/duplicate warnings.
- Tooltip on the dropdown: "Variables are automatically mapped to WhatsApp format on submission."

On submit: convert friendly body → numeric body and append a hidden mapping marker on a new line:
```
Hello {{1}}, your order {{2}} is confirmed
<!--vars:{"1":"customer_name","2":"order_id"}-->
```
The marker is stripped before being sent to Twilio (in the edge function).

## 3. Edge Function — Strip Marker Before Twilio

**File:** `supabase/functions/whatsapp-templates/index.ts`

In the create action, before calling Twilio Content API:
- Parse and remove the `<!--vars:...-->` marker line from `templateBody`
- Send the clean numeric body to Twilio
- Store the original body (with marker) in the DB so we can reconstruct friendly names

No DB schema change required. No breaking change for existing templates (no marker = behaves exactly as today).

## 4. Send Test Message — Named Inputs

**File:** `src/pages/communication/WhatsAppTemplateDetails.tsx`

- Parse the body for the `<!--vars:...-->` marker.
- If present: show inputs labeled with friendly names (e.g., "customer_name") instead of `{{1}}`. Map values back to numeric keys before posting.
- If absent (legacy templates): keep current `{{1}}, {{2}}` input behavior.
- Display body with friendly names in the preview when mapping exists.

## 5. Send Endpoint — Already Compatible

**File:** `supabase/functions/whatsapp-send/index.ts`

The frontend will continue to send `variables: { "1": "John", "2": "ORD123" }` (converted client-side from named values). No backend change needed. The marker is harmless even if not stripped here because variable substitution uses numeric keys; we'll strip the marker line before substitution as a safety cleanup.

## Backward Compatibility

| Scenario | Behavior |
|---|---|
| Old template (no marker) | Works exactly as today — numeric placeholders shown |
| New template (with marker) | Friendly names shown in preview & test dialog |
| Twilio submission | Always receives clean `{{1}}, {{2}}` body |
| Database | No schema change; mapping stored inline in `body` |

## Files Touched

- `src/lib/whatsappVariables.ts` (new)
- `src/pages/communication/WhatsAppTemplates.tsx` (create dialog)
- `src/pages/communication/WhatsAppTemplateDetails.tsx` (test dialog + body preview)
- `supabase/functions/whatsapp-templates/index.ts` (strip marker before Twilio)
- `supabase/functions/whatsapp-send/index.ts` (strip marker before substitution)

No changes to: routes, sidebar, navigation, RLS, DB schema, or any other module.

