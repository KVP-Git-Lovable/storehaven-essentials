import * as XLSX from "xlsx";
import { CUSTOMER_CODE_REGEX, generateCustomerCode } from "@/lib/customerCode";
import { INDIAN_STATES } from "@/lib/indianStates";

export const CUSTOMER_HEADERS = [
  "customer_code",
  "name",
  "phone",
  "email",
  "tier",
  "city",
  "state",
  "country",
  "date_of_birth",
  "anniversary_date",
  "gender",
] as const;

export const REQUIRED_CUSTOMER_FIELDS = ["phone"] as const;
export const VALID_TIERS = ["bronze", "silver", "gold", "platinum"] as const;
export const VALID_GENDERS = ["Male", "Female", "Other"] as const;

export type CustomerImportRow = {
  customer_code?: string;
  name?: string;
  phone: string;
  email?: string;
  tier?: string;
  city?: string;
  state?: string;
  country?: string;
  date_of_birth?: string | number;
  anniversary_date?: string | number;
  gender?: string;
};

export type CustomerIssue = { severity: "error" | "warning"; message: string };

export type ValidatedCustomerRow = {
  rowNumber: number;
  raw: CustomerImportRow;
  issues: CustomerIssue[];
  resolved?: {
    customer_code: string;
    name: string | null;
    phone: string;
    email: string | null;
    tier: string;
    city: string | null;
    state: string | null;
    country: string | null;
    date_of_birth: string | null;
    anniversary_date: string | null;
    gender: string | null;
    existingId?: string; // when matched on phone -> update
  };
};

const SAMPLE_ROW: CustomerImportRow = {
  customer_code: "CUST-001",
  name: "Asha Mehta",
  phone: "9876543210",
  email: "asha@example.com",
  tier: "gold",
  city: "Mumbai",
  state: "Maharashtra",
  country: "India",
  date_of_birth: "1990-05-12",
  anniversary_date: "2015-11-20",
  gender: "Female",
};

/* -------- Template generation -------- */
export function downloadCustomerTemplateCSV() {
  const headers = CUSTOMER_HEADERS.join(",");
  const sample = CUSTOMER_HEADERS.map((h) => String((SAMPLE_ROW as any)[h] ?? "")).join(",");
  const csv = `${headers}\n${sample}\n`;
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), "customer_import_template.csv");
}

export function downloadCustomerTemplateXLSX() {
  const ws = XLSX.utils.json_to_sheet([SAMPLE_ROW], { header: CUSTOMER_HEADERS as unknown as string[] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Customers");
  XLSX.writeFile(wb, "customer_import_template.xlsx");
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
export async function parseCustomerFile(file: File): Promise<CustomerImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("File contains no sheets");
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: true });
  if (!rows.length) throw new Error("File is empty");
  const headers = Object.keys(rows[0]).map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_CUSTOMER_FIELDS.filter((f) => !headers.includes(f));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}`);
  return rows.map((r) => {
    const norm: any = {};
    Object.keys(r).forEach((k) => {
      norm[k.trim().toLowerCase()] = typeof r[k] === "string" ? r[k].trim() : r[k];
    });
    return norm as CustomerImportRow;
  });
}

/* -------- Date parsing -------- */
function parseDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
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

const STATE_LOOKUP = new Set(INDIAN_STATES.map((s) => s.toLowerCase()));

/* -------- Validation -------- */
export function validateCustomerRows(
  rows: CustomerImportRow[],
  existingByPhone: Map<string, { id: string; customer_code: string | null }>,
  existingCodes: Set<string>,
): ValidatedCustomerRow[] {
  const seenCodes = new Set<string>();
  const seenPhones = new Set<string>();

  return rows.map((raw, i) => {
    const issues: CustomerIssue[] = [];
    const rowNumber = i + 1;

    const phone = String(raw.phone ?? "").replace(/\s+/g, "");
    const name = String(raw.name ?? "").trim();
    const email = String(raw.email ?? "").trim();
    let tier = String(raw.tier ?? "").trim().toLowerCase();
    const city = String(raw.city ?? "").trim();
    const state = String(raw.state ?? "").trim();
    const country = String(raw.country ?? "").trim();
    const dob = parseDate(raw.date_of_birth);
    const anniv = parseDate(raw.anniversary_date);
    const genderParsed = normaliseGender(raw.gender);
    let code = String(raw.customer_code ?? "").trim();

    if (!phone || !/^\d{10,15}$/.test(phone)) {
      issues.push({ severity: "error", message: "Invalid phone (10-15 digits)" });
    }
    if (phone && seenPhones.has(phone)) {
      issues.push({ severity: "error", message: "Duplicate phone within file" });
    }
    seenPhones.add(phone);

    const existingByThisPhone = phone ? existingByPhone.get(phone) : undefined;

    if (code) {
      if (!CUSTOMER_CODE_REGEX.test(code)) {
        issues.push({ severity: "error", message: "Customer code must be alphanumeric (letters, digits, _ or -)" });
      }
      if (seenCodes.has(code)) {
        issues.push({ severity: "error", message: "Duplicate customer_code within file" });
      }
      // Code clashes with another customer's code (not the one being updated)
      if (existingCodes.has(code) && existingByThisPhone?.customer_code !== code) {
        issues.push({ severity: "error", message: "customer_code already exists for another customer" });
      }
      seenCodes.add(code);
    } else {
      // Auto-generate; ensure uniqueness against DB & file
      if (existingByThisPhone?.customer_code) {
        code = existingByThisPhone.customer_code; // keep existing
      } else {
        let attempt = generateCustomerCode();
        let safety = 0;
        while ((existingCodes.has(attempt) || seenCodes.has(attempt)) && safety < 20) {
          attempt = generateCustomerCode();
          safety++;
        }
        code = attempt;
        issues.push({ severity: "warning", message: `Auto-generated customer_code "${code}"` });
        seenCodes.add(code);
      }
    }

    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      issues.push({ severity: "warning", message: "Email format looks invalid" });
    }

    if (tier && !VALID_TIERS.includes(tier as any)) {
      issues.push({ severity: "warning", message: `Invalid tier "${tier}" — defaulting to bronze` });
      tier = "bronze";
    }
    if (!tier) tier = "bronze";

    if (state && !STATE_LOOKUP.has(state.toLowerCase())) {
      issues.push({ severity: "warning", message: `State "${state}" is not a recognised Indian state/UT` });
    }

    if (raw.date_of_birth && !dob) {
      issues.push({ severity: "warning", message: "Could not parse date_of_birth (use yyyy-mm-dd)" });
    }
    if (raw.anniversary_date && !anniv) {
      issues.push({ severity: "warning", message: "Could not parse anniversary_date (use yyyy-mm-dd)" });
    }
    if (genderParsed.invalid) {
      issues.push({ severity: "warning", message: `Invalid gender "${raw.gender}" — allowed: Male, Female, Other` });
    }

    if (existingByThisPhone) {
      issues.push({ severity: "warning", message: "Phone already exists — will UPDATE the existing customer" });
    }

    const hasError = issues.some((x) => x.severity === "error");
    const validated: ValidatedCustomerRow = { rowNumber, raw, issues };
    if (!hasError) {
      validated.resolved = {
        customer_code: code,
        name: name || null,
        phone,
        email: email || null,
        tier,
        city: city || null,
        state: state || null,
        country: country || null,
        date_of_birth: dob,
        anniversary_date: anniv,
        gender: genderParsed.value,
        existingId: existingByThisPhone?.id,
      };
    }
    return validated;
  });
}

/* -------- Error rows export -------- */
export function downloadCustomerErrorRows(rows: ValidatedCustomerRow[]) {
  const errorRows = rows.filter((r) => r.issues.some((i) => i.severity === "error"));
  if (!errorRows.length) return;
  const headers = [...CUSTOMER_HEADERS, "errors"];
  const lines = [headers.join(",")];
  errorRows.forEach((r) => {
    const errs = r.issues.filter((i) => i.severity === "error").map((i) => i.message).join("; ");
    const cells = CUSTOMER_HEADERS.map((h) => csvCell(String((r.raw as any)[h] ?? "")));
    cells.push(csvCell(errs));
    lines.push(cells.join(","));
  });
  triggerDownload(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), "customer_import_errors.csv");
}

function csvCell(v: string) {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/* -------- Export helpers -------- */
export const CUSTOMER_EXPORT_HEADERS = [
  "customer_code",
  "name",
  "phone",
  "email",
  "tier",
  "customer_segment",
  "city",
  "state",
  "country",
  "loyalty_points",
  "store_credit",
  "total_orders",
  "total_spent",
  "date_of_birth",
  "anniversary_date",
  "gender",
  "created_at",
] as const;

export function exportCustomersCSV(rows: any[]) {
  const lines = [CUSTOMER_EXPORT_HEADERS.join(",")];
  rows.forEach((r) => {
    lines.push(
      CUSTOMER_EXPORT_HEADERS.map((h) => {
        const v = r[h];
        return csvCell(v == null ? "" : String(v));
      }).join(","),
    );
  });
  triggerDownload(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), `customers_${Date.now()}.csv`);
}

export function exportCustomersXLSX(rows: any[]) {
  const data = rows.map((r) => {
    const out: any = {};
    CUSTOMER_EXPORT_HEADERS.forEach((h) => (out[h] = r[h] ?? ""));
    return out;
  });
  const ws = XLSX.utils.json_to_sheet(data, { header: CUSTOMER_EXPORT_HEADERS as unknown as string[] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Customers");
  XLSX.writeFile(wb, `customers_${Date.now()}.xlsx`);
}