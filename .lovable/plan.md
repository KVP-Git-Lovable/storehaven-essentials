

## Fix mobile layout & sidebar auto-close

### Issue 1 — Cramped headers on mobile (Journey Builder & WhatsApp Templates)

Both pages use `flex items-center justify-between` for the header row. On a 390px viewport the right-side action buttons (Create Journey, View Approvals / Import from Twilio, Sync, Create Template) refuse to shrink, squeezing the title + description into a thin vertical column (visible in the screenshots — "WhatsApp Templates" and the description wrapping one word per line).

**Fix**: stack the header vertically on mobile and shrink the typography.

**`src/pages/communication/JourneyList.tsx`** (around line 539):
- Header wrapper → `flex flex-col gap-3 md:flex-row md:items-center md:justify-between`
- Title `h1` → `text-lg md:text-2xl font-bold tracking-tight`
- Description `p` → `text-xs md:text-sm text-muted-foreground`
- Actions wrapper → `flex flex-wrap items-center gap-2`
- Stat cards row already uses `grid-cols-1 md:grid-cols-3`; tighten card padding on mobile (`pt-4 md:pt-6`, smaller icon container) so all 3 KPIs fit without huge whitespace.
- Reduce outer container spacing on mobile: `space-y-4 md:space-y-6`.

**`src/pages/communication/WhatsAppTemplates.tsx`** (around line 184):
- Same header treatment: `flex-col md:flex-row`, smaller title/description on mobile.
- Action buttons (`Import from Twilio`, `Sync All`, `Create Template`) → wrap with `flex-wrap`, button labels stay but parent uses `gap-2`. Optionally hide button text on `<sm` and keep just the icon for the two outline buttons (`<span className="hidden sm:inline">Import from Twilio</span>`) so the row never overflows.
- Filter row (`flex gap-3` with two 40-width selects) → `flex flex-wrap gap-2`, selects → `w-[48%] sm:w-40` so they sit side-by-side on mobile.
- Table card already scrolls horizontally inside `Table`; no change needed.

### Issue 2 — Mobile sidebar stays open after tapping a sub-menu

In `src/components/layout/AppSidebar.tsx`, every `NavLink` uses `onClick={handleNavClick}`, and `handleNavClick` only calls `onOpenChange(false)` when `useIsMobile()` is truthy. The hook returns `undefined` on first render and casts to `false`; under PWA standalone or fast taps the captured closure can read stale state. Result: the navigation fires but the Sheet never receives the close.

**Fix**: when rendering inside the mobile Sheet branch, force-close on every link tap regardless of the hook's current value.

- Replace `handleNavClick` body with an unconditional `onOpenChange(false)`. The handler is only attached to leaf `NavLink`s (parent expand buttons use `toggleMenu` instead), so closing on every leaf nav is correct on both mobile and desktop (on desktop the Sheet isn't rendered, so calling `onOpenChange(false)` is a harmless state update — `sidebarOpen` is already `false` there).
- Belt-and-braces: in the mobile Sheet branch (line 534), also pass `onInteractOutside` / rely on Radix's existing overlay click to close — already works, no change needed beyond the handler fix.

### Files to change

- `src/pages/communication/JourneyList.tsx` — responsive header, smaller mobile typography, stat-card padding.
- `src/pages/communication/WhatsAppTemplates.tsx` — responsive header, wrap action buttons, two-up filter selects on mobile.
- `src/components/layout/AppSidebar.tsx` — make `handleNavClick` always call `onOpenChange(false)`.

### Constraints

- Desktop layout untouched (`md:` breakpoint preserves current `text-2xl`, row layout, and 40-width selects).
- No behavioural change to permission filtering, approval flow, template create flow, or routing.
- No DB or edge-function changes.

