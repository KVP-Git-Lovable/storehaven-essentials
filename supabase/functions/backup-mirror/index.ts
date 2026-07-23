// Backup mirror: forwards row upserts from this project to the external
// backup Supabase project. Called by Postgres triggers via pg_net.
// Write-only — never reads back. Failures are logged, never thrown to the caller.

const EXTERNAL_URL = "https://ylvhhlykyojudldcmzou.supabase.co";
const SERVICE_KEY = Deno.env.get("BACKUP_MIRROR_SERVICE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function forward(table: string, rows: Record<string, unknown>[]) {
  const cols = ALLOWED[table];
  if (!cols) throw new Error(`table not allowlisted: ${table}`);
  const body = rows.map((r) => pick(r, cols));
  const res = await fetch(`${EXTERNAL_URL}/rest/v1/${table}`, {
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
    throw new Error(`external ${res.status}: ${text.slice(0, 500)}`);
  }
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
    const table = String(payload?.table ?? "");
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

    await forward(table, rows);
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