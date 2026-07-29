## Why the filename is wrong

The print path writes `<title>Trayi-TJ-26/27-0009</title>` into the hidden iframe, but the browser's native "Save as PDF" dialog derives the suggested filename from the **top-level document's title** (which is the app's `index.html` title, "StoreOps"), not the printed iframe's title. Also, `/` in an invoice number like `TJ-26/27-0009` is not a legal filename character, so even when a title is honoured the OS rewrites it.

So the print route can never reliably control the filename. The fix is to stop relying on it for saving.

## Changes

### 1. Split the footer button into two (`src/components/invoice/InvoiceViewerDialog.tsx`)
- **Print** — keeps the current iframe print behaviour unchanged (for physical printing).
- **Download PDF** — generates the PDF in-browser and triggers a direct download with a controlled filename. No OS print dialog, no random name.

### 2. Add a direct download helper (`src/lib/invoicePrint.ts`)
- New `downloadInvoicePdf(el, invoiceNumber)`:
  - reuses the existing `elementToPdfBlob(el)` (html2canvas + jsPDF at A4) already used for archiving, so the downloaded file matches the archived copy and the on-screen invoice exactly;
  - builds the filename as `Trayi-<Invoice No>.pdf`, sanitising path-illegal characters (`/` → `-`), e.g. `TJ-26/27-0009` → `Trayi-TJ-26-27-0009.pdf`;
  - saves via an object-URL anchor with the `download` attribute, then revokes the URL.

### 3. Title hardening for the Print route (small, optional safety)
- While printing, temporarily set the parent `document.title` to the invoice name and restore it afterwards, so if a user still uses Print → Save as PDF the suggested name is close to correct rather than "StoreOps".

## Notes
- No changes to invoice layout, numbering, tax logic, or the existing auto-archive to the private `invoices` bucket.
- If you'd prefer the slash preserved as `Trayi-TJ-26/27-0012.pdf`, that isn't possible — browsers and macOS/Windows both reject `/` in filenames; `-` substitution is the standard fallback.