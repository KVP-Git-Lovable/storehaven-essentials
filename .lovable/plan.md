

# Store Maintenance Task Roster & Day Planner

## What We're Building

A **Daily Roster** system for Store Maintenance Tasks that lets managers:
1. **Assign employees (owners) to task instances** — linking real employees to each task for the day
2. **View a Day Plan** — a clear, shift-wise timeline showing who does what and when
3. **Manage the roster** — drag or pick employees into task slots by role/department

## Current State

- `task_instances` has `assigned_to` (text field) and `role_id` (links to `role_master` with shift info)
- `employees` table has `name`, `department`, `position`, `store_id`, `status`
- `role_master` has `name`, `shift_type` (morning/afternoon/evening/night)
- `departments` table exists with `name`, `description`, `status`
- No formal "roster" or employee-to-task-instance assignment table exists yet

## Plan

### 1. Database Changes

**New table: `daily_rosters`**
- `id`, `store_id` (FK stores), `roster_date` (date), `employee_id` (FK employees), `role_id` (FK role_master), `shift_type`, `notes`, `created_by`, `created_at`
- Unique constraint on (store_id, roster_date, employee_id) — one slot per employee per day
- RLS policies for authenticated users

**Alter `task_instances`**
- Add `assigned_employee_id` (uuid, FK employees, nullable) — links a real employee as the task owner instead of free-text `assigned_to`

### 2. Task Adherence Page Enhancements

**Roster Sidebar / Tab**
- Add a "Roster" tab alongside the existing task list view
- Shows a **shift-grouped roster panel**: employees assigned to each shift for the selected store + date
- Manager can add employees to the roster from a dropdown (filtered by store, department, active status)

**Day Planner View**
- New toggle: "Day Plan" view (alongside existing list)
- Visual **timeline grouped by shift** (Morning → Afternoon → Evening → Night)
- Each shift block shows: assigned employees, their tasks sorted by scheduled_time, status badges, checklist progress
- Clear swim-lane layout: Employee name on the left, their tasks as cards on the right with time slots

**Task Owner Assignment**
- In the task detail dialog and task table, show "Owner" column
- Click to assign an employee from the day's roster (dropdown of rostered employees for that store/date)
- Auto-suggest: if a task's `role_id` matches a rostered employee's role, highlight them

### 3. Roster Management UI

- A "Manage Roster" button on the Task Adherence page
- Opens a dialog/sheet where the manager:
  - Sees all active employees for the selected store
  - Assigns each to a shift/role for the day
  - Can copy previous day's roster as a template
- Quick filters by department and role

### 4. Files to Create/Modify

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/components/operations/DailyRosterPanel.tsx` | Roster management sidebar/dialog |
| Create | `src/components/operations/DayPlannerView.tsx` | Shift-wise timeline day plan |
| Create | `src/components/operations/RosterEmployeeCard.tsx` | Employee card within roster |
| Edit | `src/pages/operations/TaskAdherence.tsx` | Add roster tab, day planner toggle, owner column |
| Edit | `src/components/operations/TaskInstanceDetailDialog.tsx` | Add owner assignment dropdown |
| Migration | New migration | Create `daily_rosters` table, add `assigned_employee_id` to `task_instances` |

### 5. How It Works End-to-End

1. Manager opens **Task Adherence**, selects store + date
2. Clicks **"Manage Roster"** → assigns employees to shifts from the employee list
3. Switches to **"Day Plan"** view → sees a clean shift-by-shift timeline
4. Each task shows its assigned owner; clicking a task opens the detail dialog with checklist
5. Manager can assign/reassign owners from the rostered employees
6. Employees see only their tasks when they log in (filtered by `assigned_employee_id`)

