

## WhatsApp Configuration — Backend + Frontend

Replace the current placeholder at `/communication/whatsapp/config` with a real, server-fetched view of the Twilio WhatsApp sender configuration. All Twilio credentials remain server-side; the existing inbound webhook and messaging flows are untouched.

### 1. Database — store webhook URL (optional but recommended)

New table `public.whatsapp_config` (single-row config table):

| column | type | notes |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `sender_number` | text | E.164, nullable |
| `business_name` | text default `'QuickApp'` | |
| `webhook_url` | text | inbound webhook URL |
| `throughput` | text default `'80 messages per second'` | |
| `last_synced_at` | timestamptz | updated on each sync |
| `created_at` / `updated_at` | timestamptz default `now()` | |

- RLS: enabled. Policies:
  - `SELECT`: any authenticated user with `communication.journeys` view permission (mirrors existing pattern) — simplest: `authenticated` role can `SELECT`.
  - `INSERT/UPDATE`: admin only (`public.is_admin(auth.uid())`).
- Seed one row with `webhook_url = 'https://fukkurwmuxcyoyqwchdb.supabase.co/functions/v1/whatsapp-inbound'` (the public webhook just deployed).

### 2. New edge function — `supabase/functions/whatsapp-config/index.ts`

Public-auth (verify_jwt = true via in-code `getClaims`), GET only.

Logic:
1. Validate caller JWT (`getClaims`) — reject unauthenticated.
2. Read row from `whatsapp_config` (service role) for `webhook_url`, `business_name`, `throughput`.
3. Call Twilio Messaging API via the **connector gateway** (no raw creds in code):
   ```
   GET https://connector-gateway.lovable.dev/twilio/v1/Channels/Senders
   Authorization: Bearer ${LOVABLE_API_KEY}
   X-Connection-Api-Key: ${TWILIO_API_KEY}
   ```
   Note: Twilio's Messaging Senders endpoint lives under `messaging.twilio.com/v1` (not `/2010-04-01/Accounts/...`). Will use the gateway path `/twilio/v1/Channels/Senders`; if the gateway only proxies the Account-scoped REST API, fall back to `/IncomingPhoneNumbers.json` (already proven to work in `whatsapp-senders`) and filter for WhatsApp-capable numbers. The function will try Senders first and gracefully fall back.
4. Filter to WhatsApp senders only (`sender_id` starts with `whatsapp:` or `properties.address` includes `whatsapp:`).
5. Pick the primary sender (first WhatsApp sender, or one matching `whatsapp_config.sender_number` if set).
6. Update `whatsapp_config.sender_number` and `last_synced_at`.
7. Return:
   ```json
   {
     "phone_number": "+14155238886",
     "status": "ONLINE",
     "sender_sid": "XEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
     "business_name": "QuickApp",
     "webhook_url": "https://.../functions/v1/whatsapp-inbound",
     "throughput": "80 messages per second",
     "last_synced_at": "2026-04-22T..."
   }
   ```

Status normalization: Twilio statuses (`ONLINE`, `OFFLINE`, `CREATING`, etc.) returned as-is; UI treats `ONLINE` / `in-use` as healthy.

`supabase/config.toml`: no entry needed — defaults to `verify_jwt = false`, but the function validates JWT in code (consistent with project patterns). No new secrets required (`TWILIO_API_KEY` and `LOVABLE_API_KEY` already configured).

### 3. Frontend — rewrite `src/pages/communication/WhatsAppConfig.tsx`

Single-page card layout, no theme/color additions, uses existing primitives only.

- React Query: `["whatsapp-config"]` → `supabase.functions.invoke("whatsapp-config", { method: "GET" })`.
- Header: title "WhatsApp Configuration", subtitle, **Refresh** button (`RefreshCw`, spins while refetching).
- Single `Card` "Sender Configuration" with read-only field rows (label left, value right, monospace where appropriate):
  - **WhatsApp Sender Number** — `whatsapp:{phone_number}`
  - **Status** — `Badge` with green dot (`bg-green-500`) when `ONLINE`, muted otherwise; existing `bg-green-100 text-green-800` token (already in palette).
  - **Business Display Name** — `business_name`
  - **Throughput** — `throughput`
  - **Webhook URL** — `webhook_url` in monospace `Input` (read-only) + small "Copy" icon button using `navigator.clipboard`.
  - **Last Synced** — relative timestamp (muted).
- Loading: `Skeleton` rows. Error: muted destructive message + retry hint.
- All fields read-only (no edit UI in this iteration).

### 4. Constraints honored

- Inbound webhook (`whatsapp-inbound`), `whatsapp-send`, `whatsapp-senders`, `whatsapp-templates` are not modified.
- No Twilio credentials in client code; gateway pattern keeps secrets server-side.
- No design-token changes.

### Files

- **DB migration:** create `whatsapp_config` table + RLS + seed row.
- **New:** `supabase/functions/whatsapp-config/index.ts`
- **Edit:** `src/pages/communication/WhatsAppConfig.tsx` — replace placeholder with real config page.

No other files modified.

