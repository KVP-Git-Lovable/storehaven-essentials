

# Plan: Restructure Communication Center — WhatsApp, Voice, Email

## Overview

Replace the four existing Communication Center sidebar items (WhatsApp Templates, Message Log, Journey Builder, Contacts) with three new items: WhatsApp, Voice, E-mail. WhatsApp becomes a hub page linking to the existing templates page plus new Senders and Config pages. Voice and Email are placeholder pages. Existing routes remain untouched.

## Changes

### 1. Sidebar Navigation
**File:** `src/components/layout/AppSidebar.tsx`

Replace the Communication Center children array with:
- "WhatsApp" → `/communication/whatsapp` (moduleKey: `communication.whatsapp`)
- "Voice" → `/communication/voice` (moduleKey: `communication.voice`)
- "E-mail" → `/communication/email` (moduleKey: `communication.email`)

Add `Phone` and `Mail` icons from lucide-react alongside the existing `MessageSquare`.

### 2. Module Definitions
**File:** `src/lib/modules.ts`

Add three new module keys: `communication.whatsapp`, `communication.voice`, `communication.email`. Keep existing keys (`communication.templates`, `communication.messages`, etc.) so existing permissions and routes remain valid.

### 3. New Pages (4 files)

- **`src/pages/communication/WhatsAppCenter.tsx`** — Hub page with title, WhatsApp logo, description, and 3 card-style buttons linking to Templates, Senders, and Configuration.

- **`src/pages/communication/WhatsAppSenders.tsx`** — Fetches senders from a new edge function. Displays table with phone number, display name, status. Loading/error states. Refresh button.

- **`src/pages/communication/WhatsAppConfig.tsx`** — Stub page with title and placeholder description.

- **`src/pages/communication/VoiceCenter.tsx`** — Placeholder with "Voice Center" title and future-phase message.

- **`src/pages/communication/EmailCenter.tsx`** — Placeholder with "Email Center" title and future-phase message.

### 4. Edge Function for WhatsApp Senders
**File:** `supabase/functions/whatsapp-senders/index.ts`

- `GET` → Calls Twilio API via the connector gateway (`https://connector-gateway.lovable.dev/twilio/IncomingPhoneNumbers.json`) to fetch phone numbers
- Filters for WhatsApp-capable senders
- Uses `LOVABLE_API_KEY` and `TWILIO_API_KEY` from env
- Returns formatted JSON array with phone number, friendly name, status
- Includes CORS headers

### 5. Routes
**File:** `src/App.tsx`

Add lazy imports and routes:
- `/communication/whatsapp` → WhatsAppCenter
- `/communication/whatsapp/senders` → WhatsAppSenders
- `/communication/whatsapp/config` → WhatsAppConfig
- `/communication/voice` → VoiceCenter
- `/communication/email` → EmailCenter

All existing communication routes (`/communication/templates`, `/communication/messages`, `/communication/journeys/*`, `/communication/contacts`) remain unchanged.

## What Will NOT Change

- Existing WhatsApp Templates, Message Log, Journey Builder, and Contacts pages and routes
- Any other sidebar menus or modules
- Database tables or RLS policies
- No existing features are modified or removed

