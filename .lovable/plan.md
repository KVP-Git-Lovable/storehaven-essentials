
# Sequential Task Date Calculation Across All Sections

## Problem
Currently, when a checklist is assigned to a store, each section independently resets its starting date to the checklist's Start Date. This means all sections start in parallel. However, based on the Excel template, the correct behavior is that ALL tasks across ALL sections should follow a single sequential chain -- each task's start date should be the day after the previous task's end date, regardless of section boundaries.

## Current Behavior
```text
Section 1:  Task A [Mar 1-1]   Task B [Mar 2-2]
Section 2:  Task C [Mar 1-1]   Task D [Mar 2-4]   <-- resets to Mar 1
Section 3:  Task E [Mar 1-3]                        <-- resets to Mar 1
```

## New Behavior (Sequential Chain)
```text
Section 1:  Task A [Mar 1-1]   Task B [Mar 2-2]
Section 2:  Task C [Mar 3-3]   Task D [Mar 4-6]   <-- continues from Task B
Section 3:  Task E [Mar 7-9]                        <-- continues from Task D
```

The first task starts on the Store Opening Start Date. Every subsequent task starts the day after the previous task ends.

## Changes Required

### 1. Fix Assignment Date Logic (NewStoreOpening.tsx)
**Current**: The `assignChecklistMutation` resets `currentDate` to `data.start_date` at the beginning of each section loop iteration.

**Change**: Move the `currentDate` variable outside the section loop so it carries across sections. All tasks will be chained sequentially regardless of which section they belong to.

### 2. Fix End Date Estimation in Assignment Dialog (NewStoreOpening.tsx)
**Current**: The masters query calculates `total_duration_days` as the MAX duration of any single section (parallel assumption).

**Change**: Calculate `total_duration_days` as the SUM of all task `duration_days` across all sections, since tasks now run sequentially.

### 3. Auto-Calculate Dates for Manually Added Tasks (NSOChecklistDetails.tsx)
When a user manually adds a task via the "Add Task" button, the system should auto-calculate start/end dates based on the last task in the global sequential chain. This ensures newly added tasks follow the same sequential logic.

### 4. Sync Propagation with Dates (NSOChecklistMaster.tsx)
When a new task is added to a master template and propagated to active store checklists, the synced store task should automatically receive calculated start/end dates based on the existing task chain in that store's checklist.

## Technical Details

### File: `src/pages/stores/NewStoreOpening.tsx`

**Masters query (estimated end date)** -- Change from MAX to SUM:
- Replace the parallel (MAX) duration logic with a simple SUM of all `duration_days` across all sections for each master
- This gives the correct total project timeline for the assignment dialog preview

**Assignment mutation** -- Sequential chain across sections:
- Move `let currentDate = data.start_date` before the section loop (instead of inside it)
- Remove the per-section `currentDate` reset so the date carries continuously from one section's last task to the next section's first task

### File: `src/pages/stores/NSOChecklistDetails.tsx`

**Create task mutation** -- Auto-date calculation:
- When adding a new task, find the latest `end_date` across ALL tasks in the checklist (not just the current section)
- Set the new task's `start_date` to `latestEndDate + 1 day`
- Set the new task's `end_date` to `start_date + duration - 1` (default 1 day if no duration specified)
- Keep the manual date pickers available for override, but pre-populate with calculated values

### File: `src/pages/master/NSOChecklistMaster.tsx`

**Create task sync logic** -- Date calculation for propagated tasks:
- When syncing a new task to store checklists, query existing store tasks for that checklist
- Find the latest `end_date` across all tasks
- Calculate the new task's start/end dates as: `start = latestEnd + 1`, `end = start + duration_days - 1`
- If no existing tasks, use the checklist's `start_date`

## Impact on Existing Features
- **Gantt Chart**: No changes needed -- it reads dates from the database and will display correctly
- **Task Details Dialog**: No changes needed -- shows dates from database
- **End Date Card**: No changes needed -- already calculates from the latest task `end_date`
- **Overdue Logic**: No changes needed -- still compares current date against `end_date`
- **Drag-and-drop reordering**: Existing behavior preserved (reorder does not auto-recalculate dates)
