import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const PAGE_SIZE = 50;
const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "completed") return "default";
  if (s === "pending") return "secondary";
  if (s === "cancelled") return "destructive";
  return "outline";
};

export default function OrdersList() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["transactions-orders", search, page],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("*, customers(name, phone)", { count: "exact" })
        .order("created_at", { ascending: false });
      if (search.trim()) q = q.ilike("order_number", `%${search}%`);
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data || [], count: count || 0 };
    },
  });

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">All customer orders, most recent first.</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search order number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{data?.count ?? 0} total</Badge>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : (data?.rows || []).length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No orders found.</TableCell></TableRow>
            ) : (
              data!.rows.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                  <TableCell>
                    <div className="font-medium">{o.customers?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{o.customers?.phone || ""}</div>
                  </TableCell>
                  <TableCell><Badge variant={statusVariant(o.status)} className="capitalize">{o.status}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{o.payment_status || "—"}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{inr(Number(o.total_amount))}</TableCell>
                  <TableCell className="text-xs">{format(new Date(o.created_at), "dd MMM yyyy, HH:mm")}</TableCell>
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
    </div>
  );
}
