# Journey WhatsApp Conversations View

Add a per-journey conversation inspector reachable from Journey Analytics, reusing the look and feel of `/communication/whatsapp/conversations` but scoped strictly to participants of the current journey.

## 1. Entry point on Journey Analytics

In `src/pages/communication/JourneyAnalytics.tsx`, add a new button **"View WhatsApp Conversations"** next to the existing **Export** dropdown in the header toolbar (line ~226). Icon: `MessageSquare` / `WhatsAppIcon`. Clicking navigates to `/communication/journeys/:id/conversations`. No other analytics code or layout is touched.

## 2. New route & page

- Register a new route in `src/App.tsx` under the protected block: `/communication/journeys/:id/conversations` → `JourneyConversations`.
- Create `src/pages/communication/JourneyConversations.tsx` — a new page modeled on `WhatsAppConversations.tsx`, but every query is filtered to the current journey:
  - **Participant list (left panel)** sourced from `journey_contacts` joined with `journey_enrollments` for this `journey_id`. For each contact show: name, phone, last message preview, last activity time, and unread indicator (derived from latest inbound `whatsapp_messages` after latest outbound).
  - **Thread (center panel)** loads from `whatsapp_messages` matched by last-10-digit phone of the selected participant (same matching scheme already used in `useJourneyAnalytics`). Renders the same bubble UI, day separators, and time formatting as `WhatsAppConversations`.
  - **Journey context (right panel / participant header)**: journey name, journey status, enrollment `created_at` (Date Entered), current `node_id` from latest `journey_message_log` row, enrollment status (Active / Completed / Exited).

## 3. Filters & search

Above the participant list:
- Search by name or phone (debounced).
- Filter chips: Replied, Not Replied, Active, Completed, Opted Out, Read, Unread. Each chip applies an in-memory predicate over the loaded participants using fields already available (`opted_out`, enrollment.status, inbound-message presence, unread flag).

## 4. Data scope & performance

- All queries `.eq("journey_id", id)`; no global conversations leak in.
- Participant list paginated 50 at a time (range query on `journey_contacts`).
- Thread loaded only on selection, cached per participant via React Query.
- Realtime: subscribe to `whatsapp_messages` INSERT and invalidate only the selected participant's thread + the participant list's "last activity" query.

## 5. Reuse, not duplication

- Reuse `WhatsAppIcon`, message bubble markup, `initials`, `formatBubbleTime`, `formatDayLabel` by extracting them from `WhatsAppConversations.tsx` into a small shared module `src/components/communication/conversationHelpers.tsx` (pure helpers + tiny presentational `MessageBubble`). `WhatsAppConversations.tsx` continues to import and render them — no behavior change.
- No edits to `useJourneyAnalytics`, the journey schema, or the existing conversations page beyond this extract-and-reimport refactor.

## Technical notes

- Files created: `src/pages/communication/JourneyConversations.tsx`, `src/components/communication/conversationHelpers.tsx`.
- Files edited: `src/pages/communication/JourneyAnalytics.tsx` (button only), `src/App.tsx` (route only), `src/pages/communication/WhatsAppConversations.tsx` (imports moved to shared helper).
- No DB migrations. No edge function changes. No changes to existing routes.

```text
[Journey Analytics page]
   header toolbar: [Range] [Export ▾] [View WhatsApp Conversations] ← new
                                                    │
                                                    ▼
        /communication/journeys/:id/conversations
   ┌──────────────┬──────────────────────┬──────────────────┐
   │ Participants │ Conversation thread  │ Journey context  │
   │ + filters    │ (reused bubble UI)   │ + enrollment     │
   └──────────────┴──────────────────────┴──────────────────┘
```
