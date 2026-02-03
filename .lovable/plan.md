
# Add Edit Button for Each Service Contract

## Overview
Add an edit button to each contract card in the Service Contracts list, allowing users to modify existing contracts directly from the listing page.

## Current State
- `ContractSummaryCard.tsx` displays contract info with just a click-to-view action
- `ContractFormDialog.tsx` already accepts a `contractId` prop (line 161) but only supports creation mode currently
- `ServiceContracts.tsx` uses permission checks for create (`canCreate`)

## Implementation Plan

### 1. Update ContractSummaryCard Component
**File: `src/components/services/ContractSummaryCard.tsx`**

Add an edit button (Pencil icon) to each card:
- Add new prop: `onEdit?: () => void`
- Add new prop: `canEdit?: boolean` to control visibility based on permissions
- Add a small edit button in the top-right area of the card (near the badges)
- Stop event propagation on edit button click so it doesn't trigger the card's onClick (navigate to details)

```text
+------------------------------------------+
|  [FileText] SC-260203-WAO6    [Edit] [draft]
|  -                                  [AMC]
|  Provider: Exide Industries
|  ...
+------------------------------------------+
```

### 2. Update ServiceContracts Page
**File: `src/pages/services/ServiceContracts.tsx`**

- Add permission check: `const canEdit = hasPermission("services.contracts", "edit")`
- Add state for editing: `const [editingContractId, setEditingContractId] = useState<string | null>(null)`
- Pass `onEdit` and `canEdit` props to `ContractSummaryCard`
- Handle edit by setting `editingContractId` and opening the dialog
- Pass `contractId` to `ContractFormDialog` when editing

### 3. Update ContractFormDialog for Edit Mode
**File: `src/components/services/ContractFormDialog.tsx`**

The dialog already accepts `contractId` but doesn't use it. Add:
- Fetch existing contract data when `contractId` is provided
- Pre-populate form with existing values
- Fetch and pre-select linked assets and locations
- Change submit button text to "Update Contract" in edit mode
- Update the `onSubmit` logic to use `update` instead of `insert` when editing

## Technical Details

### ContractSummaryCard Changes
| Change | Details |
|--------|---------|
| New imports | `Pencil` from lucide-react, `Button` from ui/button |
| New props | `onEdit?: () => void`, `canEdit?: boolean` |
| Edit button | Icon button with `stopPropagation()` to prevent card click |

### ServiceContracts Page Changes
| Change | Details |
|--------|---------|
| New state | `editingContractId: string \| null` |
| Permission | `canEdit = hasPermission("services.contracts", "edit")` |
| Dialog props | Pass `contractId={editingContractId}` to form dialog |
| Card props | Pass `onEdit` and `canEdit` to each card |

### ContractFormDialog Changes
| Change | Details |
|--------|---------|
| New effect | Fetch contract data when `contractId` changes |
| Form reset | Clear form when closing or switching between create/edit |
| Submit logic | Branch between insert (create) and update (edit) |
| Button text | Dynamic: "Create Contract" vs "Update Contract" |
| Dialog title | Dynamic: "New Service Contract" vs "Edit Service Contract" |

## Files to Modify
1. `src/components/services/ContractSummaryCard.tsx` - Add edit button UI
2. `src/pages/services/ServiceContracts.tsx` - Add edit state and permission
3. `src/components/services/ContractFormDialog.tsx` - Add edit/update logic

## Expected Result
- Each contract card shows a small edit (pencil) button (if user has edit permission)
- Clicking edit opens the contract form pre-filled with existing data
- Users can modify and save changes
- Card click still navigates to details page
