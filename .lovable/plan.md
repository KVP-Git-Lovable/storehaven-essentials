

# Mobile Responsiveness Compact Layout Fix

## Problem
On mobile devices, the app has excessive whitespace, oversized card padding, large heading fonts, and too much vertical spacing between elements. Cards like Start Date / End Date in NSO take up too much screen real estate. Buttons can overflow outside the viewport.

## Approach
Apply a **global mobile compaction pass** through CSS utilities and targeted component updates. No design changes - only tightening spacing for mobile.

## Changes

### 1. Global CSS Compaction (src/index.css)
- Reduce the `.stat-card` padding on mobile from `p-3` to `p-2` with smaller responsive steps
- Add a mobile-specific utility class `.card-compact` that reduces CardHeader/CardContent padding on small screens
- Reduce global Card component padding on mobile via CSS overrides targeting `< 768px`

### 2. Card Component (src/components/ui/card.tsx)
- Reduce `CardHeader` default padding from `p-6` to `p-3 sm:p-4 md:p-6`
- Reduce `CardContent` default padding from `p-6 pt-0` to `p-3 pt-0 sm:p-4 sm:pt-0 md:p-6 md:pt-0`
- Reduce `CardTitle` default font size from `text-2xl` to `text-lg sm:text-xl md:text-2xl`
- Reduce `CardHeader` vertical spacing from `space-y-1.5` to `space-y-1 sm:space-y-1.5`

### 3. StatCard Component (src/components/dashboard/StatCard.tsx)
- Already responsive - no changes needed (already has responsive text sizes)

### 4. Dashboard (src/pages/Dashboard.tsx)
- Already has responsive grid and spacing - no changes needed

### 5. NSO Checklist Details (src/pages/stores/NSOChecklistDetails.tsx)
- Reduce milestone card date font from `text-2xl` to `text-lg sm:text-xl md:text-2xl` for Start Date, End Date, and Progress cards
- Reduce CardHeader padding in these cards via existing responsive classes

### 6. New Store Opening listing (src/pages/stores/NewStoreOpening.tsx)
- Wrap header as `flex-col` on mobile with `gap-3`
- Make page padding responsive: `p-3 sm:p-4 md:p-6`
- Reduce spacing: `space-y-4 md:space-y-6`

### 7. Petty Cash (src/pages/PettyCash.tsx)
- Make header stack vertically on mobile: `flex-col sm:flex-row` with `gap-3`
- Button full-width on mobile
- Reduce collapsible trigger spacing on mobile
- Stack spent/available info vertically on small screens

### 8. Planograms (src/pages/vm/Planograms.tsx)
- Ensure "Add Planogram" button doesn't overflow: add `whitespace-nowrap` and responsive text truncation
- Make header responsive with column stacking

### 9. Global index.css - Additional mobile overrides
- Add rule to reduce Card component padding globally on mobile (affects all modules consistently):
  ```css
  @media (max-width: 767px) {
    .stat-card { padding: 0.5rem; }
  }
  ```

## Technical Details

### Files to modify:
1. **src/components/ui/card.tsx** - Reduce default padding and font sizes with responsive breakpoints
2. **src/index.css** - Tighten `.stat-card` mobile padding
3. **src/pages/stores/NSOChecklistDetails.tsx** - Reduce milestone card date font sizes
4. **src/pages/stores/NewStoreOpening.tsx** - Responsive header and page padding
5. **src/pages/PettyCash.tsx** - Responsive header stacking and button layout
6. **src/pages/vm/Planograms.tsx** - Prevent button overflow

### What stays unchanged:
- All desktop layouts (>= 1024px)
- Colors, typography family, component structure
- No new components or dependencies
- Existing grid stacking logic from previous responsiveness pass

