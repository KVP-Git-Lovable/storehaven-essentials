
# Service Contract Details View Implementation

## Problem Statement
Currently, clicking on a service contract card shows a "Coming soon" toast message instead of navigating to a detailed view of the contract. Users cannot view, edit, or manage individual service contracts.

## Solution Overview
Create a comprehensive Service Contract Details page that displays all contract information organized into logical sections, following the established pattern used in AssetDetails.tsx.

## Implementation Steps

### 1. Create Service Contract Details Page
**File:** `src/pages/services/ServiceContractDetails.tsx`

This new page will display the full contract information organized into sections:

**Header Section:**
- Contract number and status badge
- Service provider name
- Contract type badge (AMC/Warranty/SLA/Hybrid)
- Edit and Delete action buttons

**Card Sections:**
1. **Contract Overview**
   - Effective date, start date, end date
   - Auto-renewal status
   - Contract value and pricing model
   - Invoice frequency and payment terms

2. **Scope & Coverage**
   - Service types included
   - Labour coverage (included/rate/hours)
   - Travel coverage (included/radius/rate)
   - Spares coverage (percentage/max value/exclusions)
   - Consumables coverage

3. **SLA Matrix**
   - P1-P4 response and resolution times
   - Support hours
   - SLA penalties if applicable

4. **PM Schedule**
   - PM frequency
   - Checklist items
   - Task type
   - Auto-create setting

5. **Penalty Clauses** (if applicable)
   - Penalty type and rate
   - Grace period
   - Calculation basis

6. **Escalation Contacts**
   - L1, L2, L3 contact details

7. **Linked Assets** (table)
   - Asset name, number, store, condition

8. **Covered Locations** (table)
   - Store name and address

9. **Attachments**
   - List of uploaded contract documents with download links

10. **Notes & Exclusions**

### 2. Add Route Configuration
**File:** `src/App.tsx`

Add a new route for the contract details page:
```
/services/contracts/:id -> ServiceContractDetails
```

### 3. Update Service Contracts List
**File:** `src/pages/services/ServiceContracts.tsx`

Update the onClick handler in ContractSummaryCard to navigate to the details page:
```typescript
onClick={() => navigate(`/services/contracts/${contract.id}`)}
```

### 4. Update Contract Summary Card
**File:** `src/components/services/ContractSummaryCard.tsx`

Ensure the card properly supports click-through navigation.

## Technical Details

### Data Fetching Strategy
Fetch all related data in parallel for performance:
- Contract details from `service_contracts`
- Linked assets from `service_contract_assets` with asset details
- Covered locations from `service_contract_locations` with store details
- Attachments from `service_contract_attachments`
- Maintenance tasks linked to this contract

### UI Components Used
- Card, CardHeader, CardContent for sections
- Badge for status and type indicators
- Table for assets and locations lists
- Separator for visual organization
- Collapsible sections for lengthy content (SLA, PM, etc.)
- Button for edit/delete actions

### Navigation
- Back button returns to `/services/contracts`
- Edit button opens the ContractFormDialog in edit mode (future enhancement)
- Asset rows link to `/assets/inventory/:id`
- Location rows link to `/stores/:id`

## Files to be Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `src/pages/services/ServiceContractDetails.tsx` | Create | New contract details page component |
| `src/App.tsx` | Modify | Add route for contract details |
| `src/pages/services/ServiceContracts.tsx` | Modify | Update onClick to navigate |

## User Experience
After implementation:
1. User clicks on a contract card
2. User is navigated to `/services/contracts/{contract-id}`
3. User sees full contract details organized in cards
4. User can view linked assets and locations
5. User can download attachments
6. User can navigate back to the contracts list
