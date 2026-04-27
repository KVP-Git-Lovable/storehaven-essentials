## Goal
Add a structured fallback + request-logging system to the WhatsApp module so that whenever the bot can't answer, the customer gets a reassuring reply and a "Request" record is created for the team to action from a new tab in the Conversations page.

## Part 1 — Database (migration)

New table `public.whatsapp_requests`:

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | default `gen_random_uuid()` |
| phone_number | text | not null, indexed |
| customer_id | uuid | nullable, FK-style ref to `customers.id` (no hard FK to keep it resilient) |
| customer_name | text | nullable, captured from profile/customer at time of logging |
| request_type | text | default `'Assistance'` (free text — supports future "Complaint", "Suggestion", etc.) |
| message_text | text | the original user message that triggered fallback |
| city | text | nullable, taken from `customers.city` if available |
| conversation_phone | text | same as `phone_number`, used to deep-link to the thread |
| inbound_message_id | uuid | nullable, ref to the `whatsapp_messages.id` that triggered it |
| status | text | default `'Open'`, allowed: `Open`, `Converted`, `Cleared` |
| created_at | timestamptz | default `now()` |
| updated_at | timestamptz | default `now()` |

- Enable RLS. Policies: authenticated users can `select`/`update`; service role (edge function) can `insert`.
- Add `updated_at` trigger using existing `update_updated_at_column()`.
- Add to realtime publication so the Requests tab updates live.

## Part 2 — Edge function fallback (`supabase/functions/whatsapp-inbound/index.ts`)

Today the inbound handler matches greetings, then a product-intent regex, otherwise returns empty TwiML. We'll add an explicit fallback branch:

1. After greeting + product-intent checks fail (and the message is non-empty / not a status callback), treat it as **unhandled**.
2. Reply via TwiML with the exact copy:
   > "I'm sorry, I do not have that information right now. Meanwhile, I will log a request for assistance on your behalf so that a member of our team can help you shortly."
3. Insert a row into `whatsapp_requests`:
   - `phone_number` = normalized `from`
   - `customer_id`, `customer_name`, `city` = looked up from `customers` (reuse existing exact + last-10-digit fuzzy lookup)
   - `customer_name` falls back to `ProfileName` if no customer match
   - `message_text` = inbound `Body`
   - `inbound_message_id` = id returned from the existing inbound `whatsapp_messages` insert
   - `request_type` = `'Assistance'`, `status` = `'Open'`
4. Also log the bot's apology reply into `whatsapp_messages` (outbound) so it shows in the thread.
5. Existing greeting and product-intent flows stay untouched.

## Part 3 — UI: Conversations page tabs

`src/pages/communication/WhatsAppConversations.tsx`:

- Wrap current page body in a `Tabs` component with two tabs:
  - **All Conversations** — current 3-pane layout, unchanged.
  - **Requests** — new view (component below).
- Tab state lives in URL search param `?tab=requests` so we can deep-link from a request row back to "All Conversations" with a preselected phone.

## Part 4 — Requests tab

New component `src/components/communication/WhatsAppRequestsTab.tsx`:

- Filters bar:
  - **Request Type** select (options pulled distinct from table, default `All`, plus seeded `Assistance`, `Complaint`, `Suggestion`)
  - **Status** select: `All / Open / Converted / Cleared` (default `Open`)
  - **Date range** from / to (created_at)
  - Search box (name / phone)
- Table columns: Customer Name · Phone Number · Request Type (Badge) · Message (truncated, tooltip on hover) · Date & Time · City · Status · Actions
- Actions per row:
  - **View Conversation** → switches parent tab to "All Conversations" and sets `selectedPhone` to that request's phone (lifted via callback or URL param).
  - **Add to Ticket** → updates `status='Converted'` (placeholder for future ticketing integration; toast says "Marked as converted — ticketing integration coming soon").
  - **Clear** → updates `status='Cleared'`.
- Uses `useQuery` against `whatsapp_requests` joined with `customers` for name/city fallback.
- Subscribes to realtime inserts on `whatsapp_requests` to refresh the list.
- Empty state + loading skeletons.

## Part 5 — Wiring conversation deep-link

- Lift `selectedPhone` and `activeTab` into the parent page so the Requests tab can call `onOpenConversation(phone)` which sets `activeTab='all'` and `selectedPhone=phone`.

## Part 6 — Constraints honored

- Greeting and Product-Inquiry intents are evaluated **before** fallback, so existing flows are unaffected.
- Logging only happens in the new fallback branch.
- `request_type` is a free-text column with a default — adding new types later requires no schema change.
- Existing `whatsapp_messages` schema is untouched.

## Files to create / edit

- **migration**: create `whatsapp_requests` table + RLS + trigger + realtime
- **edit** `supabase/functions/whatsapp-inbound/index.ts` — add fallback branch, insert request, send apology TwiML
- **edit** `src/pages/communication/WhatsAppConversations.tsx` — add Tabs wrapper, lift state
- **create** `src/components/communication/WhatsAppRequestsTab.tsx` — Requests table, filters, actions

## Out of scope (flagged for later)

- Real ticket creation — "Add to Ticket" only flips status today; ticketing integration is a follow-up.
- Multi-language fallback copy.
- Auto-classifying request types via AI.
