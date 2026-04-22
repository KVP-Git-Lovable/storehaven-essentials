

## WhatsApp Conversations Dashboard

Replace the existing **WhatsApp Senders** page with a full **WhatsApp Conversations** dashboard that captures every inbound and outbound message, lets admins read full chat threads, and surfaces customer/order insights.

### 1. Database

New table `public.whatsapp_messages`:

| column | type | notes |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `phone` | text NOT NULL | E.164, normalized (strip `whatsapp:` prefix) |
| `customer_id` | uuid NULL | FK → `customers.id` (nullable, no cascade) |
| `direction` | text NOT NULL | `inbound` \| `outbound` |
| `message` | text | message body |
| `message_type` | text default `'text'` | `text` \| `template` \| `button` |
| `order_id` | uuid NULL | FK → `orders.id` |
| `status` | text default `'sent'` | `sent` \| `delivered` \| `read` \| `received` |
| `twilio_message_sid` | text NULL | for de-dup / status callbacks |
| `profile_name` | text NULL | from Twilio inbound `ProfileName` |
| `is_read` | boolean default `false` | for unread badge in left panel |
| `created_at` | timestamptz default `now()` | |

Indexes: `(phone, created_at desc)`, `(customer_id)`, `(created_at desc)`.

RLS: enabled.
- `SELECT`: authenticated users.
- `INSERT/UPDATE`: admin only via `is_admin(auth.uid())` (edge functions use service role and bypass RLS).

Realtime: add table to `supabase_realtime` publication so the conversation panel can live-update.

### 2. Data capture (additive only — existing flows untouched)

**`whatsapp-inbound`** edge function — append after greeting handling, before TwiML response:
1. Normalize `from` → strip `whatsapp:` prefix.
2. Lookup `customers.id` by phone (best-effort match against `phone` column, also try last 10 digits).
3. Insert row: `direction='inbound'`, `message=body`, `phone`, `customer_id`, `profile_name`, `twilio_message_sid`, `status='received'`, `is_read=false`.
4. If a greeting auto-reply is sent, also insert an `outbound` row with the welcome text.
5. Wrapped in try/catch — logging failure must never break TwiML response.

**`whatsapp-send`** edge function — after successful Twilio send, in addition to existing `whatsapp_message_log` insert, also insert into `whatsapp_messages`:
- `direction='outbound'`, `phone=to_number`, `message=messageBody`, `message_type='template'`, `twilio_message_sid`, `status=twilioData.status`, `customer_id` (lookup by phone).
- Existing `whatsapp_message_log` insert is **not** removed — both tables coexist.

### 3. Route changes

- **Replace** `/communication/whatsapp/senders` → `/communication/whatsapp/conversations` in `src/App.tsx` (lazy import switched to new file).
- Update `src/lib/modules.ts` mapping key.
- Update `src/pages/communication/WhatsAppCenter.tsx` card: title "WhatsApp Conversations", description "View all WhatsApp chats with customers, track orders and engagement.", icon `MessagesSquare`, href `/communication/whatsapp/conversations`.
- Old `WhatsAppSenders.tsx` file is deleted.

### 4. New page — `src/pages/communication/WhatsAppConversations.tsx`

Two-pane layout, full-height (`h-[calc(100vh-12rem)]`), responsive (stacks on mobile with a back-to-list arrow on the chat pane).

```text
+------------------- Header (BackButton + title + filters) -------------------+
| Search [name/phone]   Date [from-to]   Type [all|text|template|button]      |
+------------------+----------------------------------+----------------------+
| LEFT (conv list) | CENTER (chat thread)             | RIGHT (insights)     |
| 320px            | flex-1                           | 280px (xl+ only)     |
| - Avatar         | Header: name, phone, View Order  | Total messages       |
| - Name / phone   | Scroll: msgs grouped by date     | WhatsApp orders      |
| - Last preview   |  inbound = left bubble (muted)   | Revenue (₹ en-IN)    |
| - Time (relative)|  outbound= right bubble (primary)| Last interaction     |
| - Unread badge   |  template tag, button tag        | Customer tier        |
+------------------+----------------------------------+----------------------+
```

**Left panel — conversation list**
- Query: distinct `phone` with `last_message`, `last_at`, `unread_count` — implemented as a single `whatsapp_messages` select sorted by `created_at desc` then reduced client-side (volume-friendly with index + limit 500). Joined with `customers` via `customer_id` for name/tier.
- Search input filters list client-side by name OR phone substring.
- Selecting a row sets `selectedPhone`, marks unread rows `is_read=true` (admin-only update; UI optimistic).

**Center — chat thread**
- Query: `whatsapp_messages` where `phone = selectedPhone` ordered ascending, applying date + message_type filters.
- Bubbles: inbound left (`bg-muted`), outbound right (`bg-primary text-primary-foreground`); timestamp under each.
- Template messages get a small `Badge` "Template"; button replies get "Button".
- Realtime subscription on `whatsapp_messages` filtered to `phone=eq.{selectedPhone}` — appends new rows live.
- If any message in thread has `order_id`, render a "View Order" button that navigates to `/transactions/orders` (drill into order row); also each individual message with `order_id` shows an inline "View Order" link.

**Right — Customer Insights** (only when a customer is linked)
- Total messages: count of all rows for `phone`.
- Orders via WhatsApp: distinct `order_id` count from `whatsapp_messages` for that customer.
- Revenue: sum of `orders.total_amount` for those linked orders (status `completed`).
- Last interaction: relative time of most recent message.
- If no `customer_id`, show a muted "Unknown contact — not linked to any customer" block.

**Filters bar**
- Search (debounced 250 ms) — name or phone.
- Date range (two `Input type="date"` or shadcn date popover) — applied to thread + list.
- Message type `Select`: All / Text / Template / Button.

### 5. Order linking

- Inbound messages: webhook does **not** attempt order detection in this iteration (out of scope per "do not modify order logic"). `order_id` stays nullable and can be populated later by future intent handlers.
- Outbound: when `whatsapp-send` is invoked with a future `order_id` variable, the field is stored if present in `body.order_id` (added as optional param, backwards compatible — existing callers unaffected).
- UI surfaces "View Order" only when `order_id` is set.

### 6. Scalability notes

- Composite index `(phone, created_at desc)` keeps thread reads O(log n).
- List query limited to most recent 500 messages then grouped client-side; can be replaced later with a SQL view / materialized rollup if volume grows.
- Realtime channel scoped per `phone` to avoid global broadcast storms.

### 7. Constraints honored

- No changes to `customers`, `orders`, or any existing logic.
- `whatsapp_message_log`, `whatsapp_templates`, `whatsapp-config`, `whatsapp-senders` functions untouched.
- Inbound greeting flow preserved exactly — capture happens in a try/catch around the existing logic.
- Old `WhatsAppSenders` page is removed (replaced as requested).

### Files

- **Migration:** create `whatsapp_messages` + indexes + RLS + realtime publication.
- **Edit:** `supabase/functions/whatsapp-inbound/index.ts` — log inbound + auto-reply.
- **Edit:** `supabase/functions/whatsapp-send/index.ts` — log outbound, accept optional `order_id`.
- **New:** `src/pages/communication/WhatsAppConversations.tsx`
- **Edit:** `src/App.tsx` — swap route and lazy import.
- **Edit:** `src/lib/modules.ts` — update path key.
- **Edit:** `src/pages/communication/WhatsAppCenter.tsx` — update card.
- **Delete:** `src/pages/communication/WhatsAppSenders.tsx`.

