

## Mobile-only refinements for Journeys & WhatsApp Templates tables

### 1. Journey Builder list table (mobile only)

Goal: shrink each row's vertical footprint. Today the Status cell stacks `status` → `Approved` → schedule badge vertically because 3 wide badges can't fit a narrow column.

Changes in `src/pages/communication/JourneyList.tsx` (rows ~683–705):

- **Status badges** (line 685 wrapper): switch from `flex-wrap` to a tight horizontal row on mobile — `flex items-center gap-1 flex-nowrap` with each badge `text-[10px] md:text-xs px-1.5 py-0 leading-tight`. The schedule badge keeps the calendar icon but truncates the text to one line (`max-w-[110px] truncate md:max-w-none`).
- **Status cell width**: add a min-width override on mobile so all three badges sit on one line: `<TableCell className="align-top">` with inner wrapper `whitespace-nowrap`.
- **Name cell** (line 683): `text-xs md:text-sm font-medium leading-tight` and remove the implicit large padding by leveraging the existing mobile `p-2` from `table.tsx`.
- **Segment cell** (line 698): on mobile, drop the inline `legacy/Customers` outline badge to a smaller chip (`text-[10px] px-1 py-0`) and clamp segment name to 2 lines (`line-clamp-2 md:line-clamp-none`).
- **Created cell** (line 705): on mobile, render a compact format `MMM d` instead of `MMM d, yyyy` using a responsive span: `<span className="md:hidden">{format(d, 'MMM d')}</span><span className="hidden md:inline">{format(d, 'MMM d, yyyy')}</span>`.
- **Row vertical padding**: tighten cells via `className="py-2 md:py-4"` on each `TableCell` in this table (override the default `p-2 md:p-4`).
- Result on 390px: each row becomes ~2 lines tall instead of ~6 — the three status pills sit horizontally, name on one/two lines.

### 2. WhatsApp Templates table (mobile only)

Goal: stop hiding all columns behind horizontal scroll. Currently the table requires a 500px min-width which forces only the Name column to be visible at 390px.

Changes in `src/pages/communication/WhatsAppTemplates.tsx`:

- **Replace the table with a card list on mobile**, keep the existing table on `md+`. Inside the existing `<Card><CardContent className="p-0">`:
  - Add `<div className="md:hidden divide-y">` rendering each template as a compact row:
    - Line 1: template name (`text-sm font-medium truncate`) on the left, status icon on the right (✓ green for `approved`, ⏱ yellow for `submitted`, ⚠ red for `rejected`, • muted for `draft`) using small Lucide icons (`CheckCircle2`, `Clock`, `XCircle`, `Circle`) with a tiny status label next to it (`text-[10px]`).
    - Line 2 (muted, `text-[11px]`): category chip + relative date `MMM d` + a `User-initiated` badge if applicable.
    - Tap area: whole row is a button → `navigate(\`/communication/templates/${t.id}\`)`. Trailing icon-only delete button (`<Trash2 className="h-3.5 w-3.5">`) with `onClick stopPropagation`.
  - Wrap the existing `<Table>` block in `<div className="hidden md:block">` so desktop is untouched.
- **Filter row spacing**: keep the recently-added `flex-wrap gap-2` and `w-[48%] sm:w-40` widths.

### Files to change

- `src/pages/communication/JourneyList.tsx` — compact status badges, smaller text, tighter cell padding, mobile date format. Mobile only (`md:` breakpoints preserve desktop).
- `src/pages/communication/WhatsAppTemplates.tsx` — render a compact mobile list with status icons and hide the full table on mobile; desktop table unchanged.

### Constraints

- Desktop layout (`md:` breakpoint and above) is byte-for-byte identical.
- No data-fetching, routing, mutation, permission or RLS changes.
- No new dependencies — uses existing Lucide icons and Tailwind utilities.

