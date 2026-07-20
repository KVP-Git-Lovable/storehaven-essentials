import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, RefreshCw, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subDays, subWeeks, subMonths, subQuarters, startOfDay, endOfDay } from "date-fns";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useInvoiceTemplate } from "@/hooks/useInvoiceTemplate";
import * as XLSX from "xlsx";

type ReportType = "orders" | "customers" | "leads" | "products";

type QuickRange =
  | "today" | "yesterday" | "this_week" | "this_month" | "this_quarter" | "this_fy"
  | "last_week" | "last_month" | "last_quarter" | "last_fy" | "last_60" | "all";

const QUICK_RANGES: { value: QuickRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_fy", label: "This FY" },
  { value: "last_week", label: "Last Week" },
  { value: "last_month", label: "Last Month" },
  { value: "last_quarter", label: "Last Quarter" },
  { value: "last_fy", label: "Last FY" },
  { value: "last_60", label: "Last 60 Days" },
  { value: "all", label: "All Time" },
];

function fyStart(d: Date) {
  // Indian FY: Apr 1 – Mar 31
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return new Date(y, 3, 1);
}
function fyEnd(d: Date) {
  const s = fyStart(d);
  return new Date(s.getFullYear() + 1, 2, 31, 23, 59, 59, 999);
}

function resolveRange(q: QuickRange): { from: Date | null; to: Date | null } {
  const now = new Date();
  switch (q) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": { const y = subDays(now, 1); return { from: startOfDay(y), to: endOfDay(y) }; }
    case "this_week": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "this_month": return { from: startOfMonth(now), to: endOfMonth(now) };
    case "this_quarter": return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "this_fy": return { from: fyStart(now), to: fyEnd(now) };
    case "last_week": { const p = subWeeks(now, 1); return { from: startOfWeek(p, { weekStartsOn: 1 }), to: endOfWeek(p, { weekStartsOn: 1 }) }; }
    case "last_month": { const p = subMonths(now, 1); return { from: startOfMonth(p), to: endOfMonth(p) }; }
    case "last_quarter": { const p = subQuarters(now, 1); return { from: startOfQuarter(p), to: endOfQuarter(p) }; }
    case "last_fy": { const p = new Date(now.getFullYear() - 1, now.getMonth(), 1); return { from: fyStart(p), to: fyEnd(p) }; }
    case "last_60": return { from: startOfDay(subDays(now, 60)), to: endOfDay(now) };
    case "all": return { from: null, to: null };
  }
}

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);
const num = (n: number, d = 2) => (Number(n) || 0).toFixed(d);

type OrderRow = {
  invoice_date: string;
  invoice_no: string;
  customer: string;
  category: string;
  item_no: string;
  gross_wt: number;
  metal_wt: number;
  dia_wt: number;
  dia_pcs: number;
  quantity: number;
  amount: number;      // pre-tax line amount
  discount: number;
  net_amount: number;  // amount - discount
  tax: number;
  gross_amount: number; // net_amount + tax
};

export default function Reports() {
  const { data: company } = useCompanyInfo();
  const { data: template } = useInvoiceTemplate();
  const [reportType, setReportType] = useState<ReportType>("orders");
  const [quick, setQuick] = useState<QuickRange>("this_month");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const activeRange = useMemo(() => {
    if (fromDate || toDate) {
      return {
        from: fromDate ? startOfDay(new Date(fromDate)) : null,
        to: toDate ? endOfDay(new Date(toDate)) : null,
      };
    }
    return resolveRange(quick);
  }, [quick, fromDate, toDate]);

  const rangeLabel = useMemo(() => {
    if (fromDate || toDate) return `${fromDate || "…"} to ${toDate || "…"}`;
    return QUICK_RANGES.find((r) => r.value === quick)?.label ?? "";
  }, [quick, fromDate, toDate]);

  // Intra-state orders use SGST + CGST (IGST is inter-state and not applied here — matches Invoice/View Order).
  const taxRate = (Number(template?.sgst_rate) || 0) + (Number(template?.cgst_rate) || 0);

  const { data: rows = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["report-orders", activeRange.from?.toISOString(), activeRange.to?.toISOString(), taxRate],
    enabled: reportType === "orders",
    queryFn: async () => {
      let q: any = supabase
        .from("orders")
        .select("id, order_number, invoice_number, invoice_generated_at, created_at, status, discount_amount, subtotal, total_amount, tax_amount, customer_id, customers(name)")
        .neq("status", "cancelled")
        .order("created_at", { ascending: true })
        .range(0, 9999);
      if (activeRange.from) q = q.gte("created_at", activeRange.from.toISOString());
      if (activeRange.to) q = q.lte("created_at", activeRange.to.toISOString());
      const { data: orders, error } = await q;
      if (error) throw error;
      const orderIds = (orders || []).map((o: any) => o.id);
      if (!orderIds.length) return [] as OrderRow[];

      const { data: items } = await supabase
        .from("order_items")
        .select("order_id, quantity, unit_price, total_amount, item_id, dia_price, cs_price, making_charges, tax_amount")
        .in("order_id", orderIds);

      const itemIds = Array.from(new Set((items || []).map((i: any) => i.item_id).filter(Boolean)));
      const invMap: Record<string, any> = {};
      if (itemIds.length) {
        const { data: inv } = await (supabase as any)
          .from("inventory_items")
          .select("id, sku, main_metal, category, gross_wt, net_wt, total_diamond_wt, material_pcs, name")
          .in("id", itemIds);
        (inv || []).forEach((r: any) => { invMap[r.id] = r; });
      }

      const orderMap = new Map((orders || []).map((o: any) => [o.id, o]));
      const orderItemCount = new Map<string, number>();
      (items || []).forEach((i: any) => orderItemCount.set(i.order_id, (orderItemCount.get(i.order_id) || 0) + 1));

      const out: OrderRow[] = (items || []).map((it: any) => {
        const o: any = orderMap.get(it.order_id) || {};
        const inv = invMap[it.item_id] || {};
        const qty = Number(it.quantity) || 1;
        const line = Number(it.total_amount) || Number(it.unit_price) * qty || 0;
        // Distribute order-level discount and tax across lines
        const cnt = orderItemCount.get(it.order_id) || 1;
        const discount = (Number(o.discount_amount) || 0) / cnt;
        // Prefer the item's stored tax; fall back to order-level tax distributed by line; else compute from template.
        const itemTax = Number(it.tax_amount) || 0;
        const orderTax = Number(o.tax_amount) || 0;
        const tax = itemTax > 0
          ? itemTax
          : orderTax > 0
            ? orderTax / cnt
            : ((line - discount) * (taxRate / 100));
        const net = line - discount;
        const gross = net + tax;
        const customerName = o.customers?.name || "Walk-in Customer";
        const category = String(inv.category || "").trim();
        return {
          invoice_date: o.invoice_generated_at || o.created_at,
          invoice_no: o.invoice_number || o.order_number || "—",
          customer: customerName,
          category: category || (inv.name || ""),
          item_no: inv.sku || "",
          gross_wt: Number(inv.gross_wt) || 0,
          metal_wt: Number(inv.net_wt) || 0,
          dia_wt: Number(inv.total_diamond_wt) || 0,
          dia_pcs: Number(inv.material_pcs) || 0,
          quantity: qty,
          amount: line,
          discount,
          net_amount: net,
          tax,
          gross_amount: gross,
        };
      });

      out.sort((a, b) => a.customer.localeCompare(b.customer) || a.invoice_date.localeCompare(b.invoice_date));
      return out;
    },
  });

  // Group by customer
  const groups = useMemo(() => {
    const g = new Map<string, OrderRow[]>();
    rows.forEach((r) => {
      if (!g.has(r.customer)) g.set(r.customer, []);
      g.get(r.customer)!.push(r);
    });
    return g;
  }, [rows]);

  const grand = useMemo(() => {
    return rows.reduce((acc, r) => ({
      gross_wt: acc.gross_wt + r.gross_wt,
      metal_wt: acc.metal_wt + r.metal_wt,
      dia_wt: acc.dia_wt + r.dia_wt,
      dia_pcs: acc.dia_pcs + r.dia_pcs,
      quantity: acc.quantity + r.quantity,
      amount: acc.amount + r.amount,
      discount: acc.discount + r.discount,
      net_amount: acc.net_amount + r.net_amount,
      tax: acc.tax + r.tax,
      gross_amount: acc.gross_amount + r.gross_amount,
    }), { gross_wt: 0, metal_wt: 0, dia_wt: 0, dia_pcs: 0, quantity: 0, amount: 0, discount: 0, net_amount: 0, tax: 0, gross_amount: 0 });
  }, [rows]);

  const columns = [
    "Invoice Date", "Invoice #", "Customer", "Category", "Item #",
    "Gross Wt", "Metal Wt", "Dia Wt", "Dia Pcs", "Quantity",
    "Amount", "Discount", "Net Amount", "Total Tax", "Gross Amount",
  ];

  const buildExportRows = () => {
    const aoa: (string | number)[][] = [columns];
    groups.forEach((list, cust) => {
      aoa.push([cust]);
      const tot = { gw: 0, mw: 0, dw: 0, dp: 0, qt: 0, am: 0, dc: 0, na: 0, tx: 0, ga: 0 };
      list.forEach((r) => {
        aoa.push([
          format(new Date(r.invoice_date), "dd/MM/yyyy"),
          r.invoice_no, r.customer, r.category, r.item_no,
          num(r.gross_wt, 3), num(r.metal_wt, 3), num(r.dia_wt, 3), r.dia_pcs, r.quantity,
          num(r.amount), num(r.discount), num(r.net_amount), num(r.tax), num(r.gross_amount),
        ]);
        tot.gw += r.gross_wt; tot.mw += r.metal_wt; tot.dw += r.dia_wt; tot.dp += r.dia_pcs;
        tot.qt += r.quantity; tot.am += r.amount; tot.dc += r.discount; tot.na += r.net_amount;
        tot.tx += r.tax; tot.ga += r.gross_amount;
      });
      aoa.push([
        `Total For ${cust}`, "", "", "", "",
        num(tot.gw, 3), num(tot.mw, 3), num(tot.dw, 3), tot.dp, tot.qt,
        num(tot.am), num(tot.dc), num(tot.na), num(tot.tx), num(tot.ga),
      ]);
    });
    aoa.push([
      "Grand Total", "", "", "", "",
      num(grand.gross_wt, 3), num(grand.metal_wt, 3), num(grand.dia_wt, 3), grand.dia_pcs, grand.quantity,
      num(grand.amount), num(grand.discount), num(grand.net_amount), num(grand.tax), num(grand.gross_amount),
    ]);
    return aoa;
  };

  const exportCSV = () => {
    const aoa = buildExportRows();
    const csv = aoa.map((row) => row.map((c) => {
      const s = String(c ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `orders-report-${Date.now()}.csv`);
  };

  const exportXLSX = () => {
    const aoa = buildExportRows();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders Report");
    XLSX.writeFile(wb, `orders-report-${Date.now()}.xlsx`);
  };

  const exportPDF = () => {
    const aoa = buildExportRows();
    if (!aoa || aoa.length === 0) return;
    const header = aoa[0] as string[];
    const body = aoa.slice(1);
    const rightAligned = new Set(["Gross Wt","Metal Wt","Dia Wt","Dia Pcs","Quantity","Amount","Discount","Net Amount","Total Tax","Gross Amount"]);
    const rightIdx = header.map((h) => rightAligned.has(h));
    const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]!));
    const title = `Orders Report ${activeRange.from ? format(activeRange.from, "dd/MM/yyyy") : "—"} to ${activeRange.to ? format(activeRange.to, "dd/MM/yyyy") : "—"}`;
    const rowsHtml = body.map((row) => {
      const first = String(row[0] ?? "");
      const isCustomerHeader = row.slice(1).every((c) => c === "" || c === undefined) && first !== "";
      const isSubtotal = /^Total For /.test(first);
      const isGrand = first === "Grand Total";
      if (isCustomerHeader) {
        return `<tr class="cust"><td colspan="${header.length}">${esc(first)}</td></tr>`;
      }
      const cls = isGrand ? "grand" : isSubtotal ? "subtotal" : "";
      const tds = row.map((c, i) => `<td class="${rightIdx[i] ? "r" : ""}">${esc(c)}</td>`).join("");
      return `<tr class="${cls}">${tds}</tr>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(title)}</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:16px;}
        h1{font-size:16px;margin:0 0 4px;text-align:center;text-transform:uppercase}
        .sub{font-size:11px;text-align:center;color:#444;margin-bottom:10px}
        table{width:100%;border-collapse:collapse;font-size:10px}
        th,td{border:1px solid #999;padding:3px 5px;vertical-align:top}
        th{background:#eee;text-align:left;font-weight:600}
        td.r,th.r{text-align:right}
        tr.cust td{background:#f3f4f6;font-weight:700}
        tr.subtotal td{background:#f9fafb;font-weight:600}
        tr.grand td{background:#e5e7eb;font-weight:700;border-top:2px solid #111}
        @page{size:A4 landscape;margin:10mm}
      </style></head><body>
      <h1>${esc(company?.company_name || "Company")}</h1>
      <div class="sub">${esc(title)}</div>
      <table><thead><tr>${header.map((h,i)=>`<th class="${rightIdx[i]?"r":""}">${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${rowsHtml}</tbody></table>
      <script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  return (
    <div className="space-y-6 reports-page">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .reports-page { padding: 0 !important; }
          .screen-only { display: none !important; }
          .print-only { display: block !important; }
          .print-table { font-size: 10px !important; }
          .print-table td, .print-table th { padding: 2px 6px !important; }
        }
        @media screen { .print-only { display: none !important; } }
      `}</style>
      <div className="flex items-start justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">View and export transaction reports.</p>
        </div>
      </div>

      <Card className="p-4 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Report</label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="orders">Orders</SelectItem>
                <SelectItem value="customers">Customers</SelectItem>
                <SelectItem value="leads">Leads</SelectItem>
                <SelectItem value="products">Products</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Quick range</label>
            <Select value={fromDate || toDate ? "" : quick} onValueChange={(v) => { setQuick(v as QuickRange); setFromDate(""); setToDate(""); }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select range" /></SelectTrigger>
              <SelectContent>
                {QUICK_RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <span className="text-sm text-muted-foreground pb-2">OR</span>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[160px]" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[160px]" />
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button><Download className="mr-2 h-4 w-4" /> Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportXLSX}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportCSV}><FileText className="mr-2 h-4 w-4" /> CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDF}><FileType className="mr-2 h-4 w-4" /> PDF (Print)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

      {reportType !== "orders" ? (
        <Card className="p-12 text-center text-muted-foreground">This report is coming soon.</Card>
      ) : (
        <Card className="p-4 print:shadow-none print:border-0">
          <div className="text-center mb-4">
            <h2 className="text-lg font-bold uppercase">{company?.company_name || "Company"}</h2>
            {company?.address_line1 && (
              <div className="text-xs text-muted-foreground">
                {[company.address_line1, company.address_line2, company.city, company.state, company.postal_code].filter(Boolean).join(", ")}
              </div>
            )}
            <div className="text-sm font-semibold mt-2">Sales INV Report – RT WITH TAX</div>
            <div className="text-xs text-muted-foreground">{rangeLabel}</div>
          </div>

          {/* Screen-only modern list layout */}
          <div className="screen-only">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No orders in the selected range.</div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-muted-foreground">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap">Invoice Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap">Invoice #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap">Item #</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide whitespace-nowrap">Gross Wt</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide whitespace-nowrap">Metal Wt</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide whitespace-nowrap">Dia Wt</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide whitespace-nowrap">Dia Pcs</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide whitespace-nowrap">Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide whitespace-nowrap">Amount</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide whitespace-nowrap">Discount</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide whitespace-nowrap">Net Amount</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide whitespace-nowrap">Tax</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide whitespace-nowrap">Gross Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {Array.from(groups.entries()).map(([cust, list]) => {
                        const tot = list.reduce((a, r) => ({
                          gw: a.gw + r.gross_wt, mw: a.mw + r.metal_wt, dw: a.dw + r.dia_wt, dp: a.dp + r.dia_pcs,
                          qt: a.qt + r.quantity, am: a.am + r.amount, dc: a.dc + r.discount, na: a.na + r.net_amount,
                          tx: a.tx + r.tax, ga: a.ga + r.gross_amount,
                        }), { gw:0, mw:0, dw:0, dp:0, qt:0, am:0, dc:0, na:0, tx:0, ga:0 });
                        return (
                          <Fragment key={`s-${cust}`}>
                            <tr className="bg-muted/20">
                              <td colSpan={14} className="px-4 py-2 font-semibold text-sm uppercase tracking-wide">{cust}</td>
                            </tr>
                            {list.map((r, i) => (
                              <tr key={`s-${cust}-${i}`} className="hover:bg-muted/10 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                    {format(new Date(r.invoice_date), "dd MMM, HH:mm")}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{r.invoice_no}</td>
                                <td className="px-4 py-3 whitespace-nowrap">{r.category}</td>
                                <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{r.item_no}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{num(r.gross_wt, 3)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{num(r.metal_wt, 3)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{num(r.dia_wt, 3)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{r.dia_pcs}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{r.quantity}</td>
                                <td className="px-4 py-3 text-right tabular-nums">₹{num(r.amount)}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{num(r.discount)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">₹{num(r.net_amount)}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{num(r.tax)}</td>
                                <td className="px-4 py-3 text-right tabular-nums font-semibold">₹{num(r.gross_amount)}</td>
                              </tr>
                            ))}
                            <tr className="bg-muted/30 font-semibold">
                              <td className="px-4 py-2" colSpan={4}>Total for {cust}</td>
                              <td className="px-4 py-2 text-right tabular-nums">{num(tot.gw, 3)}</td>
                              <td className="px-4 py-2 text-right tabular-nums">{num(tot.mw, 3)}</td>
                              <td className="px-4 py-2 text-right tabular-nums">{num(tot.dw, 3)}</td>
                              <td className="px-4 py-2 text-right tabular-nums">{tot.dp}</td>
                              <td className="px-4 py-2 text-right tabular-nums">{tot.qt}</td>
                              <td className="px-4 py-2 text-right tabular-nums">₹{num(tot.am)}</td>
                              <td className="px-4 py-2 text-right tabular-nums">{num(tot.dc)}</td>
                              <td className="px-4 py-2 text-right tabular-nums">₹{num(tot.na)}</td>
                              <td className="px-4 py-2 text-right tabular-nums">{num(tot.tx)}</td>
                              <td className="px-4 py-2 text-right tabular-nums">₹{num(tot.ga)}</td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-primary/5 border-t-2 font-bold">
                        <td className="px-4 py-3" colSpan={4}>Grand Total</td>
                        <td className="px-4 py-3 text-right tabular-nums">{num(grand.gross_wt, 3)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{num(grand.metal_wt, 3)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{num(grand.dia_wt, 3)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{grand.dia_pcs}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{grand.quantity}</td>
                        <td className="px-4 py-3 text-right tabular-nums">₹{num(grand.amount)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{num(grand.discount)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">₹{num(grand.net_amount)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{num(grand.tax)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-primary">₹{num(grand.gross_amount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
            {rows.length > 0 && (
              <div className="mt-3 text-sm text-muted-foreground text-right">Grand Total: <span className="font-semibold text-foreground">{inr(grand.gross_amount)}</span></div>
            )}
          </div>

          {/* Print-only classic tabular layout */}
          <div className="print-only overflow-x-auto">
            <table className="w-full text-xs border-collapse print-table">
              <thead>
                <tr className="bg-muted/60 border-y">
                  {columns.map((c) => (
                    <th key={c} className={`px-2 py-2 text-left font-semibold whitespace-nowrap ${["Gross Wt","Metal Wt","Dia Wt","Dia Pcs","Quantity","Amount","Discount","Net Amount","Total Tax","Gross Amount"].includes(c) ? "text-right" : ""}`}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={columns.length} className="text-center py-8 text-muted-foreground">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={columns.length} className="text-center py-8 text-muted-foreground">No orders in the selected range.</td></tr>
                ) : (
                  Array.from(groups.entries()).map(([cust, list]) => {
                    const tot = list.reduce((a, r) => ({
                      gw: a.gw + r.gross_wt, mw: a.mw + r.metal_wt, dw: a.dw + r.dia_wt, dp: a.dp + r.dia_pcs,
                      qt: a.qt + r.quantity, am: a.am + r.amount, dc: a.dc + r.discount, na: a.na + r.net_amount,
                      tx: a.tx + r.tax, ga: a.ga + r.gross_amount,
                    }), { gw:0, mw:0, dw:0, dp:0, qt:0, am:0, dc:0, na:0, tx:0, ga:0 });
                    return (
                      <Fragment key={cust}>
                        <tr className="bg-muted/30">
                          <td colSpan={columns.length} className="px-2 py-1 font-semibold">{cust}</td>
                        </tr>
                        {list.map((r, i) => (
                          <tr key={`${cust}-${i}`} className="border-b">
                            <td className="px-2 py-1 whitespace-nowrap">{format(new Date(r.invoice_date), "dd/MM/yyyy")}</td>
                            <td className="px-2 py-1 font-mono whitespace-nowrap">{r.invoice_no}</td>
                            <td className="px-2 py-1 whitespace-nowrap">{r.customer}</td>
                            <td className="px-2 py-1 whitespace-nowrap">{r.category}</td>
                            <td className="px-2 py-1 font-mono whitespace-nowrap">{r.item_no}</td>
                            <td className="px-2 py-1 text-right">{num(r.gross_wt, 3)}</td>
                            <td className="px-2 py-1 text-right">{num(r.metal_wt, 3)}</td>
                            <td className="px-2 py-1 text-right">{num(r.dia_wt, 3)}</td>
                            <td className="px-2 py-1 text-right">{r.dia_pcs}</td>
                            <td className="px-2 py-1 text-right">{r.quantity}</td>
                            <td className="px-2 py-1 text-right">{num(r.amount)}</td>
                            <td className="px-2 py-1 text-right">{num(r.discount)}</td>
                            <td className="px-2 py-1 text-right">{num(r.net_amount)}</td>
                            <td className="px-2 py-1 text-right">{num(r.tax)}</td>
                            <td className="px-2 py-1 text-right">{num(r.gross_amount)}</td>
                          </tr>
                        ))}
                        <tr className="border-y font-semibold bg-muted/20">
                          <td className="px-2 py-1" colSpan={5}>Total For {cust}</td>
                          <td className="px-2 py-1 text-right">{num(tot.gw, 3)}</td>
                          <td className="px-2 py-1 text-right">{num(tot.mw, 3)}</td>
                          <td className="px-2 py-1 text-right">{num(tot.dw, 3)}</td>
                          <td className="px-2 py-1 text-right">{tot.dp}</td>
                          <td className="px-2 py-1 text-right">{tot.qt}</td>
                          <td className="px-2 py-1 text-right">{num(tot.am)}</td>
                          <td className="px-2 py-1 text-right">{num(tot.dc)}</td>
                          <td className="px-2 py-1 text-right">{num(tot.na)}</td>
                          <td className="px-2 py-1 text-right">{num(tot.tx)}</td>
                          <td className="px-2 py-1 text-right">{num(tot.ga)}</td>
                        </tr>
                      </Fragment>
                    );
                  })
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 font-bold bg-muted/40">
                    <td className="px-2 py-2" colSpan={5}>Grand Total</td>
                    <td className="px-2 py-2 text-right">{num(grand.gross_wt, 3)}</td>
                    <td className="px-2 py-2 text-right">{num(grand.metal_wt, 3)}</td>
                    <td className="px-2 py-2 text-right">{num(grand.dia_wt, 3)}</td>
                    <td className="px-2 py-2 text-right">{grand.dia_pcs}</td>
                    <td className="px-2 py-2 text-right">{grand.quantity}</td>
                    <td className="px-2 py-2 text-right">{num(grand.amount)}</td>
                    <td className="px-2 py-2 text-right">{num(grand.discount)}</td>
                    <td className="px-2 py-2 text-right">{num(grand.net_amount)}</td>
                    <td className="px-2 py-2 text-right">{num(grand.tax)}</td>
                    <td className="px-2 py-2 text-right">{num(grand.gross_amount)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {rows.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground text-right">Grand Total: {inr(grand.gross_amount)}</div>
          )}
        </Card>
      )}
    </div>
  );
}