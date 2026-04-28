import * as XLSX from "xlsx";

export const LEAD_HEADERS = [
  "name",
  "email",
  "phone",
  "city",
  "state",
  "country",
  "address",
] as const;

export const LEAD_REQUIRED_FIELDS = ["phone"] as const;

export type LeadImportRow = {
  name?: string;
  email?: string;
  phone: string;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
};

export type Issue = { severity: "error" | "warning"; message: string };

export type ValidatedLeadRow = {
  rowNumber: number;
  raw: LeadImportRow;
  issues: Issue[];
  resolved?: {
    name: string | null;
    email: string | null;
    phone: string;
    city: string | null;
    state: string | null;
    country: string | null;
    address: string | null;
  };
};

const SAMPLE_ROW: LeadImportRow = {
  name: "Asha Mehta",
  email: "asha@example.com",
  phone: "9876543210",
  city: "Mumbai",
  state: "Maharashtra",
  country: "India",
  address: "12 MG Road",
};

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

export function downloadLeadTemplateCSV() {
  const headers = LEAD_HEADERS.join(",");
  const sample = LEAD_HEADERS.map((h) => String((SAMPLE_ROW as any)[h] ?? "")).join(",");
  triggerDownload(new Blob([`${headers}\n${sample}\n`], { type: "text/csv;charset=utf-8" }), "lead_import_template.csv");
}

export function downloadLeadTemplateXLSX() {
  const ws = XLSX.utils.json_to_sheet([SAMPLE_ROW], { header: LEAD_HEADERS as unknown as string[] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  XLSX.writeFile(wb, "lead_import_template.xlsx");
}

export async function parseLeadFile(file: File): Promise<LeadImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("File contains no sheets");
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: true });
  if (!rows.length) throw new Error("File is empty");
  const headers = Object.keys(rows[0]).map((h) => h.trim().toLowerCase());
  const missing = LEAD_REQUIRED_FIELDS.filter((f) => !headers.includes(f));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}`);
  return rows.map((r) => {
    const norm: any = {};
    Object.keys(r).forEach((k) => {
      norm[k.trim().toLowerCase()] = typeof r[k] === "string" ? r[k].trim() : r[k];
    });
    return norm as LeadImportRow;
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLeadRows(
  rows: LeadImportRow[],
  existingPhones: Set<string>,
): ValidatedLeadRow[] {
  const seenPhones = new Set<string>();
  return rows.map((raw, i) => {
    const issues: Issue[] = [];
    const rowNumber = i + 1;

    const phone = String(raw.phone ?? "").replace(/\s+/g, "");
    const name = String(raw.name ?? "").trim();
    const email = String(raw.email ?? "").trim();
    const city = String(raw.city ?? "").trim();
    const state = String(raw.state ?? "").trim();
    const country = String(raw.country ?? "").trim();
    const address = String(raw.address ?? "").trim();

    if (!phone || !/^\d{10,15}$/.test(phone)) {
      issues.push({ severity: "error", message: "Invalid phone (10-15 digits)" });
    } else {
      if (existingPhones.has(phone)) {
        issues.push({ severity: "error", message: "Lead with this phone already exists" });
      }
      if (seenPhones.has(phone)) {
        issues.push({ severity: "error", message: "Duplicate phone within file" });
      }
      seenPhones.add(phone);
    }

    if (email && !EMAIL_RE.test(email)) {
      issues.push({ severity: "warning", message: "Email format looks invalid" });
    }
    if (!name) {
      issues.push({ severity: "warning", message: "Name is empty" });
    }

    const hasError = issues.some((i) => i.severity === "error");
    const validated: ValidatedLeadRow = { rowNumber, raw, issues };
    if (!hasError) {
      validated.resolved = {
        name: name || null,
        email: email || null,
        phone,
        city: city || null,
        state: state || null,
        country: country || null,
        address: address || null,
      };
    }
    return validated;
  });
}

export function downloadLeadErrorRows(rows: ValidatedLeadRow[]) {
  const errorRows = rows.filter((r) => r.issues.some((i) => i.severity === "error"));
  if (!errorRows.length) return;
  const headers = [...LEAD_HEADERS, "errors"];
  const lines = [headers.join(",")];
  errorRows.forEach((r) => {
    const errs = r.issues.filter((i) => i.severity === "error").map((i) => i.message).join("; ");
    const cells = LEAD_HEADERS.map((h) => csvCell(String((r.raw as any)[h] ?? "")));
    cells.push(csvCell(errs));
    lines.push(cells.join(","));
  });
  triggerDownload(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), "lead_import_errors.csv");
}

function csvCell(v: string) {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
