
# Plan: Add Sample Data to Demonstrate Store Operations Features

## Overview
This plan adds comprehensive sample data across all Store Operations modules to demonstrate the complete workflow from task definition to performance analytics.

## Sample Data to be Added

### 1. Task Master (10 Tasks)
Add diverse tasks covering all categories with varying requirements:

| Task Name | Category | Duration | Requirements |
|-----------|----------|----------|--------------|
| Morning Store Opening Checklist | Admin | 15 mins | Photo |
| Restroom Deep Clean | Cleaning | 30 mins | Photo + GPS |
| Inventory Count - Beverages | Inventory | 45 mins | Barcode Scan |
| Fire Exit Inspection | Security | 10 mins | Photo + GPS |
| Customer Feedback Collection | Customer Service | 20 mins | None |
| AC Filter Check | Maintenance | 25 mins | Photo |
| Cash Register Reconciliation | Admin | 15 mins | None |
| Floor Mopping - Main Area | Cleaning | 20 mins | Photo |
| Shelf Restocking | Inventory | 30 mins | Barcode Scan |
| Evening Store Closing Checklist | Admin | 20 mins | Photo |

### 2. Role Master (6 Roles)
Verify existing roles cover all shifts and add if missing:
- Morning Floor Manager, Morning Janitor (morning)
- Afternoon Floor Manager, Afternoon Cashier (afternoon)
- Evening Floor Manager, Evening Security (evening)
- Night Security Guard (night)

### 3. Task Templates (2 Templates)
Create demonstration templates:

**Template 1: "Standard Daily Operations" (Global - All Stores)**
- Opening checklist (Morning Floor Manager, opening)
- Restroom cleaning every 2 hours (Morning Janitor, periodic)
- Inventory count (Afternoon Floor Manager, anytime)
- Fire exit inspection (Evening Security, closing)
- Closing checklist (Evening Floor Manager, closing)

**Template 2: "Mall Store Operations" (Bharath Mall only)**
- Extended cleaning schedule for high-traffic mall environment
- Hourly customer service checks

### 4. Task Instances (10+ instances)
Generate instances for today's date across stores with mixed statuses:
- 3 Completed (on-time)
- 2 Completed (late)
- 2 In Progress
- 2 Pending
- 1 Handed Over

### 5. Task Completions (5 records)
Create completion records with:
- Photo evidence URLs
- GPS coordinates
- On-time/late flags
- Completion notes

## Technical Implementation

### Step 1: Insert Task Master Records
SQL migration to add 10 diverse tasks with all categories represented

### Step 2: Verify/Add Role Master Records
Check existing roles, add any missing shift coverage

### Step 3: Create Task Templates
- Insert template header records
- Link tasks to templates via task_template_items with proper:
  - Role assignments
  - Frequency settings
  - Time windows (opening/periodic/closing)
  - Priority levels

### Step 4: Generate Task Instances
Create instances for today with realistic scheduling:
- Scheduled times throughout the day
- Due times based on task type
- Various status values

### Step 5: Add Task Completions
Insert completion records for finished tasks with evidence data

## Files to Create

### 1. Database Migration
`supabase/migrations/[timestamp]_add_store_operations_sample_data.sql`
- Insert statements for all sample data
- Use existing store IDs and foreign keys
- Set realistic timestamps

## Expected Outcome
After implementation, users can:
1. View 10 tasks in Task Master with varied requirements
2. See roles organized by shift in Role Master
3. Explore 2 templates with linked tasks in Task Templates
4. Monitor today's task progress in Task Adherence
5. Compare store performance in Store Heatmap

## Testing Walkthrough
1. Navigate to Operations > Task Master - see 10 tasks
2. Navigate to Operations > Role Master - see shift-based roles
3. Navigate to Operations > Task Templates - explore linked tasks
4. Navigate to Operations > Task Adherence - click "Generate Tasks" if needed
5. Navigate to Operations > Store Heatmap - see performance comparison
