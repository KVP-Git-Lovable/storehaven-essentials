## Plan

1. **Fix the scrollbar target mismatch**
   - The top scrollbar currently measures/syncs against the outer scroll container, which can under-report usable scroll width in this table layout.
   - Update it to measure the actual inner table/content width while still scrolling the same container as the working bottom scrollbar.

2. **Make top scrollbar movement proportional and robust**
   - Instead of copying `scrollLeft` directly only when both scroll areas have identical scroll ranges, sync based on scroll percentage.
   - This will make the top scrollbar behave like the bottom scrollbar even if its internal spacer width or visible width differs by a few pixels.

3. **Stabilize updates after data/table render**
   - Recalculate widths after table content changes, resize events, and mutations.
   - Keep the top scrollbar thumb width aligned to the real scrollable range of the Inventory Items table.

4. **Verify behavior**
   - Open `/inventory/items` and confirm dragging the top scrollbar reveals right-side columns just like the bottom scrollbar.
   - Confirm bottom scrollbar still works and both remain synchronized.