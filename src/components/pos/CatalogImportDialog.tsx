import { useState } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { canonicalOptionName, normalizeOptionValue, norm } from "@/lib/catalogOptions";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported?: () => void;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* Header aliasing — matching is case / space / punctuation insensitive. */
const ALIASES = {
  handle: ["handle", "slug", "urlhandle", "producthandle"],
  externalId: ["id", "productid", "shopifyid"],
  title: ["title", "productname", "name", "producttitle"],
  vendor: ["vendor", "brand", "supplier"],
  productType: ["type", "producttype", "category", "productcategory"],
  image: ["imagesrc", "productimage", "image", "imageurl", "imagelink", "variantimage"],
  description: ["bodyhtml", "body", "description", "productdescription"],
  publishedAt: ["publishedat", "published"],
  tags: ["tags", "tag"],
  price: [
    "variantprice",
    "price",
    "sellingprice",
    "sellprice",
    "mrp",
    "rate",
    "amount",
    "offerprice",
    "discountedprice",
    "finalprice",
  ],
  compareAt: [
    "variantcompareatprice",
    "compareatprice",
    "compareprice",
    "listprice",
    "strikethroughprice",
    "originalprice",
  ],
  sku: ["variantsku", "sku", "variantid", "itemcode", "styleno", "stylenumber"],
} as const;

/** Standalone attribute columns that behave like product options. */
const IMPLICIT_OPTION_COLUMNS = [
  "karat",
  "carat",
  "kt",
  "purity",
  "goldpurity",
  "goldkarat",
  "metalpurity",
  "metal",
  "metalcolor",
  "metalcolour",
  "goldcolor",
  "goldcolour",
  "color",
  "colour",
  "size",
  "ringsize",
];

type HeaderMap = Map<string, string>;

function buildHeaderMap(rows: any[]): HeaderMap {
  const m: HeaderMap = new Map();
  const seen = new Set<string>();
  for (const r of rows.slice(0, 25)) {
    for (const k of Object.keys(r)) {
      if (seen.has(k)) continue;
      seen.add(k);
      const n = norm(k);
      if (!m.has(n)) m.set(n, k);
    }
  }
  return m;
}

function makeGetter(hm: HeaderMap) {
  return (row: any, aliases: readonly string[]): string => {
    for (const a of aliases) {
      const real = hm.get(a);
      if (real !== undefined) {
        const v = row[real];
        if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
      }
    }
    return "";
  };
}

const toNumber = (s: string): number | null => {
  if (!s) return null;
  const n = Number(String(s).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) && n !== 0 ? n : null;
};

export type ParsedProduct = Record<string, any>;

export type ParseSummary = {
  products: ParsedProduct[];
  rowCount: number;
  withPrice: number;
  withVariants: number;
  withOptions: number;
  withImage: number;
  unmappedHeaders: string[];
  optionNames: string[];
};

export function parseWorkbookRows(rows: any[]): ParseSummary {
  const hm = buildHeaderMap(rows);
  const get = makeGetter(hm);
  const usedNormHeaders = new Set<string>();
  Object.values(ALIASES).forEach((aliases) =>
    aliases.forEach((a) => hm.has(a) && usedNormHeaders.add(a))
  );

  const optionPairs: { nameKey: string; valueKey: string }[] = [];
  for (let i = 1; i <= 5; i++) {
    const nameKey = hm.get(`option${i}name`);
    const valueKey = hm.get(`option${i}value`);
    if (nameKey && valueKey) {
      optionPairs.push({ nameKey, valueKey });
      usedNormHeaders.add(`option${i}name`);
      usedNormHeaders.add(`option${i}value`);
    }
  }

  const implicitCols: { canonical: string; key: string }[] = [];
  for (const c of IMPLICIT_OPTION_COLUMNS) {
    const real = hm.get(c);
    if (real && !usedNormHeaders.has(c)) {
      implicitCols.push({ canonical: canonicalOptionName(real), key: real });
      usedNormHeaders.add(c);
    }
  }

  const grouped = new Map<string, ParsedProduct>();
  const optionNames = new Set<string>();

  for (const r of rows) {
    const title = get(r, ALIASES.title);
    let handle = get(r, ALIASES.handle);
    if (!handle && title) handle = slugify(title);
    if (!handle) continue;

    let prod = grouped.get(handle);
    if (!prod) {
      prod = {
        shopify_id: get(r, ALIASES.externalId) || null,
        handle,
        title,
        vendor: get(r, ALIASES.vendor) || null,
        product_type: get(r, ALIASES.productType) || null,
        image_url: get(r, ALIASES.image) || null,
        description: get(r, ALIASES.description) || null,
        display_price: null,
        base_price: null,
        compare_at_price: null,
        published_at: get(r, ALIASES.publishedAt) || null,
        tags: get(r, ALIASES.tags)
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        options: {} as Record<string, string[]>,
        variants: [] as any[],
      };
      grouped.set(handle, prod);
    }

    if (!prod.title && title) prod.title = title;
    if (!prod.image_url) prod.image_url = get(r, ALIASES.image) || null;
    if (!prod.vendor) prod.vendor = get(r, ALIASES.vendor) || null;
    if (!prod.product_type) prod.product_type = get(r, ALIASES.productType) || null;
    if (!prod.description) prod.description = get(r, ALIASES.description) || null;

    const rowOptions: { name: string; value: string }[] = [];
    for (const { nameKey, valueKey } of optionPairs) {
      const rawName = String(r[nameKey] ?? "").trim();
      const rawVal = String(r[valueKey] ?? "").trim();
      if (!rawName || !rawVal || norm(rawVal) === "defaulttitle") continue;
      const canonical = canonicalOptionName(rawName);
      rowOptions.push({ name: canonical, value: normalizeOptionValue(canonical, rawVal) });
    }
    for (const { canonical, key } of implicitCols) {
      const rawVal = String(r[key] ?? "").trim();
      if (!rawVal) continue;
      if (rowOptions.some((o) => o.name === canonical)) continue;
      rowOptions.push({ name: canonical, value: normalizeOptionValue(canonical, rawVal) });
    }

    for (const { name, value } of rowOptions) {
      optionNames.add(name);
      prod.options[name] = prod.options[name] ?? [];
      if (!prod.options[name].includes(value)) prod.options[name].push(value);
    }

    const vprice = toNumber(get(r, ALIASES.price));
    const vcompare = toNumber(get(r, ALIASES.compareAt));
    const sku = get(r, ALIASES.sku) || null;

    if (vprice != null || rowOptions.length) {
      const v: any = { variant_id: sku };
      if (vprice != null) v.price = vprice;
      if (vcompare != null) v.compare_at_price = vcompare;
      for (const { name, value } of rowOptions) v[name.toLowerCase()] = value;
      prod.variants.push(v);
    }
    if (vprice != null && (prod.base_price == null || vprice < prod.base_price)) {
      prod.base_price = vprice;
    }
    if (vcompare != null && (prod.compare_at_price == null || vcompare > prod.compare_at_price)) {
      prod.compare_at_price = vcompare;
    }
  }

  const products = Array.from(grouped.values())
    .filter((p) => p.title)
    .map((p) => {
      if (p.base_price != null) {
        p.display_price =
          p.compare_at_price && p.compare_at_price > p.base_price
            ? `${p.base_price.toFixed(2)} (Was ${p.compare_at_price.toFixed(2)})`
            : `${p.base_price.toFixed(2)}`;
      }
      return p;
    });

  return {
    products,
    rowCount: rows.length,
    withPrice: products.filter((p) => p.base_price != null).length,
    withVariants: products.filter((p) => p.variants.length > 0).length,
    withOptions: products.filter((p) => Object.keys(p.options).length > 0).length,
    withImage: products.filter((p) => !!p.image_url).length,
    unmappedHeaders: Array.from(hm.entries())
      .filter(([n]) => !usedNormHeaders.has(n))
      .map(([, real]) => real),
    optionNames: Array.from(optionNames),
  };
}

/** Remove keys carrying no information so an upsert can never blank existing data. */
function stripEmpty(p: ParsedProduct): ParsedProduct {
  const out: ParsedProduct = {};
  for (const [k, v] of Object.entries(p)) {
    if (v == null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    out[k] = v;
  }
  return out;
}

/** Group rows by key signature so PostgREST never fills gaps with NULLs. */
function groupBySignature(products: ParsedProduct[]) {
  const groups = new Map<string, ParsedProduct[]>();
  for (const p of products) {
    const clean = stripEmpty(p);
    const sig = Object.keys(clean).sort().join("|");
    const arr = groups.get(sig) ?? [];
    arr.push(clean);
    groups.set(sig, arr);
  }
  return Array.from(groups.values());
}

export default function CatalogImportDialog({ open, onOpenChange, onImported }: Props) {
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ParseSummary | null>(null);
  const [fileName, setFileName] = useState("");
  const [done, setDone] = useState<number | null>(null);

  const reset = () => {
    setSummary(null);
    setFileName("");
    setDone(null);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setDone(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
      const parsed = parseWorkbookRows(rows);
      if (!parsed.products.length) {
        toast.error("No valid products found in the file");
        return;
      }
      setFileName(file.name);
      setSummary(parsed);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message ?? "Could not read the file");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const runImport = async () => {
    if (!summary) return;
    setBusy(true);
    try {
      let processed = 0;
      for (const group of groupBySignature(summary.products)) {
        for (let i = 0; i < group.length; i += 400) {
          const chunk = group.slice(i, i + 400);
          const { error } = await supabase
            .from("catalog_products")
            .upsert(chunk as any, { onConflict: "handle" });
          if (error) throw error;
          processed += chunk.length;
        }
      }
      setDone(processed);
      toast.success(`Imported ${processed} products`);
      onImported?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const priceWarning = summary && summary.withPrice === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Catalog</DialogTitle>
          <DialogDescription>
            Upload a products CSV/XLSX export. Rows are grouped by <b>Handle</b>; variants, karat and
            colour options are merged per product. Columns missing from the file are never
            overwritten on existing products.
          </DialogDescription>
        </DialogHeader>

        {!summary && (
          <label className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border py-10 cursor-pointer hover:bg-muted/50">
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-6 w-6 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">
              {busy ? "Reading file..." : "Click to choose a .csv or .xlsx file"}
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              disabled={busy}
              onChange={handleFile}
            />
          </label>
        )}

        {summary && (
          <div className="space-y-4 text-sm">
            <div className="rounded-md border border-border p-3">
              <p className="font-medium">{fileName}</p>
              <p className="text-muted-foreground">
                {summary.rowCount} rows → {summary.products.length} products
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "With price", value: summary.withPrice },
                { label: "With variants", value: summary.withVariants },
                { label: "With options", value: summary.withOptions },
                { label: "With image", value: summary.withImage },
              ].map((s) => (
                <div key={s.label} className="rounded-md bg-muted/50 p-3">
                  <div className="text-lg font-semibold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>

            {summary.optionNames.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Options detected</p>
                <div className="flex flex-wrap gap-1">
                  {summary.optionNames.map((o) => (
                    <Badge key={o} variant="secondary">
                      {o}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {priceWarning && (
              <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">No prices were detected</p>
                  <p className="text-xs text-muted-foreground">
                    Existing prices will be left untouched, but the new products will have no price.
                    Check that your file has a price column.
                  </p>
                </div>
              </div>
            )}

            {summary.unmappedHeaders.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Unmapped columns (ignored)
                </p>
                <p className="text-xs text-muted-foreground">{summary.unmappedHeaders.join(", ")}</p>
              </div>
            )}

            {done != null && (
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-4 w-4" />
                <span>Imported {done} product(s).</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {summary && done == null && (
            <Button variant="ghost" onClick={reset} disabled={busy}>
              Choose another file
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          {summary && done == null && (
            <Button onClick={runImport} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm import
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}