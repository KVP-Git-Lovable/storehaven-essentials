## Goal
Standardize DOB and Gender capture across all person-oriented entities, without touching existing workflows.

## Scope — person-oriented tables
| Entity | Table | DOB today | Gender today | Action |
|---|---|---|---|---|
| Leads | `leads` | ❌ | ❌ | add both |
| Customers | `customers` | ✅ `date_of_birth` | ❌ | add `gender` |
| Contacts | `journey_contacts` | ✅ `date_of_birth` | ❌ | add `gender` |
| Candidates | `candidates` | ❌ | ❌ | add both |
| Employees | `employees` | ✅ `date_of_birth` | ✅ `gender` | UI parity only |
| Visitors | — | — | — | no dedicated table found; skip unless you point one out |

All columns nullable → existing rows unaffected; no API/automation impact.

## 1. Database migration (single migration)
```sql
-- Leads
ALTER TABLE public.leads
  ADD COLUMN date_of_birth date,
  ADD COLUMN gender text CHECK (gender IN ('Male','Female','Other'));

-- Customers
ALTER TABLE public.customers
  ADD COLUMN gender text CHECK (gender IN ('Male','Female','Other'));

-- Journey Contacts
ALTER TABLE public.journey_contacts
  ADD COLUMN gender text CHECK (gender IN ('Male','Female','Other'));

-- Candidates
ALTER TABLE public.candidates
  ADD COLUMN date_of_birth date,
  ADD COLUMN gender text CHECK (gender IN ('Male','Female','Other'));
```
No data backfill. No RLS / grant changes (existing policies cover new columns). No trigger or function changes.

## 2. Shared UI helper
Add `src/components/shared/GenderSelect.tsx` — a 3-option Select (`Male`, `Female`, `Other`) reused everywhere.

DOB inputs: use existing shadcn Popover + Calendar pattern (already used elsewhere) with display format `dd-MM-yyyy` via `date-fns/format`. Stored as ISO `date` in DB. No new dependency.

## 3. Form & list updates
For each entity, add DOB + Gender to Create/Edit dialog, View dialog, and the main list table column (after existing identity columns).

- **Leads** — `src/components/transactions/LeadFormDialog.tsx`, `src/pages/transactions/LeadsList.tsx`, `src/lib/leadImport.ts` (accept optional `dob`, `gender` columns; skip if absent)
- **Customers** — `src/pages/transactions/CustomersList.tsx` + its form dialog, `src/lib/customerImport.ts`
- **Contacts** — `src/pages/communication/ContactsManager.tsx` (add Gender to add dialog, DOB already exists — reformat display to dd-mm-yyyy)
- **Candidates** — `src/components/recruitment/CandidateFormDialog.tsx`, `src/components/recruitment/CandidateDetailsSheet.tsx`
- **Employees** — `src/pages/staff/Employees.tsx`, `src/pages/staff/EmployeeDetails.tsx` — verify both fields surface in create/edit/view; reformat DOB display to dd-mm-yyyy

Validation via `zod` (`src/lib/schemas.ts`):
- `date_of_birth: z.string().optional().nullable()` (ISO)
- `gender: z.enum(['Male','Female','Other']).optional().nullable()`

## 4. Out of scope (preserves backward compatibility)
- No changes to journeys engine, list-view executor, analytics, edge functions, exports, or RLS.
- No rename of existing `date_of_birth` columns.
- No changes to filters/segment logic beyond the columns being available to existing dynamic list-view builder (which already auto-discovers columns).
- No visitors module changes (none exists).

## Open question
You mentioned "Visitors" — there is no Visitors table in the project today. Should I (a) skip it, or (b) create a new `visitors` table? Default: skip.
