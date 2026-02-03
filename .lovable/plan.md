
## Goal
1) Remove “Baseline Photo” from Mark Attendance modal and ensure baseline/reference photo is never shown in the UI (still used internally for face verification).
2) Ensure every Check In / Check Out instantly appears in **Live Attendance → Attendance Records** with the columns: user, date, in/out time, photo, location, verification status.
3) Fix the “Coming soon – Contract details view will be available soon” toast when clicking a Service Contract card, so it opens the Service Contract Details page.

---

## What I’m seeing (from your screenshot) and likely cause
Your screenshot shows a **toast** saying:
- Title: “Coming soon”
- Description: “Contract details view will be available soon”

That message does **not** exist in the current Service Contracts code we inspected. This strongly indicates one of these is happening:
1) You are testing the **Published** site which still has the older build (not updated with the new details page navigation), or
2) The browser is serving an older cached bundle.

So the “fix” is a combination of:
- making the navigation more robust (code-side), and
- ensuring the environment you are testing is actually running the updated build (process-side).

---

## Implementation plan

### A) Service Contracts: ensure click always navigates (and never shows “Coming soon”)
1) **Centralize click handler** in `src/pages/services/ServiceContracts.tsx`:
   - Create `handleOpenContract(contractId)` and call `navigate(/services/contracts/:id)` inside `try/catch`.
   - If something fails, show a clear error toast (“Failed to open contract”) instead of “Coming soon”.
   - Add a small `console.log` marker (temporary) so we can confirm the correct bundle is running when you click.

2) **Optional but recommended safety net**:
   - Add a global `window.unhandledrejection` listener in `src/App.tsx` that shows a friendly toast if any async error slips through. This prevents “white screen” situations and gives us actionable logs. (This does not change your backend logic.)

3) **User-side validation step (very important)**:
   - Verify whether you are testing **Preview URL** or **Published URL**.
   - If you are on the **Published URL**, you must publish the latest changes for the details page click to work there.
   - If on Preview and still seeing old behavior: do a hard refresh (Ctrl+Shift+R) and/or open in an incognito window.

Expected result: Clicking a contract card opens `/services/contracts/:id` and loads the new details page.

---

### B) Attendance: keep baseline hidden everywhere, but still used internally
You already have baseline usage internally (for face verification), and we will ensure:
1) **No baseline/reference photo is rendered** in:
   - Mark Attendance modal
   - Any verification UI
   - Attendance Records list

2) Ensure only “Captured Photo” preview shows in the modal.

Expected result: baseline photo is never displayed to users, but face verification continues to use it behind the scenes.

---

### C) Attendance Records “sync instantly” (UI-only)
Right now, the table is query-driven and refreshed via React Query invalidation. We will make it feel instantaneous and match your exact display requirements:

1) **Instant update after Check In / Check Out**
   - On success, do both:
     - `queryClient.invalidateQueries(...)` (server truth)
     - AND an **optimistic update** via `queryClient.setQueryData(...)` so the record appears immediately without waiting for refetch latency.
   - This is UI-only; it does not change how records are stored or verified.

2) **Table columns and data mapping**
   Update “Live Attendance → Attendance Records” to show exactly:
   - **User**
   - **Date**
   - **Check In time**
   - **Check Out time**
   - **Photo** (to meet the requirement cleanly, we will show both):
     - Check-in photo thumbnail
     - Check-out photo thumbnail (if present)
   - **Location**
     - Show check-in location text if available; show check-out location text if check-out selected and present; otherwise “-”
     - Keep it readable (truncate + hover tooltip if long)
   - **Verification status**
     - Continue using `FaceVerificationBadge` with status + score

3) **No verification logic changes**
   - We will not modify the `verifyFace` invocation, thresholds, or “block” behavior.
   - Only UI presentation and React Query cache updates.

Expected result: as soon as you check in/out, the row updates in the records table immediately and shows the required fields.

---

## Files that will be changed
1) `src/pages/services/ServiceContracts.tsx`
   - Add robust click handler + remove any possibility of a “Coming soon” fallback
2) `src/App.tsx`
   - (Optional) add global unhandled rejection toast safety net
3) `src/pages/staff/Attendance.tsx`
   - Optimistic UI update on check-in/out
   - Ensure records table includes both in/out photos + locations
   - Ensure baseline photo is never rendered in the UI

No backend logic changes, no verification logic changes, no database changes.

---

## Testing checklist (what you should verify)
1) Service Contracts
   - Click a contract card → it opens the details page (no “Coming soon” toast)
   - Refresh the details page directly via URL → it loads
2) Attendance
   - Open Mark Attendance modal → baseline photo never appears
   - Check In → record appears instantly in Attendance Records with photo/location/verification
   - Check Out → check-out time/photo/location appear instantly on the same record
3) Verify on both Desktop and Mobile layout (table responsiveness)

---

## If you’re seeing the issue only on the Published site
After I implement the fixes, you’ll need to publish to push them to the live URL. Otherwise, the published site will keep showing the old “Coming soon” behavior even though preview is fixed.
