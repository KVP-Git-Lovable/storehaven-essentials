

# Compliance Tasks Enhancement Plan

## Overview

This plan enhances the Visual Merchandising Compliance Tasks module with the following improvements:
1. Add "Daily" frequency option
2. Enable multi-store assignment (create tasks for multiple stores at once)
3. Auto-generate recurring tasks when a task is completed or past due
4. Add user lookup for "Assigned To" field (instead of free text)
5. Implement click-to-view/edit/delete functionality on table rows

---

## Current State

**Database Schema (`vm_compliance_tasks`):**
- `id`, `planogram_id`, `store_id`, `title`, `description`
- `frequency` (text, default: 'one-time')
- `due_date`, `status`, `assigned_to` (free text), `created_at`, `updated_at`

**Current Limitations:**
- `assigned_to` is a free text field, not linked to users
- `store_id` is a single UUID, no multi-store support
- No "Daily" frequency option
- No auto-recurrence logic
- Table rows are read-only (no click-to-edit)

---

## Implementation Details

### 1. Database Changes

**Migration 1: Add columns and update schema**

```text
-- Add assigned_to_user_id (UUID) to link to profiles table
ALTER TABLE vm_compliance_tasks 
  ADD COLUMN assigned_to_user_id UUID REFERENCES profiles(id);

-- Add parent_task_id for recurring task chain tracking
ALTER TABLE vm_compliance_tasks 
  ADD COLUMN parent_task_id UUID REFERENCES vm_compliance_tasks(id);

-- Add is_recurring flag for easy filtering
ALTER TABLE vm_compliance_tasks 
  ADD COLUMN is_recurring BOOLEAN DEFAULT false;
```

**RLS Policy:** Existing policies will apply; no changes needed since we're adding nullable columns.

---

### 2. Add "Daily" Frequency Option

**File:** `src/pages/vm/ComplianceTasks.tsx`

Update the frequency options array:
```typescript
const frequencyOptions = [
  { value: "daily", label: "Daily" },      // NEW
  { value: "one-time", label: "One-time" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
```

---

### 3. Multi-Store Assignment

**Approach:** When creating a task, allow selecting multiple stores. On form submission, create one task per store (bulk insert).

**UI Changes:**
- Replace single `Select` component for store with `MultiSelectCombobox`
- Update form schema: `storeIds: z.array(z.string()).min(1, "At least one store is required")`

**Submission Logic:**
```typescript
const tasksToInsert = data.storeIds.map(storeId => ({
  planogram_id: data.planogramId,
  store_id: storeId,
  title: data.title,
  description: data.description || null,
  frequency: data.frequency,
  due_date: new Date(data.dueDate).toISOString(),
  assigned_to_user_id: data.assignedToUserId || null,
  is_recurring: data.frequency !== "one-time",
}));

await supabase.from("vm_compliance_tasks").insert(tasksToInsert);
```

---

### 4. User Lookup for "Assigned To"

**Approach:** Replace free-text input with a searchable dropdown of active users from `profiles` table.

**Data Fetching:**
```typescript
const [users, setUsers] = useState<{ id: string; username: string }[]>([]);

const fetchUsers = async () => {
  const { data } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("status", "active")
    .order("username");
  if (data) setUsers(data);
};
```

**Form Field:** Replace text input with Select component:
```typescript
<FormField
  name="assignedToUserId"
  render={({ field }) => (
    <Select onValueChange={field.onChange} value={field.value}>
      <SelectTrigger>
        <SelectValue placeholder="Select user" />
      </SelectTrigger>
      <SelectContent>
        {users.map((u) => (
          <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )}
/>
```

**Display in Table:** Join `profiles` in the query and display username instead of raw ID.

---

### 5. Auto-Generate Recurring Tasks

**Trigger Logic:** Create a database function + trigger that fires when a task status changes to `approved`, `rejected`, or when `due_date` passes (via scheduled job or application-level check).

**Option A: Application-Level (Recommended for MVP)**

When reviewing a submission (in `ReviewSubmissions.tsx` or when status updates):
```typescript
// After updating task status
if (task.frequency !== "one-time" && status === "approved") {
  const nextDueDate = calculateNextDueDate(task.due_date, task.frequency);
  await supabase.from("vm_compliance_tasks").insert({
    planogram_id: task.planogram_id,
    store_id: task.store_id,
    title: task.title,
    description: task.description,
    frequency: task.frequency,
    due_date: nextDueDate.toISOString(),
    assigned_to_user_id: task.assigned_to_user_id,
    parent_task_id: task.id,
    is_recurring: true,
    status: "pending",
  });
}
```

**Next Due Date Calculation:**
```typescript
function calculateNextDueDate(currentDue: string, frequency: string): Date {
  const date = new Date(currentDue);
  switch (frequency) {
    case "daily": date.setDate(date.getDate() + 1); break;
    case "weekly": date.setDate(date.getDate() + 7); break;
    case "monthly": date.setMonth(date.getMonth() + 1); break;
  }
  return date;
}
```

**Option B: Database Trigger (Future Enhancement)**

A Postgres trigger function could automate this entirely when `status` is updated.

---

### 6. Click-to-Edit/Delete on Table Rows

**UI Changes:**

1. **Add state for selected task and edit/view dialogs:**
```typescript
const [selectedTask, setSelectedTask] = useState<ComplianceTask | null>(null);
const [editDialogOpen, setEditDialogOpen] = useState(false);
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
```

2. **Make table rows clickable:**
```typescript
<TableRow 
  key={task.id} 
  className="cursor-pointer hover:bg-muted/50"
  onClick={() => handleRowClick(task)}
>
```

3. **Add context menu or action buttons:**
```typescript
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => handleEdit(task)}>
      <Pencil className="h-4 w-4 mr-2" /> Edit
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleDelete(task)} className="text-red-600">
      <Trash className="h-4 w-4 mr-2" /> Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

4. **Unified Create/Edit Form Dialog:**
   - Pre-populate form when editing
   - Use `upsert` or conditional `insert`/`update`

5. **Delete Confirmation:**
```typescript
const handleDeleteConfirm = async () => {
  await supabase.from("vm_compliance_tasks").delete().eq("id", selectedTask.id);
  toast({ title: "Task deleted" });
  fetchData();
};
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/pages/vm/ComplianceTasks.tsx` | Modify | Add multi-store, user lookup, edit/delete, daily frequency |
| `src/pages/vm/ReviewSubmissions.tsx` | Modify | Add recurring task generation after approval |
| Database Migration | Create | Add `assigned_to_user_id`, `parent_task_id`, `is_recurring` columns |

---

## Technical Summary

1. **Database Migration:**
   - Add 3 new columns to `vm_compliance_tasks`
   - `assigned_to_user_id` (UUID, FK to profiles)
   - `parent_task_id` (UUID, self-referential FK)
   - `is_recurring` (BOOLEAN)

2. **ComplianceTasks.tsx Updates:**
   - Add "Daily" to frequency options
   - Replace store single-select with `MultiSelectCombobox`
   - Replace "Assigned To" text input with user dropdown
   - Add row click handlers and action menu
   - Implement unified create/edit form dialog
   - Add delete confirmation dialog

3. **ReviewSubmissions.tsx Updates:**
   - After approving a recurring task, auto-create the next occurrence

4. **Query Updates:**
   - Join `profiles` table to display assigned user's name
   - Update insert logic for multi-store bulk creation

