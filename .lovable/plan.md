

# Plan: Journey Builder Module under Communication Center

## Overview

Add a "Journey Builder" submenu item under the existing Communication Center sidebar group. This module provides a visual drag-and-drop canvas for creating automated messaging journeys targeting three audience segments (Customers, Prospective Customers, ESDB). Journeys consist of connected nodes (Entry, Message, Delay, Decision, Exit) stored as JSON, with a background scheduler evaluating conditions and triggering messages.

## Database Schema

### New Tables

**`journey_contacts`** — Audience database for journey targeting

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| email | text NOT NULL | |
| phone | text NOT NULL | |
| city | text | |
| date_of_birth | date | |
| last_purchase_date | timestamptz | nullable |
| segment_type | text NOT NULL | customer, prospect, esdb |
| opted_out | boolean DEFAULT false | |
| created_by | uuid FK profiles | |
| created_at / updated_at | timestamptz | |

**`journey_contact_events`** — Engagement event tracking

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| contact_id | uuid FK journey_contacts | |
| event_type | text NOT NULL | purchase, email_open, link_click, etc. |
| event_data | jsonb | |
| occurred_at | timestamptz DEFAULT now() | |

**`journeys`** — Journey definitions

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| description | text | |
| status | text DEFAULT 'draft' | draft, active, paused |
| canvas_data | jsonb NOT NULL | Full node/edge graph (React Flow format) |
| segment_type | text | Filter criteria |
| filters | jsonb | City, date ranges, etc. |
| created_by | uuid FK profiles | |
| created_at / updated_at | timestamptz | |

**`journey_enrollments`** — Contacts currently in a journey

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| journey_id | uuid FK journeys | |
| contact_id | uuid FK journey_contacts | |
| current_node_id | text | Node ID within canvas_data |
| status | text DEFAULT 'active' | active, completed, exited |
| enrolled_at | timestamptz | |
| next_action_at | timestamptz | When to evaluate next |

**`journey_message_log`** — Messages sent by journeys

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| journey_id | uuid FK journeys | |
| enrollment_id | uuid FK journey_enrollments | |
| contact_id | uuid FK journey_contacts | |
| channel | text | email, sms, push |
| template_body | text | Rendered message |
| status | text | sent, delivered, opened, clicked, failed |
| sent_at | timestamptz | |

RLS: Authenticated users can read/write all journey tables. Admin-only for delete.

### Realtime

Enable realtime on `journey_enrollments` for live dashboard updates.

## Edge Functions

**`process-journeys`** — Scheduled background processor (pg_cron every 5 min)
- Queries active journeys with enrollments where `next_action_at <= now()`
- Evaluates each enrollment's current node:
  - **Delay Node**: Advances to next node after wait period
  - **Decision Node**: Checks contact events (opened, clicked, purchased) and routes accordingly
  - **Message Node**: Sends message via appropriate channel (uses existing `whatsapp-send` for SMS, Lovable AI email for email) and advances
  - **Exit Node**: Marks enrollment as completed
- Updates `current_node_id` and `next_action_at`

**`journey-actions`** — API for journey management
- `activate`: Evaluates segment filters, enrolls matching contacts, sets initial node
- `pause`: Suspends processing
- `enroll-contacts`: Manual enrollment
- `record-event`: Records contact events (purchase, open, click)

## Frontend Pages

### 1. Journey List (`/communication/journeys`)
- Table: name, status badge (draft/active/paused), segment, contact count, created date
- Actions: Create, Activate, Pause, Delete
- Quick stats row: total active journeys, contacts enrolled, messages sent today

### 2. Journey Builder (`/communication/journeys/:id`)
- **React Flow** canvas (using `@xyflow/react` library) with custom node types:
  - **Entry Node**: Segment selector + filters (city, date range, DOB)
  - **Message Node**: Channel selector (Email/SMS/Push), template editor with `{name}`, `{last_purchase_date}` variables
  - **Delay Node**: Duration picker (X hours/days)
  - **Decision Node**: Condition selector (opened, clicked, purchased) with Yes/No branches
  - **Exit Node**: Terminal marker
- Toolbar: Add Node buttons, Save Draft, Validate, Activate
- Right panel: Node property editor (appears on node click)
- Canvas data stored as JSON in `journeys.canvas_data`

### 3. Journey Analytics (`/communication/journeys/:id/analytics`)
- Cards: Messages Sent, Open Rate, Click Rate, Conversions
- Funnel visualization showing drop-off at each node
- Timeline of recent message activity

### 4. Contacts Manager (`/communication/contacts`)
- Table of journey_contacts with segment badges
- Import CSV, manual add
- Filter by segment, city, engagement
- Opt-out toggle per contact

## Sidebar & Module Registration

Add to Communication Center children in `AppSidebar.tsx`:
```
{ title: "Journey Builder", href: "/communication/journeys", moduleKey: "communication.journeys" },
{ title: "Contacts", href: "/communication/contacts", moduleKey: "communication.contacts" },
```

Register in `modules.ts`:
- `communication.journeys` — Journey Builder
- `communication.contacts` — Contacts

Add route mappings in `routeToModuleKey`.

## Dependencies

- `@xyflow/react` — React Flow library for the drag-and-drop canvas builder

## Files to Create/Modify

| File | Action |
|---|---|
| Migration SQL | New tables + RLS + realtime |
| `supabase/functions/process-journeys/index.ts` | Background scheduler |
| `supabase/functions/journey-actions/index.ts` | Journey management API |
| `src/pages/communication/JourneyList.tsx` | Journey list page |
| `src/pages/communication/JourneyBuilder.tsx` | Visual canvas builder |
| `src/pages/communication/JourneyAnalytics.tsx` | Analytics dashboard |
| `src/pages/communication/ContactsManager.tsx` | Contact management |
| `src/components/journey/*.tsx` | Custom React Flow nodes (Entry, Message, Delay, Decision, Exit), NodePropertyPanel |
| `src/lib/modules.ts` | Add module keys |
| `src/components/layout/AppSidebar.tsx` | Add submenu items |
| `src/App.tsx` | Add lazy routes |

## Sequence

1. Install `@xyflow/react` dependency
2. Run database migration (tables, RLS, realtime)
3. Create edge functions (process-journeys, journey-actions)
4. Set up pg_cron for process-journeys
5. Build Contacts Manager page
6. Build Journey List page
7. Build Journey Builder canvas with custom nodes
8. Build Analytics dashboard
9. Wire sidebar, modules, and routes

## What Will NOT Change

No modifications to any existing features, pages, components, database tables, or edge functions outside the new Journey Builder module.

