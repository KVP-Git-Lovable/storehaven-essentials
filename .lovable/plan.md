

# Plan: Communication Center — WhatsApp Template Management via Twilio

## Overview

Add an isolated "Communication Center" module between Security and Inventory in the sidebar. It provides a full WhatsApp template management workflow: create templates, submit to Twilio Content API, track approval status, and send test messages.

## Prerequisites

**Twilio Connector**: The project needs a Twilio connection linked. I'll use the `standard_connectors--connect` tool to prompt you to connect your Twilio account. This provides secure gateway access without exposing credentials.

## Database

Create a `whatsapp_templates` table:

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | lowercase_underscore format |
| category | text NOT NULL | UTILITY, MARKETING, AUTHENTICATION |
| language | text DEFAULT 'en' | |
| body | text NOT NULL | Supports {{1}}, {{2}} variables |
| twilio_content_sid | text | Set after Twilio submission |
| status | text DEFAULT 'draft' | draft, submitted, approved, rejected |
| rejection_reason | text | |
| created_by | uuid FK profiles | |
| created_at, updated_at | timestamptz | |

Also create `whatsapp_message_log` for test message history:

| Column | Type |
|---|---|
| id | uuid PK |
| template_id | uuid FK |
| to_number | text |
| twilio_message_sid | text |
| status | text |
| sent_at | timestamptz |
| sent_by | uuid FK |

RLS policies will restrict access to authenticated users with the `communication` module permission.

## Edge Functions

**1. `whatsapp-templates`** — CRUD + Twilio Content API integration
- `POST /` — Create template locally (draft) and submit to Twilio Content API via gateway
- `GET /` — List all templates with optional status/category filters
- `GET /:id` — Single template detail
- `POST /refresh-status` — Fetch status from Twilio and update locally
- `POST /bulk-sync` — Refresh all non-final statuses

**2. `whatsapp-send`** — Send test messages
- Validates template is approved
- Sends via Twilio Messages API through connector gateway
- Logs to `whatsapp_message_log`

All functions use the Twilio connector gateway (`https://connector-gateway.lovable.dev/twilio/...`) with `LOVABLE_API_KEY` and `TWILIO_API_KEY` headers.

## Frontend Pages

**1. Template List** (`/communication/templates`)
- Table with name, category, status badge (color-coded), updated timestamp
- "Create Template" button opens form dialog
- Per-row actions: View, Refresh Status, Send Test (if approved)
- Bulk "Sync All Statuses" button

**2. Template Detail** (`/communication/templates/:id`)
- Full body preview with variable highlighting
- Twilio Content SID display
- Rejection reason alert (if rejected)
- Refresh Status and Send Test buttons

**3. Create/Edit Form Dialog**
- Template name (validated: lowercase + underscores only)
- Category dropdown
- Language selector
- Body textarea with variable helper (insert {{1}}, {{2}}, etc.)

**4. Send Test Dialog**
- Phone number input (E.164 format)
- Variable values form (dynamically generated from template body)
- Send button with confirmation

## Sidebar & Module Registration

Add to `navigation` array in `AppSidebar.tsx` between Security and Inventory:
```
{
  title: "Communication Center",
  icon: MessageSquare,  // from lucide-react
  moduleKey: "communication",
  children: [
    { title: "WhatsApp Templates", href: "/communication/templates", moduleKey: "communication.templates" },
    { title: "Message Log", href: "/communication/messages", moduleKey: "communication.messages" },
  ],
}
```

Register in `modules.ts`:
- `communication` — Communication Center
- `communication.templates` — WhatsApp Templates
- `communication.messages` — Message Log

Add lazy routes in `App.tsx`.

## Files to Create/Modify

| File | Action |
|---|---|
| `supabase/migrations/...` | New tables + RLS |
| `supabase/functions/whatsapp-templates/index.ts` | Template CRUD + Twilio sync |
| `supabase/functions/whatsapp-send/index.ts` | Send test messages |
| `src/pages/communication/WhatsAppTemplates.tsx` | List page |
| `src/pages/communication/WhatsAppTemplateDetails.tsx` | Detail page |
| `src/pages/communication/MessageLog.tsx` | Message history |
| `src/components/layout/AppSidebar.tsx` | Add nav item |
| `src/lib/modules.ts` | Register module keys |
| `src/App.tsx` | Add lazy routes |

## Sequence

1. Connect Twilio connector
2. Run database migration
3. Create edge functions
4. Build frontend pages
5. Wire sidebar and routes

