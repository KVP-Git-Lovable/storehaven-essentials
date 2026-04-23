
## Fix WhatsApp brand icon rendering in Communication Calendar

Update the calendar channel rendering so WhatsApp template journeys use the same brand logo shown on the WhatsApp page, instead of falling back to the generic message icon.

### Root cause

The calendar currently treats only `channel === "whatsapp"` as WhatsApp for icon rendering. But journey message nodes store WhatsApp journeys as `channel === "whatsapp_template"`. Because of that mismatch:

- label/style falls back to the WhatsApp chip style
- icon logic does not recognize it as WhatsApp
- the generic `MessageSquare` icon is rendered instead of the brand logo

### What to change

#### 1. Normalize WhatsApp channel detection
In both calendar views, treat these values as WhatsApp:
- `whatsapp`
- `whatsapp_template`

Add a small shared helper in each file, or normalize the derived channel value before rendering:
- `isWhatsAppChannel(channel)`
- optionally map `whatsapp_template -> whatsapp` for display logic

#### 2. Update date-cell chips in `CommunicationCalendar.tsx`
Adjust `renderChip()` so the logo appears whenever the event channel is WhatsApp, including template-based WhatsApp journeys.

Current logic to replace:
- `const isWhatsApp = e.channel === "whatsapp"`

New behavior:
- `const isWhatsApp = isWhatsAppChannel(e.channel)`

Also ensure the channel style lookup resolves cleanly for `whatsapp_template`, so the badge still uses the green WhatsApp chip styling and “WhatsApp” label.

#### 3. Update inline expanded cards in `CalendarDayDetails.tsx`
Apply the same normalization for the channel badges inside the expanded day panel.

Current logic to replace:
- `const isWhatsApp = ch === "whatsapp"`

New behavior:
- treat both `whatsapp` and `whatsapp_template` as WhatsApp
- render `<WhatsAppIcon />` for both

#### 4. Keep branding consistent with `/communication/whatsapp`
Continue using the existing `WhatsAppIcon` component, since it already imports the same `@/assets/whatsapp-logo.png` used by the WhatsApp page header.

No asset changes are needed unless testing shows the PNG itself is not loading.

### Files to update

- `src/pages/communication/CommunicationCalendar.tsx`
  - normalize channel aliasing for chip icon + style rendering
- `src/components/communication/CalendarDayDetails.tsx`
  - normalize channel aliasing for inline badge icon + style rendering

### Suggested implementation shape

Use a tiny helper like:

```ts
function isWhatsAppChannel(channel?: string) {
  return ["whatsapp", "whatsapp_template"].includes((channel || "").toLowerCase());
}

function getDisplayChannel(channel?: string) {
  return isWhatsAppChannel(channel) ? "whatsapp" : (channel || "").toLowerCase();
}
```

Then:
- use `getDisplayChannel()` for `CHANNEL_STYLES`
- use `isWhatsAppChannel()` for choosing between `<WhatsAppIcon />` and the Lucide icon

### Expected result

After this change:
- date-cell chips on `/communication/calendar` will show the branded WhatsApp logo
- inline expanded cards will also show the branded WhatsApp logo
- the text label will still read “WhatsApp”
- SMS/Email/Voice chips remain unchanged

### Validation

Verify on calendar entries where the underlying node channel is `whatsapp_template`:
- small chip inside date cell shows brand WhatsApp logo
- expanded card badge shows brand WhatsApp logo
- no generic messagebox icon appears next to “WhatsApp”
