import { useMemo, useState } from "react";
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
      const { data } = await supabase.from("products").select("id, name, price").order("name").limit(500);
      return data || [];
    },
  });

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

  useMemo(() => {
    if (!open) return null;
    if (!order) return null;
    return null;
  }, [open, order]);

  useState(() => undefined);

  React.useEffect?.(() => {});

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
          };
        })
        .filter((item) => item.productId && item.unitPrice > 0);

      if (!customerId) throw new Error("Customer is required");
      if (validItems.length === 0) throw new Error("Add at least one product");

      const subtotal = validItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const taxAmount = 0;
      const total = subtotal + taxAmount;
      const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;

      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          customer_id: customerId,
          order_number: orderNumber,
          status,
          payment_status: status === "completed" ? "paid" : "pending",
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
          order_id: order.id,
          item_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_amount: item.lineTotal,
          tax_amount: 0,
        })) as any
      );
      if (itemErr) throw itemErr;

      if (status === "completed") {
        const { data: customer, error: customerErr } = await supabase
          .from("customers")
          .select("total_orders, total_spent")
          .eq("id", customerId)
          .maybeSingle();

        if (customerErr) throw customerErr;

        const { error: updateCustomerErr } = await supabase
          .from("customers")
          .update({
            total_orders: (customer?.total_orders || 0) + 1,
            total_spent: Number(customer?.total_spent || 0) + total,
          } as any)
          .eq("id", customerId);

        if (updateCustomerErr) throw updateCustomerErr;
      }
    },
    onSuccess: () => {
      toast.success("Order created");
      qc.invalidateQueries({ queryKey: ["transactions-orders"] });
      qc.invalidateQueries({ queryKey: ["transactions-customers"] });
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
          <DialogTitle>New Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Customer *</Label>
            <SearchableSelect
              value={customerId}
              onValueChange={setCustomerId}
              options={customers.map((c: any) => ({ value: c.id, label: `${c.name || "—"} (${c.phone})` }))}
              placeholder="Select customer..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-end">
              <Button type="button" variant="outline" onClick={addLineItem}>
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
                        options={products.map((p: any) => ({ value: p.id, label: `${p.name} — ₹${Number(p.price).toLocaleString("en-IN")}` }))}
                        placeholder="Select product..."
                      />
                    </div>
                    <div>
                      <Label>Quantity</Label>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="icon" onClick={() => updateLineItem(index, { quantity: String(Math.max(1, (Number(item.quantity) || 1) - 1)) })}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, { quantity: e.target.value })}
                          className="text-center"
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => updateLineItem(index, { quantity: String((Number(item.quantity) || 1) + 1) })}>
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
                      <Button type="button" variant="outline" size="icon" onClick={() => removeLineItem(index)} disabled={lineItems.length === 1}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMut.mutate()} disabled={!customerId || createMut.isPending || subtotal <= 0}>
            {createMut.isPending ? "Saving..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
