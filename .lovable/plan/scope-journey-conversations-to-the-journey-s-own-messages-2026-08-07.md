# Scope Journey Conversations to the journey's own messages

## What's wrong

On the Journey Conversations page, the message thread and the per-participant
summary (last message, Replied / Read / Unread flags) are built by querying the
`whatsapp_messages` table **by phone number only** — with no journey filter and
no time window. WhatsApp messages are not tagged with a journey, so every
message ever exchanged with that phone number is pulled in.

That is why Radhika Sheth's 26 Jun 2026 message from an earlier journey shows up
inside "Trayi-Shravan offer-1" (created 07 Aug 2026), and why she is counted as
having replied to this journey.

## Fix

Scope every participant's conversation to the period in which they were part of
*this* journey.

For each participant, compute a cutoff timestamp:
1. Earliest `sent_at` in `journey_message_log` for this journey + contact (the
   journey's first message to them) — the accurate value; otherwise
2. The enrollment's `enrolled_at` as a fallback when nothing was sent yet.

Then:
- Thread view: only show messages created at or after that participant's cutoff.
- Participant list: compute last message, Replied, Read and Unread counts from
  the same cutoff-filtered set, so the filter chips (Replied / Not Replied /
  Read / Unread) reflect this journey only.
- Participants with no messages in the window show an empty thread and no
  "replied" state instead of borrowing history from a previous journey.

An empty-state line in the thread panel: "No messages exchanged in this journey
yet."

## Technical notes

- File: `src/pages/communication/JourneyConversations.tsx` only. No schema
  change, no backend change.
- Add a query over `journey_message_log` filtered by `journey_id`, selecting
  `contact_id, sent_at`, paginated the same way the existing queries are, and
  reduced to a `Map<contact_id, earliest sent_at>`.
- Build a `Map<phoneL10, cutoffISO>` from that map plus enrollment fallback, and
  apply it in the `phoneStats` aggregation and in the selected-participant
  `thread` query (client-side filter after fetch, or as a `.gte("created_at", …)`
  on the thread query for the selected phone).
- Include the cutoff in the thread query key so switching participants refetches
  correctly.
- Journey funnel, analytics counts, failure pages and retry logic are untouched.
