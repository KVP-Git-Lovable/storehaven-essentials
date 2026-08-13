# Fix Leads and Online Enquiries visibility

## Confirmed cause
- The database contains 1,929 lead records: 1 website appointment and 1,928 records whose `source` is empty.
- The **Online Enquiries** tab queries `online_enquiries`, but that table does not exist, so its request fails.
- The **Leads** tab uses `source != 'website_appointment'`. Database null semantics cause this condition to exclude rows with an empty `source`, which currently hides all 1,928 regular leads.

## Implementation
1. Update the **Leads** query to include records where `source` is empty while excluding only records explicitly marked `website_appointment`.
2. Update the **Online Enquiries** query to read from `leads` and include only `source = 'website_appointment'`.
3. Keep the same search, sort, pagination, appointment fields, and existing actions in both tabs.
4. Apply the same website-appointment exclusion after saved List View filters, so appointments cannot reappear in **Leads** through that path.
5. Surface query failures in the UI instead of incorrectly showing an empty-state message.

## Validation
- Confirm the Leads tab shows the regular records and no `website_appointment` rows.
- Confirm Online Enquiries shows the website appointment and no regular lead rows.
- Verify search, pagination, row actions, and tab switching still work.
