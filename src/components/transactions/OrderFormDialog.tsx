import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { assertStockAvailable, recordSaleLedger } from "@/lib/inventoryStock";
import { useInventoryStockMap } from "@/hooks/useInventoryStock";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  order?: {
    id: string;
    customer_id: string | null;
    status: string;
    payment_status: string;
    payment_method: string;
    order_number: string;
    subtotal: number;
    tax_amount: number | null;
    total_amount: number;
  } | null;
  mode?: "create" | "edit" | "view";
}

export function OrderFormDialog({ open, onOpenChange, order = null, mode = "create" }: Props) {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("completed");
  const [lineItems, setLineItems] = useState([{ productId: "", quantity: "1" }]);
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const { data: customers = [] } = useQuery({
    queryKey: ["order-form-customers"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, phone").order("name").limit(1000);
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["order-form-products"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_items")
        .select("id, name, selling_price, status")
        .eq("status", "active")
        .order("name")
        .limit(1000);
      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        price: Number(row.selling_price) || 0,
      }));
    },
  });

  const productIds = useMemo(() => products.map((p: any) => p.id), [products]);
  const { data: stockMap = {} } = useInventoryStockMap(productIds, open);

  const { data: existingOrderItems = [] } = useQuery({
    queryKey: ["order-form-items", order?.id],
    enabled: open && !!order?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("item_id, quantity")
        .eq("order_id", order!.id);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (!order) {
      setCustomerId("");
      setStatus("completed");
      setLineItems([{ productId: "", quantity: "1" }]);
      return;
    }
    setCustomerId(order.customer_id || "");
    setStatus(order.status || "completed");
  }, [open, order]);

  useEffect(() => {
    if (!open || !order?.id) return;
    if (existingOrderItems.length) {
      setLineItems(existingOrderItems.map((item: any) => ({ productId: item.item_id, quantity: String(item.quantity || 1) })));
    }
  }, [open, order?.id, existingOrderItems]);

  const createMut = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const validItems = lineItems
        .map((item) => {
          const product = products.find((p: any) => p.id === item.productId);
          const quantity = Math.max(1, Number(item.quantity) || 1);
          const unitPrice = Number(product?.price) || 0;
          return {
            productId: item.productId,
            quantity,
            unitPrice,
            lineTotal: quantity * unitPrice,
            name: product?.name as string | undefined,
          };
        })
        .filter((item) => item.productId && item.unitPrice > 0);

      if (!customerId) throw new Error("Customer is required");
      if (validItems.length === 0) throw new Error("Add at least one product");

      // Stock guard — only enforce on new orders to avoid double-counting on edits
      if (!isEdit) {
        await assertStockAvailable(
          validItems.map((i) => ({ item_id: i.productId, quantity: i.quantity, name: i.name }))
        );
      }

      const subtotal = validItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const taxAmount = 0;
      const total = subtotal + taxAmount;
      const paymentStatus = status === "completed" ? "paid" : status === "cancelled" ? "cancelled" : "pending";

      if (isEdit && order) {
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            customer_id: customerId,
            status,
            payment_status: paymentStatus,
            subtotal,
            tax_amount: taxAmount,
            total_amount: total,
          } as any)
          .eq("id", order.id);
        if (updateError) throw updateError;

        const { error: deleteItemsError } = await supabase.from("order_items").delete().eq("order_id", order.id);
        if (deleteItemsError) throw deleteItemsError;

        const { error: itemErr } = await supabase.from("order_items").insert(
          validItems.map((item) => ({
            order_id: order.id,
            item_id: item.productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_amount: item.lineTotal,
            tax_amount: 0,
          })) as any
        );
        if (itemErr) throw itemErr;
        return;
      }

      const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;
      const { data: createdOrder, error } = await supabase
        .from("orders")
        .insert({
          customer_id: customerId,
          order_number: orderNumber,
          status,
          payment_status: paymentStatus,
          payment_method: "cash",
          subtotal,
          tax_amount: taxAmount,
          total_amount: total,
          created_by: user?.id || "manual-entry",
        } as any)
        .select()
        .single();
      if (error) throw error;

      const { error: itemErr } = await supabase.from("order_items").insert(
        validItems.map((item) => ({
          order_id: createdOrder.id,
          item_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_amount: item.lineTotal,
          tax_amount: 0,
        })) as any
      );
      if (itemErr) throw itemErr;

      // Decrement stock via ledger entries
      await recordSaleLedger({
        orderId: createdOrder.id,
        lines: validItems.map((i) => ({ item_id: i.productId, quantity: i.quantity, unit_cost: i.unitPrice })),
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Order updated" : "Order created");
      qc.invalidateQueries({ queryKey: ["transactions-orders"] });
      qc.invalidateQueries({ queryKey: ["transactions-customers"] });
      qc.invalidateQueries({ queryKey: ["inventory-stock-map"] });
      onOpenChange(false);
      setCustomerId("");
      setStatus("completed");
      setLineItems([{ productId: "", quantity: "1" }]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const enrichedItems = useMemo(
    () => lineItems.map((item, index) => {
      const product = products.find((p: any) => p.id === item.productId);
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Number(product?.price) || 0;
      return {
        key: `${index}-${item.productId}`,
        index,
        quantity,
        unitPrice,
        lineTotal: quantity * unitPrice,
      };
    }),
    [lineItems, products]
  );

  const subtotal = enrichedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const total = subtotal;
  const title = isView ? "View Order" : isEdit ? "Edit Order" : "New Order";

  const updateLineItem = (index: number, patch: Partial<{ productId: string; quantity: string }>) => {
    setLineItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addLineItem = () => setLineItems((current) => [...current, { productId: "", quantity: "1" }]);

  const removeLineItem = (index: number) => {
    setLineItems((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {order?.order_number && (
            <div>
              <Label>Order #</Label>
              <Input value={order.order_number} disabled />
            </div>
          )}
          <div>
            <Label>Customer *</Label>
            <SearchableSelect
              value={customerId}
              onValueChange={setCustomerId}
              options={customers.map((c: any) => ({ value: c.id, label: `${c.name || "—"} (${c.phone})` }))}
              placeholder="Select customer..."
              disabled={isView}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus} disabled={isView}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-end">
              <Button type="button" variant="outline" onClick={addLineItem} disabled={isView}>
                <Plus className="mr-2 h-4 w-4" /> Add Product
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            {lineItems.map((item, index) => {
              const calculated = enrichedItems[index];
              return (
                <Card key={calculated.key} className="p-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.7fr)_120px_120px_auto] md:items-end">
                    <div>
                      <Label>Product {index + 1}</Label>
                      <SearchableSelect
                        value={item.productId}
                        onValueChange={(value) => updateLineItem(index, { productId: value })}
                        options={products.map((p: any) => {
                          const stock = stockMap[p.id] ?? 0;
                          return {
                            value: p.id,
                            label: `${p.name} — ₹${Number(p.price).toLocaleString("en-IN")} (Stock: ${stock})`,
                            disabled: !isEdit && stock <= 0,
                          };
                        })}
                        placeholder="Select product..."
                        disabled={isView}
                      />
                    </div>
                    <div>
                      <Label>Quantity</Label>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="icon" disabled={isView} onClick={() => updateLineItem(index, { quantity: String(Math.max(1, (Number(item.quantity) || 1) - 1)) })}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          disabled={isView}
                          onChange={(e) => updateLineItem(index, { quantity: e.target.value })}
                          className="text-center"
                        />
                        <Button type="button" variant="outline" size="icon" disabled={isView} onClick={() => updateLineItem(index, { quantity: String((Number(item.quantity) || 1) + 1) })}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div>
                        <p className="text-muted-foreground">Unit Price</p>
                        <p className="font-medium">₹{calculated.unitPrice.toLocaleString("en-IN")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Line Total</p>
                        <p className="font-medium">₹{calculated.lineTotal.toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" variant="outline" size="icon" onClick={() => removeLineItem(index)} disabled={isView || lineItems.length === 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="p-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">₹{subtotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium">₹0</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-base">
                <span className="font-medium">Grand Total</span>
                <span className="font-semibold">₹{total.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isView ? "Close" : "Cancel"}</Button>
          {!isView && (
            <Button onClick={() => createMut.mutate()} disabled={!customerId || createMut.isPending || subtotal <= 0}>
              {createMut.isPending ? "Saving..." : isEdit ? "Save" : "Create"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
