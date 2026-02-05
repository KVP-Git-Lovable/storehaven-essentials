
# Plan: Enhance End Date Display with Task Reference

## Current State Analysis

The End Date functionality **already works correctly**:
- The End Date is dynamically calculated as the latest `end_date` across all tasks in the checklist
- When any task date is edited (via Gantt chart drag/resize or task dialog), the End Date automatically updates
- Database query confirms: "Pest Control, Electrical, AC, Etc." has end_date Feb 17, 2027 - which matches the displayed End Date

**What's Missing:**
1. No indication of which task determines the End Date
2. The NSO listing page doesn't show End Date at all

---

## Implementation Plan

### 1. Add Task Reference to End Date Card (NSOChecklistDetails.tsx)

Modify the End Date card in the header to show which task the date is based on:

**Changes:**
- Find the task with the latest end_date while calculating `calculatedEndDate`
- Display the task name below the End Date in smaller text
- Add a tooltip for long task names

**UI Example:**
```
┌─────────────────────────┐
│ End Date                │
│ Feb 17, 2027            │
│ Based on: Pest Control, │
│ Electrical, AC, Etc.    │
└─────────────────────────┘
```

### 2. Add End Date to NSO Listing Page (NewStoreOpening.tsx)

Display the calculated End Date on each checklist card in the listing:

**Changes:**
- Fetch task end dates along with task counts
- Calculate the latest end_date per checklist
- Display "End: MMM d, yyyy" next to the existing "Start: MMM d, yyyy"

**UI Example:**
```
Start: Mar 1, 2026 → End: Feb 17, 2027
```

---

## Technical Details

### File: src/pages/stores/NSOChecklistDetails.tsx

**Modification 1 - Enhanced End Date Calculation (around line 542-547):**
```typescript
// Calculate end date from tasks (latest end_date) and identify the task
const endDateInfo = tasks.reduce((result: { date: Date | null; taskName: string | null }, task) => {
  if (!task.end_date) return result;
  const taskDate = new Date(task.end_date);
  if (!result.date || taskDate > result.date) {
    return { date: taskDate, taskName: task.name };
  }
  return result;
}, { date: null, taskName: null });

const calculatedEndDate = endDateInfo.date;
const endDateTaskName = endDateInfo.taskName;
```

**Modification 2 - Update End Date Card (around line 606-615):**
```typescript
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium text-muted-foreground">End Date</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-2xl font-bold">
      {calculatedEndDate ? format(calculatedEndDate, "MMM d, yyyy") : "-"}
    </p>
    {endDateTaskName && (
      <p className="text-xs text-muted-foreground mt-1 truncate" title={endDateTaskName}>
        Based on: {endDateTaskName}
      </p>
    )}
  </CardContent>
</Card>
```

### File: src/pages/stores/NewStoreOpening.tsx

**Modification 1 - Update task counts query to include end dates:**
```typescript
const { data: taskCounts = {} } = useQuery({
  queryKey: ["nso-task-counts"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("nso_store_tasks")
      .select("checklist_id, status, end_date");
    if (error) throw error;
    
    const counts: Record<string, { 
      total: number; 
      completed: number; 
      latestEndDate: string | null 
    }> = {};
    
    data.forEach((task) => {
      if (!counts[task.checklist_id]) {
        counts[task.checklist_id] = { total: 0, completed: 0, latestEndDate: null };
      }
      counts[task.checklist_id].total++;
      if (task.status === "completed") {
        counts[task.checklist_id].completed++;
      }
      if (task.end_date) {
        if (!counts[task.checklist_id].latestEndDate || 
            task.end_date > counts[task.checklist_id].latestEndDate) {
          counts[task.checklist_id].latestEndDate = task.end_date;
        }
      }
    });
    return counts;
  },
});
```

**Modification 2 - Display End Date in checklist cards:**
```typescript
<span className="text-xs text-muted-foreground">
  Start: {format(new Date(checklist.start_date), "MMM d, yyyy")}
  {counts.latestEndDate && (
    <> → End: {format(new Date(counts.latestEndDate), "MMM d, yyyy")}</>
  )}
</span>
```

---

## Summary

| Feature | Status | Action |
|---------|--------|--------|
| End Date auto-calculation | Already working | No changes needed |
| Auto-update on task edit | Already working | No changes needed |
| Show which task End Date is based on | Not implemented | Add to NSOChecklistDetails.tsx |
| Show End Date on listing page | Not implemented | Add to NewStoreOpening.tsx |

**Files to Modify:**
1. `src/pages/stores/NSOChecklistDetails.tsx` - Add task reference to End Date card
2. `src/pages/stores/NewStoreOpening.tsx` - Add End Date display to listing cards
