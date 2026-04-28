Plan to fix the mobile sidebar click behavior

I checked the current sidebar and compared it with [Staging - Quickapp](/projects/b8852e08-a40a-4eb2-aee8-025d6468b172). The main difference is that the working project closes the Sheet using one simple controlled state handler directly on every navigation item. The current project has a more complex sidebar with nested menus and a custom Sheet wrapper, so I will make the close behavior deterministic at the sidebar level instead of relying on Radix focus behavior.

What I will change

1. Make mobile close immediate and centralized
- Update `src/components/layout/AppSidebar.tsx` so every actual route click calls one dedicated close handler.
- Use the same simple pattern as the reference project: `onOpenChange(false)` directly from the click handler.
- Keep desktop behavior unchanged.

2. Close from the earliest reliable mobile event
- Add close handling to navigation links in a way that fires immediately on mobile tap, before Radix Sheet focus/propagation timing can delay it.
- Apply this to:
  - top-level direct menu items
  - submenu route links like WhatsApp, Voice, E-mail, Journey Builder, Calendar
  - nested admin subsection links
  - collapsed/mobile route links, if rendered

3. Handle same-route clicks
- If the user taps the menu item for the current route, close the Sheet anyway.
- If needed, dispatch the same-route navigation refresh event requested earlier so the UI responds even when `location.pathname` does not change.

4. Keep route-change close as backup
- Preserve the existing `useEffect` route-change close fallback.
- This ensures the sidebar also closes after programmatic navigation or browser navigation on mobile.

5. Remove fragile close hacks
- Do not use `setTimeout` or delayed close logic.
- Do not depend on clicking outside the sidebar.
- Avoid changing desktop collapse behavior.

6. Align Sheet content with the working project where safe
- Review the custom `SheetContent` wrapper interaction with the sidebar.
- If the wrapper’s internal scroll container is contributing to delayed clicks, adjust only the sidebar usage so mobile nav taps are not trapped by the Sheet/ScrollArea structure.

Expected result

- In mobile preview, tapping any actual menu/submenu route closes the sidebar immediately.
- Communication Center submenu items such as WhatsApp, Voice, E-mail, Journey Builder, and Calendar close smoothly on the first tap.
- Same-route taps also close the sidebar.
- Desktop behavior remains unchanged.