## Goal

Add a new **Invoice Template** section under **Admin → Company** and wire the existing **Generate Invoice** button in Order View to render a print-ready GST tax invoice styled per the template, matching the Trayi Jewellers sample invoice.

## 1. Database

New table `invoice_templates` (single-row per company, upserted):

- `company_name_override`, `tagline_override` (optional; default = pull from `company_information`)
- Toggles for header fields: `show_logo`, `show_gst`, `show_pan`, `show_cin`, `show_phone`, `show_address`, `show_bank_details`
- `invoice_title` (default "TAX INVOICE")
- `invoice_prefix` (e.g. `TJ-26/27-`), `next_invoice_number` (int)
- Bank details block: `bank_name`, `bank_account_no`, `bank_branch`, `bank_rtgs_ifsc`
- Tax config: `sgst_rate` (default 1.5), `cgst_rate` (default 1.5), `igst_rate` (default 3.0), `hsn_code` (default 71131930)
- Theme: `color_primary` (header band), `color_accent`, `font_family` (Serif / Sans / Mono)
- `terms_and_conditions`, `footer_note`, `authorised_signatory_label`
- `signature_url`, `seal_url` (optional uploads to `company-assets` bucket)

Add `invoice_number` (text, nullable, unique) and `invoice_generated_at` (timestamptz) to `orders` so invoice numbers persist once generated.

RLS: authenticated read+write, service_role all (same pattern as `company_information`).

## 2. New page: `/admin/company/invoice-template`

Two-pane layout:

- **Left – Settings form** (grouped cards):
  - Branding: logo toggle, color picker (primary/accent), font family select
  - Header Fields: checkboxes for GST/PAN/CIN/Phone/Address, invoice title text
  - Numbering: prefix + next number preview (e.g. `TJ-26/27-0033`)
  - Tax: SGST/CGST/IGST %, default HSN
  - Bank Details: name, a/c, branch, IFSC
  - Signature/Seal upload
  - Terms & footer note textareas
- **Right – Live Preview**: renders the same `InvoiceDocument` component used for printing, populated with sample data + current company info, so users see changes instantly.

Sidebar wiring: add "Invoice Template" as a second item under **Admin → COMPANY** in `src/components/layout/AppSidebar.tsx`, route `/admin/company/invoice-template`.

## 3. Invoice rendering

New component `src/components/invoice/InvoiceDocument.tsx` — pure presentational, accepts `{ template, company, order, customer, lineItems }`. Layout mirrors the attached sample:

```text
┌───────────────────────────────────────────────────────────┐
│  [Logo]         COMPANY NAME (banner)                     │
│  GST / PAN / CIN / Address / Phone                        │
├───────────────────────────────────────────────────────────┤
│              TAX INVOICE                                  │
│  Invoice No / Date / Dispatch / Terms / Ref               │
├──────────────────────────┬────────────────────────────────┤
│  Billed To (customer)    │  Consignor / Shipped To        │
├──────────────────────────┴────────────────────────────────┤
│  SlNo | Description | HSN | Cert# | GWt | NWt | DWt | SWt │
│       |  Rate | Amount                                    │
│  … line rows …                                            │
│  Total row                                                │
├───────────────────────────────────────────────────────────┤
│                       SGST / CGST / IGST                  │
│                       Grand Total                         │
│  Amount in Words                                          │
├───────────────────────────────────────────────────────────┤
│  Bank Details               │  Authorised Signatory       │
└───────────────────────────────────────────────────────────┘
```

Uses semantic tokens; primary color band + font family come from template. Amount-in-words via a small `numberToIndianWords` util.

## 4. Wire "Generate Invoice" in Order View

In `src/components/transactions/OrderFormDialog.tsx` (view mode) the stub button becomes: open new dialog `InvoiceViewerDialog` that:

1. If the order has no `invoice_number`, allocate one atomically (RPC `allocate_invoice_number(prefix)` increments `next_invoice_number` and returns formatted string), then update the order row.
2. Fetch template + company + customer + line items (with `sku`, `net_wt`, `gross_wt`, certificate no, dia_wt, stone_wt from `inventory_items`).
3. Render `<InvoiceDocument … />` inside a scrollable dialog with **Print** and **Download PDF** actions.
4. Print uses `window.print()` scoped via a `@media print` stylesheet that hides app chrome and shows only `.invoice-print-root`.
5. PDF uses `html2canvas` + `jspdf` (already common in stack — add if missing) to export A4.

## 5. Data mapping for line items

Extend `order_items` queries to also fetch related `inventory_items` fields already used elsewhere: `sku` (LL code), `certificate_no`, `gross_wt`, `net_wt`, `dia_wt`, `stone_wt`, `hsn_code`. `Rate` and `Amount` derive from existing `unit_price + dia_price + cs_price + making_charges` × quantity. No changes to order calculation logic.

## Out of scope

- No changes to POS, Journey Builder, WhatsApp, or existing order pricing math.
- No credit-note module (Quickapp reference has one; skipping unless requested).
- No email/WhatsApp send of the generated invoice (can be a follow-up).

## Technical notes

- Sidebar entry gated the same way as Company Information (no `moduleKey`).
- Template row is singleton — upsert pattern like `company_information`.
- Color pickers: use existing `Input type="color"` to avoid new deps.
- Print CSS lives in `src/index.css` under a scoped `@media print` block targeting `.invoice-print-root` only.
- `numberToIndianWords` implemented inline (~40 LOC), no new dep.
