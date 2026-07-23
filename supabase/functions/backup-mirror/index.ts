import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Backup mirror: forwards row upserts from this project to the external
// backup Supabase project. Called by Postgres triggers via pg_net.
// Write-only for production traffic. Admin-only diagnostics return row counts.

const EXTERNAL_URL = "https://ylvhhlykyojudldcmzou.supabase.co";
const SERVICE_KEY = Deno.env.get("BACKUP_MIRROR_SERVICE_KEY") ?? "";
const SOURCE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SOURCE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Allowlist of columns to mirror per table. Extras are stripped so the
// external table only needs these columns.
const ALLOWED: Record<string, string[]> = {
  customers: [
    "id","customer_code","phone","name","email","date_of_birth","anniversary_date",
    "gender","city","state","country","tier","customer_segment","loyalty_points",
    "store_credit","total_orders","total_spent","preferences","created_at","updated_at",
  ],
  orders: [
    "id","order_number","store_id","customer_id","subtotal","discount_amount",
    "tax_amount","total_amount","payment_method","payment_status","payment_reference",
    "status","order_type","invoice_number","invoice_generated_at","coupon_id",
    "coupon_discount","scheme_ids","loyalty_points_earned","loyalty_points_redeemed",
    "gift_card_id","gift_card_amount","notes","created_by","created_at","updated_at",
  ],
  order_items: [
    "id","order_id","item_id","quantity","unit_price","discount_percent",
    "discount_amount","tax_percent","tax_amount","dia_price","cs_price",
    "making_charges","total_amount","created_at",
  ],
  inventory_items: [
    "id","name","sku","barcode","category","unit","unit_cost","selling_price",
    "min_stock","max_stock","expiry_tracking","status","created_at","updated_at",
    "asset_master_id","vendor_id","rate_validity_date","rate_validity_days",
    "brand","model","warranty","tax_rate","image_url","is_favorite","cost_price",
    "style_no","main_metal","product_size","colour","gross_wt","net_wt",
    "total_diamond_wt","total_colour_stone_wt","material_type","material_quality",
    "material_inter_quality","product_cert_no","product_cert_by","rm_cert_by",
    "rm_cert_no","length","material_weight","material_pcs","item_price","p_amount",
    "category_group","material_rate","tax_master_id",
  ],
  profiles: [
    "id","username","email","role_id","reports_to","status","must_reset_password",
    "profile_photo_url","face_baseline_url","theme_preference","created_at","updated_at",
  ],
  user_roles_master: [
    "id","name","description","status","created_at","updated_at",
  ],
};

function pick(row: Record<string, unknown>, cols: string[]) {
  const out: Record<string, unknown> = {};
  for (const c of cols) if (c in row) out[c] = row[c];
  return out;
}

async function writeAudit(entry: {
  traceId?: string;
  sourceTable: string;
  destinationTable: string;
  rowCount: number;
  status: "success" | "failure";
  httpStatus?: number;
  errorMessage?: string;
}) {
  if (!SOURCE_URL || !SOURCE_SERVICE_KEY) return;

  try {
    await fetch(`${SOURCE_URL}/rest/v1/backup_mirror_audit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SOURCE_SERVICE_KEY,
        Authorization: `Bearer ${SOURCE_SERVICE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        trace_id: entry.traceId ?? null,
        source_table: entry.sourceTable,
        destination_table: entry.destinationTable,
        row_count: entry.rowCount,
        status: entry.status,
        http_status: entry.httpStatus ?? null,
        error_message: entry.errorMessage ?? null,
      }),
    });
  } catch (auditErr) {
    console.error("backup-mirror audit write failed:", auditErr instanceof Error ? auditErr.message : String(auditErr));
  }
}

async function requireAdmin(req: Request) {
  if (!SOURCE_URL || !SOURCE_SERVICE_KEY) throw new Error("source auth not configured");

  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) throw new Error("admin authorization required");

  const userRes = await fetch(`${SOURCE_URL}/auth/v1/user`, {
    headers: {
      apikey: SOURCE_SERVICE_KEY,
      Authorization: authorization,
    },
  });
  if (!userRes.ok) throw new Error("invalid admin authorization");

  const user = await userRes.json();
  const userId = String(user?.id ?? "");
  if (!userId) throw new Error("invalid admin authorization");

  const adminRes = await fetch(`${SOURCE_URL}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SOURCE_SERVICE_KEY,
      Authorization: `Bearer ${SOURCE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ _user_id: userId }),
  });
  if (!adminRes.ok) throw new Error("admin check failed");

  const isAdmin = await adminRes.json();
  if (isAdmin !== true) throw new Error("admin authorization required");
}

async function externalCount(table: string) {
  const res = await fetch(`${EXTERNAL_URL}/rest/v1/trayi_${table}?select=id`, {
    method: "HEAD",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "count=exact",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`external count ${table} ${res.status}: ${text.slice(0, 500)}`);
  }

  const range = res.headers.get("content-range") ?? "0-0/0";
  const total = Number(range.split("/").pop() ?? 0);
  return Number.isFinite(total) ? total : 0;
}

async function getExternalCounts(req: Request) {
  await requireAdmin(req);
  const counts: Record<string, number> = {};
  for (const table of Object.keys(ALLOWED)) counts[`trayi_${table}`] = await externalCount(table);
  return counts;
}

async function forward(table: string, rows: Record<string, unknown>[], traceId?: string) {
  const cols = ALLOWED[table];
  if (!cols) throw new Error(`table not allowlisted: ${table}`);
  const body = rows.map((r) => pick(r, cols));
  const destinationTable = `trayi_${table}`;
  const res = await fetch(`${EXTERNAL_URL}/rest/v1/trayi_${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    const errorMessage = `external ${res.status}: ${text.slice(0, 500)}`;
    await writeAudit({
      traceId,
      sourceTable: table,
      destinationTable,
      rowCount: rows.length,
      status: "failure",
      httpStatus: res.status,
      errorMessage,
    });
    throw new Error(errorMessage);
  }

  await res.text();
  await writeAudit({
    traceId,
    sourceTable: table,
    destinationTable,
    rowCount: rows.length,
    status: "success",
    httpStatus: res.status,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "BACKUP_MIRROR_SERVICE_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();

    if (payload?.action === "external_counts") {
      const counts = await getExternalCounts(req);
      return new Response(JSON.stringify({ ok: true, counts }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const table = String(payload?.table ?? "");
    const traceId = String(payload?.trace_id ?? req.headers.get("x-backup-trace-id") ?? "") || undefined;
    const rows: Record<string, unknown>[] = payload?.rows
      ? payload.rows
      : payload?.row
      ? [payload.row]
      : [];
    if (!table || rows.length === 0) {
      return new Response(JSON.stringify({ error: "table and row(s) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await forward(table, rows, traceId);
    return new Response(JSON.stringify({ ok: true, mirrored: rows.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("backup-mirror failed:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});