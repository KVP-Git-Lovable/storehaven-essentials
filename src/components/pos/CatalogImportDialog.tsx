import { useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2 } from "lucide-react";

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

/** Parse rows from Shopify-style export into catalog_products rows. */
function parseRows(rows: any[]) {
  const grouped = new Map<string, any>();

  for (const r of rows) {
    const handle = String(r["Handle"] ?? "").trim();
    if (!handle) continue;

    let prod = grouped.get(handle);
    if (!prod) {
      prod = {
        shopify_id: String(r["ID"] ?? r["Id"] ?? "").trim() || null,
        handle,
        title: String(r["Title"] ?? "").trim(),
        vendor: String(r["Vendor"] ?? "").trim() || null,
        product_type: String(r["Type"] ?? r["Product Type"] ?? "").trim() || null,
        image_url: String(r["Image Src"] ?? r["Product Image"] ?? "").trim() || null,
        description: String(r["Body (HTML)"] ?? r["Body HTML"] ?? "").trim() || null,
        display_price: null as string | null,
        base_price: null as number | null,
        compare_at_price: null as number | null,
        published_at: r["Published At"] ? String(r["Published At"]) : null,
        tags: String(r["Tags"] ?? "")
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean),
        options: {} as Record<string, string[]>,
        variants: [] as any[],
      };
      grouped.set(handle, prod);
    }

    // options: "Option1 Name" + "Option1 Value" style
    for (const idx of [1, 2, 3]) {
      const name = String(r[`Option${idx} Name`] ?? "").trim();
      const val = String(r[`Option${idx} Value`] ?? "").trim();
      if (name && val) {
        prod.options[name] = prod.options[name] ?? [];
        if (!prod.options[name].includes(val)) prod.options[name].push(val);
      }
    }

    // variant row
    const vprice = Number(r["Variant Price"] ?? r["Price"] ?? 0);
    const vcompare = Number(r["Variant Compare At Price"] ?? r["Compare At Price"] ?? 0) || null;
    if (vprice) {
      const v: any = {
        variant_id: String(r["Variant SKU"] ?? r["Variant ID"] ?? "").trim() || null,
        price: vprice,
      };
      for (const idx of [1, 2, 3]) {
        const name = String(r[`Option${idx} Name`] ?? "").trim();
        const val = String(r[`Option${idx} Value`] ?? "").trim();
        if (name) v[name.toLowerCase()] = val;
      }
      prod.variants.push(v);
      if (prod.base_price == null || vprice < prod.base_price) prod.base_price = vprice;
      if (vcompare && (prod.compare_at_price == null || vcompare > prod.compare_at_price)) {
        prod.compare_at_price = vcompare;
      }
    }

    // simple image fallback
    if (!prod.image_url && r["Image Src"]) prod.image_url = String(r["Image Src"]);
  }

  // Finalise
  const list = Array.from(grouped.values())
    .filter((p) => p.title)
    .map((p) => {
      if (!p.handle) p.handle = slugify(p.title);
      if (p.base_price != null) {
        p.display_price =
          p.compare_at_price && p.compare_at_price > p.base_price
            ? `${p.base_price.toFixed(2)} (Was ${p.compare_at_price.toFixed(2)})`
            : `${p.base_price.toFixed(2)}`;
      }
      return p;
    });

  return list;
}

export default function CatalogImportDialog({ open, onOpenChange, onImported }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; updated: number } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
      const products = parseRows(rows);
      if (!products.length) {
        toast.error("No valid products found in the file");
        return;
      }
      const { error, count } = await supabase
        .from("catalog_products")
        .upsert(products, { onConflict: "handle", count: "exact" });
      if (error) throw error;
      setResult({ inserted: count ?? products.length, updated: 0 });
      toast.success(`Imported ${products.length} products`);
      onImported?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message ?? "Import failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Catalog</DialogTitle>
          <DialogDescription>
            Upload a Shopify-style products CSV/XLSX export. Rows are grouped by <b>Handle</b>;
            variants and options are merged per product.
          </DialogDescription>
        </DialogHeader>

        <label className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border py-10 cursor-pointer hover:bg-muted/50">
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-6 w-6 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {busy ? "Importing..." : "Click to choose a .csv or .xlsx file"}
          </span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            disabled={busy}
            onChange={handleFile}
          />
        </label>

        {result && (
          <p className="text-sm text-muted-foreground">
            Processed {result.inserted} product(s).
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}