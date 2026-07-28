import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, Plus, Receipt } from "lucide-react";
import { format } from "date-fns";
import { SalesReturnDialog } from "@/components/transactions/SalesReturnDialog";
import { ExchangeReceiptDialog } from "@/components/transactions/ExchangeReceiptDialog";

const PAGE_SIZE = 50;
const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function SalesReturnsList() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [receiptReturnId, setReceiptReturnId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sales-returns", search, page],
    queryFn: async () => {
      let q: any = supabase
        .from("returns")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      if (search.trim()) q = q.ilike("return_number", `%${search.trim()}%`);
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      const rows: any[] = data || [];

      const customerIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean)));
      const orderIds = Array.from(
        new Set([...rows.map((r) => r.order_id), ...rows.map((r) => r.exchange_order_id)].filter(Boolean))
      );
      const [{ data: customers }, { data: orders }] = await Promise.all([
        customerIds.length
          ? supabase.from("customers").select("id, name, phone").in("id", customerIds)
          : Promise.resolve({ data: [] as any[] } as any),
        orderIds.length
          ? supabase.from("orders").select("id, order_number, invoice_number").in("id", orderIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);
      const cById = new Map((customers || []).map((c: any) => [c.id, c]));
      const oById = new Map((orders || []).map((o: any) => [o.id, o]));

      return {
        rows: rows.map((r) => ({
          ...r,
          customer: cById.get(r.customer_id) || null,
          original_order: oById.get(r.order_id) || null,
          exchange_order: oById.get(r.exchange_order_id) || null,
        })),
        count: count || 0,
      };
    },
  });

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Return</h1>
          <p className="text-muted-foreground">
            Return sold jewellery back into inventory against a new purchase. Sorted by recent first
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Sales Return
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Return #..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{data?.count ?? 0} total</Badge>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Return #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Original Invoice</TableHead>
              <TableHead>Exchange Order</TableHead>
              <TableHead className="text-right">Return Value</TableHead>
              <TableHead className="text-right">Purchase Value</TableHead>
              <TableHead className="text-right">Additional Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (data?.rows || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No sales returns found.
                </TableCell>
              </TableRow>
            ) : (
              data!.rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.return_number}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.customer?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.customer?.phone || ""}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.original_order?.invoice_number || r.original_order?.order_number || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.exchange_order?.order_number || "—"}</TableCell>
                  <TableCell className="text-right">{inr(Number(r.return_value))}</TableCell>
                  <TableCell className="text-right">{inr(Number(r.new_purchase_value))}</TableCell>
                  <TableCell className="text-right font-medium">{inr(Number(r.additional_amount))}</TableCell>
                  <TableCell>
                    <Badge variant="default" className="capitalize">
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{format(new Date(r.created_at), "dd MMM yyyy, HH:mm")}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Exchange receipt"
                      aria-label="Exchange receipt"
                      onClick={() => setReceiptReturnId(r.id)}
                    >
                      <Receipt className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Page {page + 1} of {Math.max(totalPages, 1)}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <SalesReturnDialog open={createOpen} onOpenChange={setCreateOpen} />
      {receiptReturnId && (
        <ExchangeReceiptDialog
          open={!!receiptReturnId}
          onOpenChange={(o) => !o && setReceiptReturnId(null)}
          returnId={receiptReturnId}
        />
      )}
    </div>
  );
}
