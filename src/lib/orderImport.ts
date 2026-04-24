import * as XLSX from "xlsx";

export const REQUIRED_HEADERS = [
  "order_id",
  "customer_phone",
  "customer_name",
  "product_name",
  "quantity",
  "unit_price",
  "order_date",
  "status",
] as const;

export const REQUIRED_FIELDS = ["customer_phone", "product_name", "quantity", "unit_price", "order_date"] as const;
export const VALID_STATUSES = ["pending", "completed", "cancelled", "refunded"] as const;

export type ImportRow = {
  order_id?: string;
  customer_phone: string;
  customer_name?: string;
  product_name: string;
  quantity: string | number;
  unit_price: string | number;
  order_date: string | number;
  status?: string;
};

export type Issue = { severity: "error" | "warning"; message: string };

export type ValidatedRow = {
  rowNumber: number; // 1-based, excluding header
  raw: ImportRow;
  issues: Issue[];
  // Resolved values for insertion
  resolved?: {
    customer_id?: string; // existing
    create_customer?: { phone: string; name: string }; // to create
    product_id: string;
    quantity: number;
    unit_price: number;
    order_date: Date;
    status: string;
    order_number?: string;
    customer_phone: string;
  };
};

const SAMPLE_ROW = {
  order_id: "",
  customer_phone: "9876543210",
  customer_name: "Asha Mehta",
  product_name: "Gold Diamond Solitaire Ring",
  quantity: 1,
  unit_price: 75000,
  order_date: "2026-04-20",
  status: "completed",
};

/* -------- Template generation -------- */
export function downloadTemplateCSV() {
  const headers = REQUIRED_HEADERS.join(",");
  const sample = REQUIRED_HEADERS.map((h) => String((SAMPLE_ROW as any)[h] ?? "")).join(",");
  const csv = `${headers}\n${sample}\n`;
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), "order_import_template.csv");
}

export function downloadTemplateXLSX() {
  const ws = XLSX.utils.json_to_sheet([SAMPLE_ROW], { header: REQUIRED_HEADERS as unknown as string[] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  XLSX.writeFile(wb, "order_import_template.xlsx");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* -------- File parsing -------- */
export async function parseFile(file: File): Promise<ImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("File contains no sheets");
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: true });
  if (!rows.length) throw new Error("File is empty");
  // Validate headers — first row keys
  const headers = Object.keys(rows[0]).map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_FIELDS.filter((f) => !headers.includes(f));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}`);
  return rows.map((r) => {
    const norm: any = {};
    Object.keys(r).forEach((k) => {
      norm[k.trim().toLowerCase()] = typeof r[k] === "string" ? r[k].trim() : r[k];
    });
    return norm as ImportRow;
  });
}

/* -------- Date parsing (ISO or Excel serial) -------- */
function parseDate(v: any): Date | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // Excel serial (days since 1899-12-30)
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  // yyyy-mm-dd or other parseable formats
  const d = new Date(s.includes("T") ? s : s + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d;
}

/* -------- Validation -------- */
export function validateRows(
  rows: ImportRow[],
  customers: Map<string, { id: string; name: string | null }>,
  products: Map<string, string>,
  existingOrderNumbers: Set<string>,
): ValidatedRow[] {
  const seenOrderIdsInFile = new Set<string>();
  return rows.map((raw, i) => {
    const issues: Issue[] = [];
    const rowNumber = i + 1;

    const phone = String(raw.customer_phone ?? "").replace(/\s+/g, "");
    const fileName = String(raw.customer_name ?? "").trim();
    const productName = String(raw.product_name ?? "").trim();
    const qtyN = Number(raw.quantity);
    const priceN = Number(raw.unit_price);
    const date = parseDate(raw.order_date);
    const orderId = String(raw.order_id ?? "").trim();
    let status = String(raw.status ?? "").trim().toLowerCase();

    if (!phone || !/^\d{10,15}$/.test(phone)) {
      issues.push({ severity: "error", message: "Invalid customer phone (10-15 digits)" });
    }

    const existingCust = phone ? customers.get(phone) : undefined;
    if (!existingCust && phone && /^\d{10,15}$/.test(phone)) {
      if (!fileName) {
        issues.push({ severity: "error", message: "Customer not found — provide customer_name to auto-create" });
      }
    } else if (existingCust && fileName && (existingCust.name || "").trim().toLowerCase() !== fileName.toLowerCase()) {
      issues.push({ severity: "warning", message: `Customer name mismatch (DB: "${existingCust.name || ""}")` });
    }

    if (!productName) issues.push({ severity: "error", message: "Product name required" });
    const productId = productName ? products.get(productName.toLowerCase()) : undefined;
    if (productName && !productId) issues.push({ severity: "error", message: "Product not found" });

    if (!Number.isFinite(qtyN) || !Number.isInteger(qtyN) || qtyN <= 0) {
      issues.push({ severity: "error", message: "Invalid quantity (must be integer > 0)" });
    }
    if (!Number.isFinite(priceN) || priceN < 0) {
      issues.push({ severity: "error", message: "Invalid price (must be number ≥ 0)" });
    }
    if (!date) issues.push({ severity: "error", message: "Invalid date (use yyyy-mm-dd)" });

    if (orderId) {
      if (existingOrderNumbers.has(orderId)) {
        issues.push({ severity: "error", message: "Duplicate order — order_id already exists" });
      }
      if (seenOrderIdsInFile.has(orderId)) {
        issues.push({ severity: "error", message: "Duplicate order_id within file" });
      }
      seenOrderIdsInFile.add(orderId);
    }

    if (status && !VALID_STATUSES.includes(status as any)) {
      issues.push({ severity: "warning", message: `Invalid status "${status}" — defaulting to "completed"` });
      status = "completed";
    }
    if (!status) status = "completed";

    const hasError = issues.some((i) => i.severity === "error");
    const validated: ValidatedRow = { rowNumber, raw, issues };
    if (!hasError && productId && date) {
      validated.resolved = {
        customer_id: existingCust?.id,
        create_customer: existingCust ? undefined : { phone, name: fileName },
        product_id: productId,
        quantity: qtyN,
        unit_price: priceN,
        order_date: date,
        status,
        order_number: orderId || undefined,
        customer_phone: phone,
      };
    }
    return validated;
  });
}

/* -------- Error rows export -------- */
export function downloadErrorRows(rows: ValidatedRow[]) {
  const errorRows = rows.filter((r) => r.issues.some((i) => i.severity === "error"));
  if (!errorRows.length) return;
  const headers = [...REQUIRED_HEADERS, "errors"];
  const lines = [headers.join(",")];
  errorRows.forEach((r) => {
    const errs = r.issues.filter((i) => i.severity === "error").map((i) => i.message).join("; ");
    const cells = REQUIRED_HEADERS.map((h) => csvCell(String((r.raw as any)[h] ?? "")));
    cells.push(csvCell(errs));
    lines.push(cells.join(","));
  });
  triggerDownload(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), "order_import_errors.csv");
}

function csvCell(v: string) {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/* -------- Order number generator -------- */
export function generateOrderNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `IMP-${ymd}-${rand}`;
}
