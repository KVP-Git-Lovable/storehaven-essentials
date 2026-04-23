

## Color-code calendar journey cards by readiness

Apply per-journey color theming on the Communication Calendar so users can instantly see which journeys are ready to run vs. need attention.

### Readiness rule

A journey is **Ready (green)** when:
- `journeys.approval_status === "approved"` AND
- `journeys.status === "active"`

Otherwise → **Attention (yellow)**, including when `approval_status` is missing/undefined.

Note: the calendar query already filters `status = "active"`, so in practice the discriminator is `approval_status`. The check still includes `status === "active"` so the rule is correct if that filter ever changes.

### Color tokens (applied per card, not per date cell)

- Ready: bg `#DCFCE7`, border `#22C55E`
- Attention: bg `#FEF9C3`, border `#EAB308`
- Text stays default foreground for readability (both backgrounds are light, contrast remains AA-compliant).

Implemented via inline `style={{ backgroundColor, borderColor }}` so we don't need to extend the Tailwind theme.

### Where the colors apply

1. **Date-cell chips** (`renderChip` in `CommunicationCalendar.tsx`)
   - Replace the channel-tinted chip background with the readiness color, keeping the channel icon (WhatsApp logo / Mail / Phone) and text intact.
   - Border 1px in the matching readiness color so the card edge reads as a status pill.

2. **Inline expanded panel cards** (`CalendarDayDetails.tsx`)
   - Each `<Card>` for a journey gets the readiness background + border.
   - Channel badges, status badges, and media thumbnail remain unchanged.

3. **"+N more" Popover items** — same chip styling reused via `renderChip`, so no extra change needed.

### Data plumbing

Both the chip and the expanded card need to know readiness. Currently the calendar fetches `id, name, status, canvas_data, schedule`. Add `approval_status` to the select.

Carry the flag through:
- `CalEvent` interface gains `is_ready: boolean`.
- `DayEvent` interface (in `CalendarDayDetails.tsx`) gains `is_ready: boolean`.
- Compute `is_ready = j.approval_status === "approved" && j.status === "active"` once per journey in the `allEvents` builder, then propagate to every event/chip.

### Files to change

- `src/pages/communication/CommunicationCalendar.tsx`
  - Add `approval_status` to the journeys select.
  - Add `is_ready` to `CalEvent` and propagate.
  - In `renderChip`, swap channel-background classes for inline readiness colors (keep icon/label/text classes).
- `src/components/communication/CalendarDayDetails.tsx`
  - Add `is_ready` to the exported `DayEvent` type.
  - Apply readiness `style` (bg + border) to each journey `<Card>`.

### Constraints honored

- Calendar grid structure, IST handling, filters, expansion, and the schedule fetch logic are untouched.
- Only visual styling logic changes; channel chip icons and labels stay the same.
- Fallback to yellow when `approval_status` is missing/undefined is built into the boolean check.

