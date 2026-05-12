# Bring WhatsApp Center to parity with Store Ops App

## Findings

I compared this project to `Store Ops App` (project `39a77380-...`). The pages and edge functions for WhatsApp templates, conversations, and configuration are already in place here and effectively match the source — including the WhatsApp "From" sender number flow in `whatsapp-config` (Twilio Senders → IncomingPhoneNumbers fallback) and the editable sender number on the Configuration screen.

The only piece missing is the **Twilio Wallet Balance** card that appears on the WhatsApp Center landing screen in the source project. That requires a small backend (cached balance endpoint), a UI component, and a place to store the cache.

## Changes

### 1. Database — add `app_cache` table
A simple key/value cache table used by the balance endpoint to throttle Twilio calls (3-minute TTL).

Columns: `key` (PK, text), `value` (jsonb), `expires_at` (timestamptz), `updated_at` (timestamptz).

RLS enabled; no public policies (only the service role / edge function reads & writes it).

### 2. New edge function — `supabase/functions/twilio-balance/index.ts`
Mirrors the source project. Calls Twilio `/Balance.json` through the Lovable connector gateway using `LOVABLE_API_KEY` + `TWILIO_API_KEY` (both already configured), caches the result in `app_cache` for 180s, and supports `?force=1` to bypass the cache. Returns `{ balance, currency, account_sid, fetched_at, cached }`.

### 3. New component — `src/components/communication/WalletBalanceCard.tsx`
Card with a wallet icon, formatted balance + currency, "Updated …" timestamp, and a refresh button. Uses React Query (`twilio-balance` key) and calls the edge function via `supabase.functions.invoke`.

### 4. Update — `src/pages/communication/WhatsAppCenter.tsx`
Render `<WalletBalanceCard />` between the page header and the three tiles (Templates / Conversations / View Configuration), exactly as in the source project.

### Out of scope (already aligned, no changes)
- `WhatsAppConfig.tsx` — sender number input, save button, status, webhook URL, last synced (already matches).
- `WhatsAppTemplates.tsx`, `WhatsAppTemplateDetails.tsx`, `WhatsAppConversations.tsx` — already present and aligned.
- `whatsapp-config` edge function — already returns the same shape and uses the same Twilio fallback logic.

## Technical notes

- No changes will be made in the `Store Ops App` project.
- No edits to unrelated files.
- Uses existing secrets (`LOVABLE_API_KEY`, `TWILIO_API_KEY`) — no new secrets needed.
