import * as XLSX from "xlsx";

export const REQUIRED_HEADERS = [
  "name",
  "email",
  "phone",
  "city",
  "state",
  "country",
  "address",
  "date_of_birth",
  "gender",
] as const;

export const REQUIRED_FIELDS = ["phone"] as const;
const VALID_GENDERS = ["Male", "Female", "Other"] as const;

export type ImportRow = {
  name?: string;
  email?: string;
  phone: string;
  city?: string;
  state?: string;
  country?: string;
  address?: string;
  date_of_birth?: string | number;
  gender?: string;
};

export type Issue = { severity: "error" | "warning"; message: string };

export type ValidatedRow = {
  rowNumber: number;
  raw: ImportRow;
  issues: Issue[];
  resolved?: {
    name: string | null;
    email: string | null;
    phone: string;
    city: string | null;
    state: string | null;
    country: string | null;
    address: string | null;
    date_of_birth: string | null;
    gender: string | null;
  };
};

const SAMPLE_ROW = {
  name: "Asha Mehta",
  email: "asha@example.com",
  phone: "9876543210",
  city: "Mumbai",
  state: "Maharashtra",
  country: "India",
  address: "12 MG Road",
  date_of_birth: "1990-05-12",
  gender: "Female",
};

export function downloadTemplateCSV() {
  const headers = REQUIRED_HEADERS.join(",");
  const sample = REQUIRED_HEADERS.map((h) => csvCell(String((SAMPLE_ROW as any)[h] ?? ""))).join(",");
  const csv = `${headers}\n${sample}\n`;
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), "lead_import_template.csv");
}

export function downloadTemplateXLSX() {
  const ws = XLSX.utils.json_to_sheet([SAMPLE_ROW], { header: REQUIRED_HEADERS as unknown as string[] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  XLSX.writeFile(wb, "lead_import_template.xlsx");
}

function parseDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // Accept dd-mm-yyyy or dd/mm/yyyy
  const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s.includes("T") ? s : s + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normaliseGender(v: any): { value: string | null; invalid: boolean } {
  const s = String(v ?? "").trim();
  if (!s) return { value: null, invalid: false };
  const lower = s.toLowerCase();
  const match = VALID_GENDERS.find((g) => g.toLowerCase() === lower);
  return match ? { value: match, invalid: false } : { value: null, invalid: true };
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

export async function parseFile(file: File): Promise<ImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("File contains no sheets");
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: true });
  if (!rows.length) throw new Error("File is empty");
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

export function validateRows(
  rows: ImportRow[],
  existingPhones: Set<string>,
): ValidatedRow[] {
  const seenPhonesInFile = new Set<string>();
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
    const dob = parseDate(raw.date_of_birth);
    const genderParsed = normaliseGender(raw.gender);

    if (!phone) {
      issues.push({ severity: "error", message: "Phone is required" });
    } else if (!/^\+?\d{10,15}$/.test(phone)) {
      issues.push({ severity: "error", message: "Invalid phone (10-15 digits)" });
    } else {
      if (seenPhonesInFile.has(phone)) {
        issues.push({ severity: "error", message: "Duplicate phone within file" });
      }
      seenPhonesInFile.add(phone);
      if (existingPhones.has(phone)) {
        issues.push({ severity: "error", message: "Phone already exists in leads" });
      }
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      issues.push({ severity: "warning", message: "Invalid email format" });
    }

    if (!name) {
      issues.push({ severity: "warning", message: "Name is empty" });
    }

    if (raw.date_of_birth && !dob) {
      issues.push({ severity: "warning", message: "Could not parse date_of_birth (use dd-mm-yyyy or yyyy-mm-dd)" });
    }
    if (genderParsed.invalid) {
      issues.push({ severity: "warning", message: `Invalid gender "${raw.gender}" — allowed: Male, Female, Other` });
    }

    const hasError = issues.some((i) => i.severity === "error");
    const validated: ValidatedRow = { rowNumber, raw, issues };
    if (!hasError) {
      validated.resolved = {
        name: name || null,
        email: email || null,
        phone,
        city: city || null,
        state: state || null,
        country: country || null,
        address: address || null,
        date_of_birth: dob,
        gender: genderParsed.value,
      };
    }
    return validated;
  });
}

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
  triggerDownload(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), "lead_import_errors.csv");
}

function csvCell(v: string) {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
