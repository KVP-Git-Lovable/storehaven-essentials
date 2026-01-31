import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  Search, 
  RotateCcw, 
  Package, 
  Receipt, 
  AlertCircle,
  CheckCircle,
  XCircle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const REASON_CODES = [
  { value: "defective", label: "Defective/Damaged" },
  { value: "wrong_item", label: "Wrong Item Delivered" },
  { value: "not_needed", label: "No Longer Needed" },
  { value: "size_issue", label: "Size/Fit Issue" },
  { value: "quality", label: "Quality Not As Expected" },
  { value: "other", label: "Other" },
];

const REFUND_METHODS = [
  { value: "original", label: "Original Payment Method" },
  { value: "cash", label: "Cash" },
  { value: "store_credit", label: "Store Credit" },
];

export default function ReturnsProcessing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState("");
  const [reasonNotes, setReasonNotes] = useState("");
  const [refundMethod, setRefundMethod] = useState("original");

  // Fetch recent returns
  const { data: returns = [], isLoading } = useQuery({
    queryKey: ["returns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("returns")
        .select(`
          *,
          order:orders(order_number),
          customer:customers(name, phone),
          store:stores(name)
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Search for order
  const searchOrder = async () => {
    if (!searchQuery) {
      toast.error("Please enter order number or customer phone");
      return;
    }

    // Search by order number
    let { data: order, error } = await supabase
      .from("orders")
      .select(`
        *,
        customer:customers(id, name, phone),
        store:stores(name)
      `)
      .or(`order_number.ilike.%${searchQuery}%`)
      .eq("status", "completed")
      .single();

    if (error || !order) {
      // Try searching by customer phone
      const { data: customerOrders } = await supabase
        .from("orders")
        .select(`
          *,
          customer:customers!inner(id, name, phone),
          store:stores(name)
        `)
        .ilike("customer.phone", `%${searchQuery}%`)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1);

      if (customerOrders && customerOrders.length > 0) {
        order = customerOrders[0];
      } else {
        toast.error("Order not found");
        return;
      }
    }

    // Fetch order items
    const { data: items } = await supabase
      .from("order_items")
      .select(`
        *,
        product:products(id, name)
      `)
      .eq("order_id", order.id);

    setSelectedOrder(order);
    setOrderItems(items || []);
    setSelectedItems({});
  };

  // Process return mutation
  const processReturnMutation = useMutation({
    mutationFn: async () => {
      const returnNumber = `RTN-${Date.now()}`;
      const selectedItemsList = Object.entries(selectedItems)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, qty]) => {
          const item = orderItems.find((i) => i.id === itemId);
          return {
            order_item_id: itemId,
            product_id: item?.product?.id,
            product_name: item?.product?.name || "Unknown",
            quantity: qty,
            unit_price: item?.unit_price || 0,
            refund_amount: qty * (item?.unit_price || 0),
          };
        });

      const refundAmount = selectedItemsList.reduce((sum, item) => sum + item.refund_amount, 0);

      // Create return record
      const { data: returnRecord, error: returnError } = await supabase
        .from("returns")
        .insert({
          return_number: returnNumber,
          order_id: selectedOrder.id,
          store_id: selectedOrder.store_id,
          customer_id: selectedOrder.customer_id,
          reason_code: reasonCode,
          reason_notes: reasonNotes,
          subtotal: refundAmount,
          refund_amount: refundAmount,
          refund_method: refundMethod,
          status: "completed",
          processed_by: user?.id,
        })
        .select()
        .single();

      if (returnError) throw returnError;

      // Create return items
      const returnItems = selectedItemsList.map((item) => ({
        return_id: returnRecord.id,
        ...item,
      }));

      const { error: itemsError } = await supabase
        .from("return_items")
        .insert(returnItems);

      if (itemsError) throw itemsError;

      // If refund to store credit, update customer balance
      if (refundMethod === "store_credit" && selectedOrder.customer_id) {
        // Get current store credit and add refund amount
        const { data: currentCustomer } = await supabase
          .from("customers")
          .select("store_credit")
          .eq("id", selectedOrder.customer_id)
          .single();

        const currentCredit = Number(currentCustomer?.store_credit || 0);
        await supabase
          .from("customers")
          .update({ store_credit: currentCredit + refundAmount })
          .eq("id", selectedOrder.customer_id);
      }

      return { returnNumber, refundAmount };
    },
    onSuccess: ({ returnNumber, refundAmount }) => {
      toast.success(`Return ${returnNumber} processed. Refund: ₹${refundAmount}`);
      setIsProcessDialogOpen(false);
      setSelectedOrder(null);
      setOrderItems([]);
      setSelectedItems({});
      setReasonCode("");
      setReasonNotes("");
      queryClient.invalidateQueries({ queryKey: ["returns"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to process return");
    },
  });

  const toggleItemSelection = (itemId: string, maxQty: number) => {
    setSelectedItems((prev) => {
      const current = prev[itemId] || 0;
      if (current === 0) {
        return { ...prev, [itemId]: maxQty };
      }
      return { ...prev, [itemId]: 0 };
    });
  };

  const updateItemQuantity = (itemId: string, qty: number, maxQty: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: Math.min(Math.max(0, qty), maxQty),
    }));
  };

  const totalRefund = Object.entries(selectedItems)
    .filter(([_, qty]) => qty > 0)
    .reduce((sum, [itemId, qty]) => {
      const item = orderItems.find((i) => i.id === itemId);
      return sum + qty * (item?.unit_price || 0);
    }, 0);

  const hasSelectedItems = Object.values(selectedItems).some((qty) => qty > 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Returns & Refunds</h1>
          <p className="text-muted-foreground">Process customer returns and issue refunds</p>
        </div>
      </div>

      {/* Search Order */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find Order
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Enter order number or customer phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchOrder()}
              className="max-w-md"
            />
            <Button onClick={searchOrder}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Selected Order */}
      {selectedOrder && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Order {selectedOrder.order_number}
              </span>
              <Badge variant="outline">
                {format(new Date(selectedOrder.created_at), "dd MMM yyyy, HH:mm")}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Customer</div>
                <div className="font-medium">
                  {selectedOrder.customer?.name || "Walk-in"}
                  {selectedOrder.customer?.phone && (
                    <span className="text-muted-foreground ml-2">
                      ({selectedOrder.customer.phone})
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Store</div>
                <div className="font-medium">{selectedOrder.store?.name || "-"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Order Total</div>
                <div className="font-medium">₹{Number(selectedOrder.total_amount).toFixed(2)}</div>
              </div>
            </div>

            {/* Order Items */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Return</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Ordered</TableHead>
                  <TableHead className="text-center">Return Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Refund</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderItems.map((item) => {
                  const returnQty = selectedItems[item.id] || 0;
                  const refund = returnQty * item.unit_price;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={returnQty > 0}
                          onCheckedChange={() => toggleItemSelection(item.id, item.quantity)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.product?.name || "Unknown"}</div>
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          max={item.quantity}
                          value={returnQty}
                          onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 0, item.quantity)}
                          className="w-16 h-8 text-center mx-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right">₹{item.unit_price}</TableCell>
                      <TableCell className="text-right font-medium">
                        {refund > 0 ? `₹${refund.toFixed(2)}` : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Refund Summary */}
            {hasSelectedItems && (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Total Refund Amount</div>
                  <div className="text-2xl font-bold text-primary">₹{totalRefund.toFixed(2)}</div>
                </div>
                <Button onClick={() => setIsProcessDialogOpen(true)}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Process Return
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Returns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Recent Returns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return #</TableHead>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Refund</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((ret: any) => (
                <TableRow key={ret.id}>
                  <TableCell className="font-medium">{ret.return_number}</TableCell>
                  <TableCell>{ret.order?.order_number}</TableCell>
                  <TableCell>{ret.customer?.name || "Walk-in"}</TableCell>
                  <TableCell>{format(new Date(ret.created_at), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {REASON_CODES.find((r) => r.value === ret.reason_code)?.label || ret.reason_code}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">₹{ret.refund_amount}</TableCell>
                  <TableCell>
                    {REFUND_METHODS.find((m) => m.value === ret.refund_method)?.label || ret.refund_method}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(ret.status)}>{ret.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {returns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No returns processed yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Process Return Dialog */}
      <Dialog open={isProcessDialogOpen} onOpenChange={setIsProcessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Process Return
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Refund Amount</div>
              <div className="text-2xl font-bold text-primary">₹{totalRefund.toFixed(2)}</div>
            </div>

            <div className="space-y-2">
              <Label>Return Reason *</Label>
              <Select value={reasonCode} onValueChange={setReasonCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {REASON_CODES.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Textarea
                placeholder="Any additional details..."
                value={reasonNotes}
                onChange={(e) => setReasonNotes(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Refund Method *</Label>
              <Select value={refundMethod} onValueChange={setRefundMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select refund method" />
                </SelectTrigger>
                <SelectContent>
                  {REFUND_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProcessDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => processReturnMutation.mutate()}
              disabled={!reasonCode || processReturnMutation.isPending}
            >
              {processReturnMutation.isPending ? "Processing..." : "Complete Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
