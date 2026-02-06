
# Add "From Store Buildup Date" Field to NSO Master Tasks

## Overview
Introduce a new field called **"From Store Buildup Date"** (number of days offset) on each task in the NSO Checklist Master. This changes the task scheduling model from a purely sequential chain to an **offset-based model**, where each task's start date is independently calculated relative to the Store Buildup Date.

## How It Works Today
- Tasks in the master template only have `duration_days`
- When assigned to a store, tasks are chained sequentially: Task 1 starts on the Store Buildup Date, Task 2 starts the day after Task 1 ends, and so on
- Users have no control over individual task start offsets

## How It Will Work After This Change
- Each master task gets a new field: **From Store Buildup Date** (number of days, default 0)
- **Task Start Date** = Store Buildup Date + From Store Buildup Date
- **Task End Date** = Task Start Date + Duration Days - 1
- Users enter the offset and duration; dates are never manually picked
- Tasks can overlap, run in parallel, or have gaps -- giving full scheduling flexibility
- The existing sequential chain during assignment (`NewStoreOpening.tsx`) will be updated to use the new offset-based calculation

## Changes Required

### 1. Database Migration
Add a new column to the `nso_master_tasks` table:
```text
from_buildup_days INTEGER NOT NULL DEFAULT 0
```
This stores the number of days from the store buildup (start) date at which this task should begin.

### 2. NSO Checklist Master -- Task Form (NSOChecklistMaster.tsx)
- Add `from_buildup_days` to the `taskForm` state (default: 0)
- Add a new input field in the Task Dialog: "From Store Buildup Date (Days)" with a helper text explaining it
- Display the new column in the task table (alongside Duration)
- Include `from_buildup_days` in create, update, and duplicate mutations
- Update the `MasterTask` interface to include the new field
- Update `resetTaskForm` to reset the new field
- Update `handleEditTask` to populate the new field

### 3. Store Assignment Logic (NewStoreOpening.tsx)
Update the task date calculation during checklist assignment:
- **Before**: Sequential chaining (`currentDate = addDays(previousEndDate, 1)`)
- **After**: Offset-based (`startDate = addDays(storeBuildupDate, task.from_buildup_days)`, `endDate = addDays(startDate, task.duration_days - 1)`)
- The `from_buildup_days` value will need to be fetched from master tasks (it is already fetched via `select("*")`)

### 4. Sync Logic (NSOChecklistMaster.tsx -- createTaskMutation)
When a new master task is added and synced to existing store checklists, the date calculation will also use the offset-based approach:
- Fetch the store checklist's `start_date`
- Calculate: `startDate = addDays(checklistStartDate, from_buildup_days)`
- Calculate: `endDate = addDays(startDate, duration_days - 1)`

### 5. Duplicate Logic (NSOChecklistMaster.tsx -- duplicateMasterMutation)
Include `from_buildup_days` when copying tasks during template duplication.

## Files to Modify
1. **Database**: Add `from_buildup_days` column via migration to `nso_master_tasks`
2. **`src/pages/master/NSOChecklistMaster.tsx`**: Update task form, table display, interfaces, and all task-related mutations
3. **`src/pages/stores/NewStoreOpening.tsx`**: Update assignment date calculation from sequential to offset-based

## Files NOT Modified
- `src/pages/stores/NSOChecklistDetails.tsx` -- Store-level task view/edit (works with `start_date`/`end_date` already stored on `nso_store_tasks`)
- `src/integrations/supabase/types.ts` -- Auto-generated, never edited manually

## Data Integrity
- The `from_buildup_days` column defaults to 0, so existing master tasks remain valid (they would all start on Day 0 by default)
- Existing store tasks already have concrete `start_date`/`end_date` values stored in `nso_store_tasks`, so they are unaffected
- The Gantt chart and filters in the store checklist details continue to work as before since they read from `nso_store_tasks.start_date`/`end_date`
