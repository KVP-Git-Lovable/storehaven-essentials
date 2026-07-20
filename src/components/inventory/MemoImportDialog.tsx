import { useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  onImported: () => void;
}

const COLS = [
  "Item No","Style No","Category","Main Metal","Product Size","Colour",
  "Gross Wt","Net Wt","Total Diamond Wt.","Total Color Stone Wt.",
  "Material Type","Material Quality","Material Inter. Quality",
  "Product CERTNO","Product Cert By","Rm Cert By","Rm Cert NO",
  "Length","Material Weight","Material Pcs","Item Price","P amount",
  "Category Group","material rate",
];

const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
};
const str = (v: any): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

export function MemoImportDialog({ onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<{ imported: number; updated: number; skipped: number; reasons: string[] } | null>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([COLS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Memo Inward");
    XLSX.writeFile(wb, "memo_inward_template.xlsx");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setSummary(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      // Load categories for name-based mapping (case-insensitive)
      const { data: cats, error: catErr } = await supabase
        .from("categories")
        .select("name")
        .in("type", ["product", "spare-parts"]);
      if (catErr) throw catErr;
      const catByLower = new Map<string, string>();
      (cats || []).forEach((c: any) => catByLower.set(String(c.name).toLowerCase(), c.name));

      let imported = 0, updated = 0, skipped = 0;
      const reasons: string[] = [];

      for (const r of rows) {
        const itemNo = str(r["Item No"]);
        if (!itemNo) { skipped++; continue; }
        const excelCat = str(r["Category"]);
        const mappedCat = excelCat ? catByLower.get(excelCat.toLowerCase()) : null;
        if (!mappedCat) {
          skipped++;
          reasons.push(`${itemNo}: category "${excelCat ?? ""}" not found in Category Master`);
          continue;
        }
        const mainMetal = str(r["Main Metal"]) || "";
        const name = `${mainMetal} ${mappedCat}`.trim();
        const price = num(r["Item Price"]) ?? 0;

        const payload: any = {
          name,
          sku: itemNo,
          barcode: itemNo,
          category: mappedCat,
          unit: "pcs",
          status: "active",
          selling_price: price,
          style_no: str(r["Style No"]),
          main_metal: str(r["Main Metal"]),
          product_size: str(r["Product Size"]),
          colour: str(r["Colour"]),
          gross_wt: num(r["Gross Wt"]),
          net_wt: num(r["Net Wt"]),
          total_diamond_wt: num(r["Total Diamond Wt."]),
          total_colour_stone_wt: num(r["Total Color Stone Wt."]),
          material_type: str(r["Material Type"]),
          material_quality: str(r["Material Quality"]),
          material_inter_quality: str(r["Material Inter. Quality"]),
          product_cert_no: str(r["Product CERTNO"]),
          product_cert_by: str(r["Product Cert By"]),
          rm_cert_by: str(r["Rm Cert By"]),
          rm_cert_no: str(r["Rm Cert NO"]),
          length: num(r["Length"]),
          material_weight: num(r["Material Weight"]),
          material_pcs: num(r["Material Pcs"]),
          item_price: price,
          p_amount: num(r["P amount"]),
          category_group: str(r["Category Group"]),
          material_rate: num(r["material rate"]),
        };

        // Check if SKU exists
        const { data: existing } = await supabase
          .from("inventory_items")
          .select("id")
          .eq("sku", itemNo)
          .maybeSingle();

        if (existing?.id) {
          const { error } = await supabase.from("inventory_items").update(payload).eq("id", existing.id);
          if (error) { skipped++; reasons.push(`${itemNo}: ${error.message}`); }
          else updated++;
        } else {
          const { error } = await supabase.from("inventory_items").insert([{ ...payload, unit_cost: 0, min_stock: 0 }]);
          if (error) { skipped++; reasons.push(`${itemNo}: ${error.message}`); }
          else imported++;
        }
      }

      setSummary({ imported, updated, skipped, reasons: reasons.slice(0, 20) });
      toast.success(`Import complete: ${imported} added, ${updated} updated, ${skipped} skipped`);
      onImported();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Memo Inward
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Memo Inward</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a .csv or .xlsx file in the Trayi Jewellers memo format. Rows without an <b>Item No</b> are ignored.
            <br />SKU/Barcode = Item No · Item Name = Main Metal + Category · Category must exist in Category Master.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" /> Download Template
            </Button>
            <label className="inline-flex">
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} disabled={busy} />
              <span className={`inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 ${busy ? "opacity-60 pointer-events-none" : ""}`}>
                <Upload className="h-4 w-4" /> {busy ? "Importing..." : "Choose File"}
              </span>
            </label>
          </div>
          {summary && (
            <div className="rounded-md border p-3 text-sm space-y-2">
              <div><b>Imported:</b> {summary.imported} · <b>Updated:</b> {summary.updated} · <b>Skipped:</b> {summary.skipped}</div>
              {summary.reasons.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-muted-foreground">Skipped details</summary>
                  <ul className="mt-2 max-h-40 overflow-auto list-disc pl-5 text-xs">
                    {summary.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}