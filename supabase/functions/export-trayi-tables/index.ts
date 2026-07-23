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

  try {
    const results = await Promise.all(
      TABLES.map(async (t) => [t, await fetchTable(t, serviceKey)] as const),
    );

    const csvFiles: Record<string, string> = {};
    const counts: Record<string, number> = {};
    for (const [name, rows] of results) {
      csvFiles[`${name}.csv`] = convertToCSV(rows);
      counts[name] = rows.length;
    }

    const today = new Date().toISOString().slice(0, 10);
    const zipName = `trayi_export_${today}.zip`;
    const zipBytes = await createZip(csvFiles);

    await sendEmail(zipBytes, zipName);

    return new Response(zipBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
        "X-Row-Counts": JSON.stringify(counts),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("export-trayi-tables failed:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});