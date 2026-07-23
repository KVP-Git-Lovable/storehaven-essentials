// Export all trayi_* backup tables as CSVs, zip in-memory, and email via Resend.
// Reads from the external backup Supabase project (ylvhhlykyojudldcmzou) using
// its service-role key stored as EXTERNAL_BACKUP_SERVICE_KEY.

import {
  BlobWriter,
  TextReader,
  ZipWriter,
} from "https://deno.land/x/zipjs@v2.7.45/index.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const EXTERNAL_URL = "https://ylvhhlykyojudldcmzou.supabase.co";
const TABLES = [
  "trayi_customers",
  "trayi_inventory_items",
  "trayi_order_items",
  "trayi_orders",
  "trayi_profiles",
  "trayi_user_roles_master",
];

const PAGE_SIZE = 1000;
const RECIPIENT = "Abhishek.S@kvpcorp.com";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function istDateKey(): string {
  // Asia/Kolkata date as YYYY-MM-DD
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA yields YYYY-MM-DD
}

async function sbFetch(path: string, init: RequestInit = {}) {
  return await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function claimRun(runKey: string, source: string): Promise<boolean> {
  const res = await sbFetch("trayi_export_runs", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
    body: JSON.stringify({ run_key: runKey, source, status: "running" }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`claimRun failed [${res.status}]: ${t.slice(0, 300)}`);
  }
  const rows = (await res.json()) as unknown[];
  return rows.length > 0;
}

async function finishRun(runKey: string, patch: Record<string, unknown>) {
  const res = await sbFetch(`trayi_export_runs?run_key=eq.${encodeURIComponent(runKey)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, finished_at: new Date().toISOString() }),
  });
  if (!res.ok) console.error("finishRun failed", res.status, await res.text());
  else await res.text();
}

async function fetchTable(name: string, serviceKey: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const res = await fetch(`${EXTERNAL_URL}/rest/v1/${name}?select=*`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Range: `${from}-${to}`,
        "Range-Unit": "items",
        Prefer: "count=exact",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`fetch ${name} ${res.status}: ${text.slice(0, 300)}`);
    }
    const batch = (await res.json()) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (value instanceof Date) s = value.toISOString();
  else if (typeof value === "object") s = JSON.stringify(value);
  else s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function convertToCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const keySet = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) keySet.add(k);
  const headers = Array.from(keySet);
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\r\n");
}

async function createZip(files: Record<string, string>): Promise<Uint8Array> {
  const blobWriter = new BlobWriter("application/zip");
  const zip = new ZipWriter(blobWriter);
  for (const [name, contents] of Object.entries(files)) {
    await zip.add(name, new TextReader(contents));
  }
  const blob = await zip.close();
  return new Uint8Array(await blob.arrayBuffer());
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function sendEmail(zipBytes: Uint8Array, filename: string): Promise<void> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!resendKey) throw new Error("RESEND_API_KEY is not configured");

  const from = Deno.env.get("EXPORT_FROM_EMAIL") || "Trayi Backup <onboarding@resend.dev>";
  const today = new Date().toISOString().slice(0, 10);

  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from,
      to: [RECIPIENT],
      subject: `Trayi backup export — ${today}`,
      text: `Attached is the Trayi backup export for ${today}. Contains ${TABLES.length} CSVs.`,
      attachments: [
        {
          filename,
          content: bytesToBase64(zipBytes),
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend send failed [${res.status}]: ${body.slice(0, 500)}`);
  }
  await res.text();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("EXTERNAL_BACKUP_SERVICE_KEY");
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: "EXTERNAL_BACKUP_SERVICE_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { run_key?: string; source?: string } = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { /* empty body ok */ }
  }
  const source = body.source || "manual";
  const runKey = body.run_key || `${source}-${istDateKey()}`;

  const claimed = await claimRun(runKey, source);
  if (!claimed) {
    console.log(`[export-trayi] duplicate suppressed for run_key=${runKey}`);
    return new Response(
      JSON.stringify({ skipped: true, reason: "already_ran", run_key: runKey }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  console.log(`[export-trayi] starting run_key=${runKey} source=${source}`);

  try {
    const csvFiles: Record<string, string> = {};
    const counts: Record<string, number> = {};
    const failures: { table: string; error: string }[] = [];
    await Promise.all(
      TABLES.map(async (t) => {
        try {
          const rows = await fetchTable(t, serviceKey);
          csvFiles[`${t}.csv`] = convertToCSV(rows);
          counts[t] = rows.length;
          console.log(`[export-trayi] ${t}: ${rows.length} rows`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[export-trayi] table ${t} failed:`, msg);
          failures.push({ table: t, error: msg });
          csvFiles[`${t}__ERROR.txt`] = `Failed to export ${t}: ${msg}`;
          counts[t] = 0;
        }
      }),
    );

    const today = istDateKey();
    const zipName = `trayi_export_${today}.zip`;
    const zipBytes = await createZip(csvFiles);

    let emailStatus = "sent";
    let emailError: string | null = null;
    try {
      await sendEmail(zipBytes, zipName);
      console.log(`[export-trayi] email sent to ${RECIPIENT}`);
    } catch (e) {
      emailStatus = "failed";
      emailError = e instanceof Error ? e.message : String(e);
      console.error(`[export-trayi] email failed:`, emailError);
    }

    await finishRun(runKey, {
      status: failures.length === 0 && emailStatus === "sent" ? "success" : "partial",
      rows_exported: counts,
      failed_tables: failures,
      email_status: emailStatus,
      email_error: emailError,
    });

    return new Response(zipBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
        "X-Row-Counts": JSON.stringify(counts),
        "X-Run-Key": runKey,
        "X-Failed-Tables": JSON.stringify(failures.map((f) => f.table)),
        "X-Email-Status": emailStatus,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("export-trayi-tables failed:", msg);
    await finishRun(runKey, { status: "failed", email_status: "not_sent", email_error: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});