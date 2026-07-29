import { supabase } from "@/integrations/supabase/client";

/**
 * Prints a single element with full fidelity by cloning it (and all document
 * stylesheets) into an isolated, hidden iframe. This avoids the layout/clipping
 * artefacts caused by printing a scrollable modal in-place.
 */
export function printElement(el: HTMLElement, title = "Invoice") {
  const prevTitle = document.title;
  document.title = safeInvoiceFileName(title);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.right = "auto";
  iframe.style.bottom = "auto";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "210mm";
  iframe.style.height = "297mm";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    window.print();
    document.title = prevTitle;
    return;
  }

  const headParts: string[] = [];
  document.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
    headParts.push(`<link rel="stylesheet" href="${(l as HTMLLinkElement).href}">`);
  });
  document.querySelectorAll("style").forEach((s) => {
    headParts.push(`<style>${s.innerHTML}</style>`);
  });

  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    ${headParts.join("\n")}
    <style>
      @page { size: A4; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .print-shell { width: 210mm; margin: 0 auto; }
      /* Neutralise the app's @media print rules that hide everything outside
         the invoice dialog — inside this iframe the invoice IS the document. */
      @media print {
        html, body, .print-shell, .print-shell * { visibility: visible !important; }
        .print-shell { position: static !important; transform: none !important; }
      }
    </style>
  </head><body><div class="print-shell">${el.outerHTML}</div></body></html>`);
  doc.close();

  const done = () => {
    const ready = (iframe.contentDocument as any)?.fonts?.ready ?? Promise.resolve();
    Promise.resolve(ready).then(() => setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => iframe.remove(), 2000);
        setTimeout(() => { document.title = prevTitle; }, 2500);
      }
    }, 400));
  };

  if (doc.readyState === "complete") done();
  else iframe.onload = done;
}

/** Sanitises a name so it is a legal file name on all platforms. */
export function safeInvoiceFileName(name: string) {
  return (name || "Invoice").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

/** Generates the invoice PDF and downloads it as `Trayi-<Invoice No>.pdf`. */
export async function downloadInvoicePdf(el: HTMLElement, invoiceNumber: string) {
  const blob = await elementToPdfBlob(el);
  const fileName = `${safeInvoiceFileName(`Trayi-${invoiceNumber || "Invoice"}`)}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return fileName;
}

/** Renders the element to an A4 PDF blob. */
export async function elementToPdfBlob(el: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: el.scrollWidth,
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgH = (canvas.height * pageW) / canvas.width;
  const img = canvas.toDataURL("image/jpeg", 0.95);

  let remaining = imgH;
  let position = 0;
  pdf.addImage(img, "JPEG", 0, 0, pageW, imgH);
  remaining -= pageH;
  while (remaining > 1) {
    position -= pageH;
    pdf.addPage();
    pdf.addImage(img, "JPEG", 0, position, pageW, imgH);
    remaining -= pageH;
  }
  return pdf.output("blob");
}

/** Archives the rendered invoice into the private `invoices` storage bucket. */
export async function archiveInvoicePdf(
  el: HTMLElement,
  invoiceNumber: string,
  orderId: string
): Promise<string | null> {
  try {
    const blob = await elementToPdfBlob(el);
    const safe = (invoiceNumber || orderId).replace(/[^A-Za-z0-9_-]+/g, "-");
    const path = `${new Date().getFullYear()}/${safe}.pdf`;
    const { error } = await supabase.storage
      .from("invoices")
      .upload(path, blob, { contentType: "application/pdf", upsert: true });
    if (error) throw error;
    return path;
  } catch (e) {
    console.error("Invoice archive failed", e);
    return null;
  }
}
