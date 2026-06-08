import { useState, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, AlertTriangle, XCircle, Download, Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  downloadCustomerTemplateCSV,
  downloadCustomerTemplateXLSX,
  parseCustomerFile,
  validateCustomerRows,
  downloadCustomerErrorRows,
  type ValidatedCustomerRow,
} from "@/lib/customerImport";

type Step = "download" | "upload" | "validate";
type FilterMode = "all" | "valid" | "warnings" | "invalid";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CHUNK = 50;

export function CustomerImportDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("download");
  const [fileName, setFileName] = useState<string>("");
  const [validating, setValidating] = useState(false);
  const [rows, setRows] = useState<ValidatedCustomerRow[]>([]);
  const [filter, setFilter] = useState<FilterMode>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    let valid = 0, warnings = 0, invalid = 0;
    rows.forEach((r) => {
      const hasErr = r.issues.some((i) => i.severity === "error");
      const hasWarn = r.issues.some((i) => i.severity === "warning");
      if (hasErr) invalid++;
      else if (hasWarn) { valid++; warnings++; }
      else valid++;
    });
    return { total: rows.length, valid, warnings, invalid };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => {
      const hasErr = r.issues.some((i) => i.severity === "error");
      const hasWarn = r.issues.some((i) => i.severity === "warning");
      if (filter === "invalid") return hasErr;
      if (filter === "warnings") return !hasErr && hasWarn;
      if (filter === "valid") return !hasErr;
      return true;
    });
  }, [rows, filter]);

  const reset = () => {
    setStep("download");
    setFileName("");
    setRows([]);
    setFilter("all");
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setValidating(true);
    try {
      const parsed = await parseCustomerFile(file);
      if (parsed.length > 10000) throw new Error("File exceeds 10,000 row hard limit");
      if (parsed.length > 5000) toast.warning(`Large file (${parsed.length} rows) — validation may take a moment`);

      const phones = Array.from(new Set(parsed.map((r) => String(r.phone ?? "").replace(/\s+/g, "")).filter(Boolean)));
      const codes = Array.from(new Set(parsed.map((r) => String(r.customer_code ?? "").trim()).filter(Boolean)));

      const [byPhoneRes, byCodeRes] = await Promise.all([
        phones.length
          ? supabase.from("customers").select("id, phone, customer_code").in("phone", phones)
          : Promise.resolve({ data: [], error: null } as any),
        codes.length
          ? supabase.from("customers").select("customer_code").in("customer_code", codes)
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (byPhoneRes.error) throw byPhoneRes.error;
      if (byCodeRes.error) throw byCodeRes.error;

      const byPhone = new Map<string, { id: string; customer_code: string | null }>();
      (byPhoneRes.data || []).forEach((c: any) => byPhone.set(c.phone, { id: c.id, customer_code: c.customer_code }));
      const existingCodes = new Set<string>((byCodeRes.data || []).map((c: any) => c.customer_code).filter(Boolean));

      const validated = validateCustomerRows(parsed, byPhone, existingCodes);
      setRows(validated);
      setStep("validate");
    } catch (e: any) {
      toast.error(e.message || "Failed to parse file");
    } finally {
      setValidating(false);
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const validRows = rows.filter((r) => r.resolved);
      if (!validRows.length) throw new Error("No valid rows to import");

      let success = 0;
      const failures: { row: number; errors: string[] }[] = [];

      for (let i = 0; i < validRows.length; i += CHUNK) {
        const batch = validRows.slice(i, i + CHUNK);
        for (const r of batch) {
          try {
            const res = r.resolved!;
            const payload: any = {
              customer_code: res.customer_code,
              name: res.name,
              phone: res.phone,
              email: res.email,
              tier: res.tier,
              city: res.city,
              state: res.state,
              country: res.country,
              date_of_birth: res.date_of_birth,
              anniversary_date: res.anniversary_date,
            };
            if (res.existingId) {
              const { error } = await supabase.from("customers").update(payload).eq("id", res.existingId);
              if (error) throw error;
            } else {
              const { error } = await supabase.from("customers").insert(payload);
              if (error) throw error;
            }
            success++;
          } catch (e: any) {
            failures.push({ row: r.rowNumber, errors: [e.message || "Insert failed"] });
          }
        }
      }
      return { success, failures };
    },
    onSuccess: ({ success, failures }) => {
      qc.invalidateQueries({ queryKey: ["transactions-customers"] });
      if (failures.length) {
        toast.warning(`Imported ${success} customers. ${failures.length} failed during insertion.`);
      } else {
        toast.success(`Successfully imported ${success} customers`);
      }
      handleClose(false);
    },
    onError: (e: any) => toast.error(e.message || "Import failed"),
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh]">
        <DialogHeader>
          <DialogTitle>Import Customers</DialogTitle>
          <DialogDescription>
            Step {step === "download" ? 1 : step === "upload" ? 2 : 3} of 3 ·{" "}
            {step === "download" ? "Download template" : step === "upload" ? "Upload file" : "Validate & confirm"}
          </DialogDescription>
        </DialogHeader>

        {step === "download" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Download the template, fill in your customer data, and upload it for validation. Required column: <strong>phone</strong>. If <strong>customer_code</strong> is left blank, it will be auto-generated. Customers with an existing phone will be updated.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={downloadCustomerTemplateCSV} variant="outline">
                <Download className="mr-2 h-4 w-4" /> Download CSV Template
              </Button>
              <Button onClick={downloadCustomerTemplateXLSX} variant="outline">
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Excel Template
              </Button>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button onClick={() => setStep("upload")}>Next: Upload File</Button>
            </div>
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-4 py-2">
            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
              <span><strong>Important:</strong> Delete the sample row from the template before uploading. Only your actual customer data should remain.</span>
            </div>
            <Card
              className="border-dashed border-2 p-10 text-center cursor-pointer hover:bg-muted/30"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">{validating ? "Parsing & validating..." : "Click or drag CSV / XLSX file here"}</p>
              <p className="text-xs text-muted-foreground mt-1">Max 10,000 rows</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </Card>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={downloadCustomerTemplateCSV}>
                <Download className="mr-2 h-3 w-3" /> Template (CSV)
              </Button>
              <Button variant="ghost" size="sm" onClick={downloadCustomerTemplateXLSX}>
                <FileSpreadsheet className="mr-2 h-3 w-3" /> Template (Excel)
              </Button>
            </div>
            <div className="flex justify-between gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setStep("download")}>Back</Button>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {step === "validate" && (
          <div className="flex flex-col gap-3 min-h-0">
            <Card className="p-3 flex flex-wrap items-center gap-3 text-sm bg-muted/30">
              <span className="font-medium">{fileName}</span>
              <Badge variant="secondary">Total: {stats.total}</Badge>
              <Badge className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="mr-1 h-3 w-3" />Valid: {stats.valid}</Badge>
              <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black"><AlertTriangle className="mr-1 h-3 w-3" />Warnings: {stats.warnings}</Badge>
              <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Invalid: {stats.invalid}</Badge>
            </Card>

            <div className="flex flex-wrap gap-1">
              {(["all", "valid", "warnings", "invalid"] as FilterMode[]).map((f) => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize h-7 text-xs">
                  {f}
                </Button>
              ))}
            </div>

            <Card className="overflow-auto max-h-[45vh]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>City / State</TableHead>
                    <TableHead>DOB</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.slice(0, 500).map((r) => {
                    const hasErr = r.issues.some((i) => i.severity === "error");
                    const hasWarn = r.issues.some((i) => i.severity === "warning");
                    return (
                      <TableRow key={r.rowNumber}>
                        <TableCell className="text-xs text-muted-foreground">{r.rowNumber}</TableCell>
                        <TableCell>
                          {hasErr ? <XCircle className="h-4 w-4 text-destructive" />
                            : hasWarn ? <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{r.resolved?.customer_code || r.raw.customer_code || "—"}</TableCell>
                        <TableCell className="text-xs">{r.raw.name || "—"}</TableCell>
                        <TableCell className="text-xs">{r.raw.phone || "—"}</TableCell>
                        <TableCell className="text-xs">{r.raw.email || "—"}</TableCell>
                        <TableCell className="text-xs">{[r.raw.city, r.raw.state].filter(Boolean).join(", ") || "—"}</TableCell>
                        <TableCell className="text-xs">{r.resolved?.date_of_birth ? r.resolved.date_of_birth.split("-").reverse().join("-") : "—"}</TableCell>
                        <TableCell className="text-xs">{r.resolved?.gender || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {r.issues.map((iss, idx) => (
                              <Badge key={idx} variant={iss.severity === "error" ? "destructive" : "secondary"} className="text-[10px] font-normal" title={iss.message}>
                                {iss.message.length > 40 ? iss.message.slice(0, 40) + "…" : iss.message}
                              </Badge>
                            ))}
                            {!r.issues.length && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredRows.length > 500 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-xs text-muted-foreground">
                        Showing first 500 of {filteredRows.length} rows. All rows will be processed on import.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>

            <div className="flex flex-wrap justify-between gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel Import</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => downloadCustomerErrorRows(rows)} disabled={!stats.invalid}>
                  <Download className="mr-2 h-4 w-4" /> Download Error Rows
                </Button>
                <Button onClick={() => importMutation.mutate()} disabled={!stats.valid || importMutation.isPending}>
                  {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Import {stats.valid} Valid Row{stats.valid === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}