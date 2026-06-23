
# WhatsApp Send — 10-digit vs +91 Format Audit (No Changes)

## Goal
Guarantee that a phone stored as either `7336199819` or `+917336199819` (and the common `917336199819` no-plus variant Twilio emits) results in a successful WhatsApp send. The only normalization needed at send time:

- 10 digits → prepend `+91`
- already `+91XXXXXXXXXX` → use as-is
- 12 digits starting with `91` → prepend `+`

No schema changes, no UI changes, no migrations.

---

## Send sites that will FAIL today on a bare `7336199819`

| # | File | Line | What it does | Why it fails |
|---|---|---|---|---|
| 1 | `supabase/functions/whatsapp-send/index.ts` | 95 | `if (!/^\+[1-9]\d{1,14}$/.test(to_number)) → 400` before Twilio call | Rejects `7336199819` outright. Used by manual template send and any caller passing a raw stored number. |
| 2 | `supabase/functions/_shared/journey-channels.ts` | 73 (`sendWhatsAppFreeform`) | Same strict E.164 regex, throws "Invalid recipient phone" | Blocks every journey free-form WhatsApp step when the audience row has a 10-digit phone. |
| 3 | `supabase/functions/_shared/journey-channels.ts` | 131 (`sendSms`) | Same regex | Same failure for SMS-from-journey (out of scope but same fix.) |
| 4 | `supabase/functions/whatsapp-send-freeform/index.ts` | 43 | Passes `to_number` straight to `sendWhatsAppFreeform` | Inherits #2's rejection. |
| 5 | `src/pages/communication/WhatsAppTemplateDetails.tsx` | 117–126 | POSTs `to_number` from the test-send dialog (`+91…` placeholder, but free text) | If user pastes `7336199819`, request hits #1 and is rejected. |

## Send sites that already work
- `supabase/functions/process-journeys/index.ts` L448–454 has a `normalize()` that prepends `+91` for plain 10-digit, and `+` for already-CC numbers — good. (It does double-prefix when stored as `91…` no-plus; minor edge case worth fixing in the same pass.)
- `supabase/functions/track-link-click/index.ts` L15 — already prepends `+91` for 10-digit. Not a send site but mirrors the rule.
- WhatsApp inbound (`whatsapp-inbound/index.ts`) — receives full E.164 from Twilio; no action needed.

## Audience / source surfaces that feed the send sites above
These don't send by themselves but determine what string lands in `to_number`. They are listed only to confirm a bare 10-digit value can reach a send site (i.e. the audit must cover them as inputs, not as fix sites):

- Leads: `leads.phone` — `leadImport.ts` accepts `^\+?\d{10,15}$` → can be 10-digit.
- Customers: `customers.phone` — `customerImport.ts` requires `^\d{10,15}$` (strips `+`) → routinely 10-digit.
- Visitors: project has no separate `visitors` table; "visitor" surfaces (POS walk-in, store_contacts) reuse `customers`/`leads`.
- Journey audiences (List Views on Customers / Leads / Orders) — pass `customer_phone` / `phone` through unchanged.
- Campaign / template test send — manual input.
- Conversation views read-only (`WhatsAppConversations.tsx`, `JourneyConversations.tsx`) — they don't initiate sends in scope, but the "Reply" / "Send template" controls funnel through #1 or #2.

Conclusion: **every send path ultimately funnels through #1, #2, or #4**, so fixing those three guarantees both `7336199819` and `+917336199819` work everywhere.

---

## Proposed minimal fix (to implement after approval)

### Add one tiny helper (Deno-only, used by 3 files)
`supabase/functions/_shared/phone-india.ts`:

```ts
export function toWhatsAppE164IN(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") && /^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed; // already E.164
  if (digits.length === 10) return `+91${digits}`;                                    // 7336199819
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;           // 917336199819
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`; // 07336199819
  return null; // anything else stays invalid
}
```

### Wire it in at the 3 send sites only

1. `whatsapp-send/index.ts` — before the regex on L95, replace `to_number` with `toWhatsAppE164IN(to_number) ?? to_number`. Same for `from_number` is unnecessary (admin-configured). On `null`, keep the existing 400 response.
2. `_shared/journey-channels.ts` — at the top of `sendWhatsAppFreeform` (and `sendSms`), call the helper and substitute before the validation regex. Throw the existing error only if the helper returned `null`.
3. `whatsapp-send-freeform/index.ts` — no change needed once #2 is fixed (it just forwards).

### Optional micro-fix in same pass
`process-journeys/index.ts` L448–454: replace the local `normalize()` with the shared helper so the `91…` no-plus case stops producing `+91917…`.

### What this fix does NOT touch
- No schema, no migration, no backfill.
- No changes to import validators, form dialogs, or storage format.
- No multi-country logic — India only, matching the stated requirement.
- No changes to conversation-view lookups (already tolerant via last-10 matching where it matters).

---

## Deliverable of this step
This audit. After approval, the implementation will be limited to the new `phone-india.ts` helper plus three small call-site edits listed above.
