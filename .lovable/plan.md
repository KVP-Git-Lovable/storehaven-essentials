## Fix: Mobile Sidebar Closes Instantly on Submenu Click

### Problem
On mobile, tapping a submenu (WhatsApp, Voice, Email, Journey Builder, Calendar, etc.) doesn't close the Radix `Sheet` immediately. The sidebar only closes after a second click somewhere else. The current `handleNavClick` defers the close via `requestAnimationFrame`, which still races with Radix Dialog/Sheet's focus + pointer-event handling on touch devices.

### Solution
Switch to **synchronous close on click** and rely on a **route-change effect** as a safety net. Remove all deferred (rAF/setTimeout) close logic.

### Changes (single file: `src/components/layout/AppSidebar.tsx`)

1. **Synchronous `handleNavClick`** — close the Sheet immediately during the click event (no `requestAnimationFrame`):
   ```ts
   const handleNavClick = () => {
     if (!isMobile) return;
     onOpenChange(false);
   };
   ```

2. **Same-route safety**: when the user taps a link to the page they're already on, `location.pathname` doesn't change so the route-change effect won't fire. Handle that case explicitly inside `handleNavClick` by accepting the target href and force-closing:
   ```ts
   const handleNavClick = (href?: string) => {
     if (!isMobile) return;
     onOpenChange(false); // always close synchronously
   };
   ```
   (No `popstate` dispatch needed — we already close unconditionally.)

3. **Keep the route-change effect** as backup (already present at lines 341–346) — fires when navigation actually changes the path:
   ```ts
   useEffect(() => {
     if (isMobile && open) onOpenChange(false);
   }, [location.pathname]);
   ```

4. **Remove the rAF-based deferral** currently in `handleNavClick` (lines 348–359). No `setTimeout`, no `requestAnimationFrame`.

5. **`stopPropagation` on NavLink onClick** is not needed and would block React Router navigation in some cases — we will NOT add it. Synchronous `setOpen(false)` + Radix's controlled `open` prop is sufficient; React batches the state update with the navigation, and the Sheet unmounts cleanly on next render.

6. **Modal/overlay**: No changes to the `Sheet`/`SheetContent` props. It's already controlled via `open={open} onOpenChange={onOpenChange}` (line 553).

### Files Edited
- `src/components/layout/AppSidebar.tsx` — replace `handleNavClick` body; keep existing route-change `useEffect`.

### Outcome
- Tapping any submenu on mobile closes the sidebar in the same frame as navigation.
- Tapping a link to the current route still closes the sidebar (synchronous close runs regardless of route change).
- Desktop behavior unchanged (function early-returns when `!isMobile`).
- No timing hacks remain.
