import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, Eye, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type SearchColumn = {
  key: string;
  label: string;
  type: "text" | "date" | "number" | "enum";
  options?: string[];
};

const SEARCH_COLUMNS: SearchColumn[] = [
  { key: "order_number", label: "Order #", type: "text" },
  { key: "customer_name", label: "Customer Name", type: "text" },
  { key: "customer_email", label: "Customer Email", type: "text" },
  { key: "customer_phone", label: "Customer Phone", type: "text" },
  { key: "fulfillment_method", label: "Fulfillment", type: "enum", options: ["delivery", "pickup"] },
  { key: "status", label: "Status", type: "enum", options: ["pending", "confirmed", "completed", "cancelled"] },
  { key: "total_amount", label: "Total Amount", type: "number" },
  { key: "created_at", label: "Order Date", type: "date" },
];

const PAGE_SIZE = 50;
const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "completed") return "default";
  if (s === "pending") return "secondary";
  if (s === "cancelled") return "destructive";
  if (s === "confirmed") return "outline";
  return "outline";
};

const fulfillmentVariant = (f: string): string => {
  return f === "delivery" ? "Delivery" : "In-Store Pickup";
};

export default function OnlineOrdersList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [searchColumn, setSearchColumn] = useState<string>("order_number");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [viewDetailMode, setViewDetailMode] = useState(false);

  const activeColumn = SEARCH_COLUMNS.find((c) => c.key === searchColumn) || SEARCH_COLUMNS[0];

  const applySearch = (rows: any[]) => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    if (activeColumn.type === "date") {
      return rows.filter((o: any) => {
        const v = o[searchColumn];
        if (!v) return false;
        return format(new Date(v), "yyyy-MM-dd") === search;
      });
    }
    if (activeColumn.type === "number") {
      const num = Number(search);
      if (Number.isNaN(num)) return rows;
      return rows.filter((o: any) => Number(o[searchColumn]) === num);
    }
    return rows.filter((o: any) => String(o[searchColumn] ?? "").toLowerCase().includes(s));
  };

  const { data, isLoading } = useQuery({
    queryKey: ["online-orders", search, searchColumn, page],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("online_orders")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      return { orders: data || [], total: count || 0 };
    },
  });

  const orders = data?.orders || [];
  const filtered = applySearch(orders);
  const total = data?.total || 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const updateMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await supabase
        .from("online_orders")
        .update({ status })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["online-orders"] });
      toast.success("Order status updated");
      setSelectedOrder(null);
    },
    onError: () => {
      toast.error("Failed to update order");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("online_orders")
        .delete()
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["online-orders"] });
      toast.success("Order deleted");
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error("Failed to delete order");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Online Orders</h1>
        <p className="text-muted-foreground">Orders placed through trayi-sparkle-elegance website</p>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-10"
              />
            </div>
            <Select value={searchColumn} onValueChange={setSearchColumn}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEARCH_COLUMNS.map((col) => (
                  <SelectItem key={col.key} value={col.key}>
                    {col.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No online orders found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Fulfillment</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                      <TableCell className="font-medium">{order.customer_name}</TableCell>
                      <TableCell className="text-xs">{order.customer_email}</TableCell>
                      <TableCell className="text-xs">{order.customer_phone}</TableCell>
                      <TableCell className="text-xs capitalize">{fulfillmentVariant(order.fulfillment_method)}</TableCell>
                      <TableCell className="font-semibold">{inr(order.total_amount)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(order.status)} className="capitalize">
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{format(new Date(order.created_at), "MMM dd, yyyy HH:mm")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedOrder(order);
                              setViewDetailMode(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedOrder(order);
                              setViewDetailMode(false);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(order)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page {page + 1} of {Math.max(1, pageCount)} ({total} total)
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => (p + 1 < pageCount ? p + 1 : p))}
                disabled={page + 1 >= pageCount}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <Card>
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">Order Details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Order Number</div>
                  <div className="font-mono font-semibold">{selectedOrder.order_number}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <Badge variant={statusVariant(selectedOrder.status)} className="capitalize">
                    {selectedOrder.status}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Customer Name</div>
                  <div className="font-medium">{selectedOrder.customer_name}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Phone</div>
                  <div className="font-medium">{selectedOrder.customer_phone}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="text-sm">{selectedOrder.customer_email}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Fulfillment</div>
                  <div className="font-medium">{fulfillmentVariant(selectedOrder.fulfillment_method)}</div>
                </div>
              </div>
            </div>

            {selectedOrder.fulfillment_method === "delivery" && selectedOrder.shipping_address_line1 && (
              <div>
                <h3 className="font-semibold mb-2">Shipping Address</h3>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <div>{selectedOrder.shipping_address_line1}</div>
                  {selectedOrder.shipping_address_line2 && <div>{selectedOrder.shipping_address_line2}</div>}
                  <div>
                    {[selectedOrder.shipping_city, selectedOrder.shipping_state, selectedOrder.shipping_pincode]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>
              </div>
            )}

            {selectedOrder.fulfillment_method === "pickup" && selectedOrder.preferred_pickup_date && (
              <div>
                <div className="text-xs text-muted-foreground">Preferred Pickup Date</div>
                <div className="font-medium">{format(new Date(selectedOrder.preferred_pickup_date), "MMM dd, yyyy")}</div>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-3">Order Items</h3>
              <div className="space-y-2">
                {Array.isArray(selectedOrder.items) &&
                  selectedOrder.items.map((item: any, idx: number) => (
                    <div key={idx} className="border-b pb-2 last:border-b-0">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <div className="font-medium">{item.name || item.productName}</div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            {item.productCode && <div>Code: {item.productCode}</div>}
                            <div>{[item.purity, item.metal, item.size].filter(Boolean).join(" · ")}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{inr(item.price * (item.qty || 1))}</div>
                          <div className="text-xs text-muted-foreground">Qty: {item.qty || 1}</div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{inr(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="text-accent">Complimentary</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total</span>
                <span>{inr(selectedOrder.total_amount)}</span>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              {!viewDetailMode && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      updateMutation.mutate({ orderId: selectedOrder.id, status: "confirmed" });
                    }}
                    disabled={selectedOrder.status !== "pending"}
                  >
                    Mark as Confirmed
                  </Button>
                  <Button
                    onClick={() => {
                      updateMutation.mutate({ orderId: selectedOrder.id, status: "completed" });
                    }}
                    disabled={selectedOrder.status === "completed" || selectedOrder.status === "cancelled"}
                  >
                    Mark as Completed
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete order {deleteTarget?.order_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
