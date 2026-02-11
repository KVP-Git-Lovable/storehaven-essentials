

# Fix NSO Checklist Details Mobile Overflow

## Problem
On the NSO Checklist Details page (`/stores/new-opening/:id`), the tab buttons ("Tasks", "Required Assets", "Budget") and the task controls row ("Checklist Tasks" title, List/Gantt toggle, Filter, Add Section) overflow outside the screen on mobile devices.

## Changes

### 1. Fix Tabs overflow (src/pages/stores/NSOChecklistDetails.tsx, ~line 785-798)
- The `TabsList` uses `grid-cols-3` which works, but the tab trigger text + icons may overflow
- Hide icons on mobile inside TabsTrigger: add `hidden sm:inline` to icon inside each TabsTrigger, or reduce icon size
- Reduce tab text size on mobile with `text-xs sm:text-sm`

### 2. Fix CardHeader controls row (lines 803-935)
- The CardHeader currently uses `flex-col` with a nested row for title + toggle and another row for filter + add
- On mobile, the title "Checklist Tasks" + List/Gantt toggle group + Filter + Add all compete for space
- Stack the controls: wrap the entire CardHeader content so on mobile, the title row and action buttons row each take full width
- Make the action buttons (`Filter` and `Add Section`) use smaller sizing on mobile
- Ensure the ToggleGroup doesn't force overflow by using compact padding

### 3. Specific fixes:
- **TabsTrigger icons**: Hide on small screens (`<sm:hidden>` on the icon) to save horizontal space
- **CardHeader**: Ensure `flex-wrap` is applied so controls wrap to next line
- **Filter button**: Already has responsive text, looks fine
- **Add Section button**: Already shows "Add" on mobile, looks fine
- **ToggleGroup**: Reduce padding further on mobile

## Technical Details

### File: `src/pages/stores/NSOChecklistDetails.tsx`

**Tab triggers (lines 786-798)**: Add `hidden sm:block` to icons inside TabsTrigger to hide them on mobile, keeping only text to fit within viewport.

**CardHeader controls (lines 803-935)**: The current layout already uses `flex-col` with `md:flex-row`. The inner rows need `flex-wrap` to prevent overflow. Add `w-full` to the action buttons container on mobile so it takes full width and wraps properly.

**ToggleGroup items (lines 812-820)**: Already have responsive sizing `h-7 md:h-8 px-2 md:px-3`. These look OK.

### No other files need changes - this is isolated to the NSOChecklistDetails page.
