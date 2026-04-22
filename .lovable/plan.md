

## Fix: WhatsApp template variable shows `{{contact.name}}` literally

### Problem

The journey message node maps template variable `{{1}}` → `{{contact.name}}`, but `process-journeys` doesn't understand that token format. It currently only resolves single-brace tokens like `{customer_name}` against direct fields on the contact row. So the literal string `{{contact.name}}` is forwarded to Twilio and the recipient receives it verbatim.

### Fix

Update `resolveVariables` in `supabase/functions/process-journeys/index.ts` to support the `{{contact.<field>}}` token format produced by the journey builder UI, with sensible aliases and a graceful fallback.

Resolution rules (in order, per mapped value):
1. If value is a `{{contact.<path>}}` token → look up `<path>` on the contact row.
   - Aliases: `contact.name` → `name` (fallback: `first_name + ' ' + last_name`); `contact.first_name`, `contact.last_name`, `contact.email`, `contact.phone` → matching column on `journey_contacts`.
   - Also support nested paths into `journey_contacts.metadata` JSON (e.g. `{{contact.metadata.city}}` or `{{contact.city}}` falls through to `metadata.city`).
2. If value contains one or more `{{...}}` or `{...}` tokens mixed with literal text → replace each token with its resolved value (so things like `Hi {{contact.first_name}} 👋` work).
3. If value is a plain field name (no braces) → direct lookup as today.
4. If the resolved value is empty/null → fall back to `'Customer'` for variable `{{1}}`, empty string for others (matches existing safety net for Twilio error 63019).

Also keep the existing default: if mapping doesn't supply `1` at all, still default to contact name.

### Verification

- Re-trigger the affected enrollments for the `highvalue_8lakh` template.
- The recipient should see "Hi Suyog Hegde Kundapura" (or the actual name from `journey_contacts.name`) instead of the literal token.
- Journey logs should record the rendered variables JSON with the resolved name.

### Files changed

- `supabase/functions/process-journeys/index.ts` — rewrite `resolveVariables` with the rules above.

No DB migration, no UI change needed — the binding chips users already inserted (`{{contact.name}}`, `{{contact.first_name}}`, etc.) will start resolving correctly.

