import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function OrderFormDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [status, setStatus] = useState("completed");

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

  const createMut = useMutation({
    mutationFn: async () => {
      const product = products.find((p: any) => p.id === productId);
      const qty = Number(quantity) || 1;
      const unit = Number(product?.price) || 0;
      const total = unit * qty;
      const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          customer_id: customerId,
          order_number: orderNumber,
          status,
          payment_status: status === "completed" ? "paid" : "pending",
          subtotal: total,
          total_amount: total,
        } as any)
        .select()
        .single();
      if (error) throw error;
      const { error: itemErr } = await supabase.from("order_items").insert({
        order_id: order.id,
        product_id: productId,
        quantity: qty,
        unit_price: unit,
        total_price: total,
      } as any);
      if (itemErr) throw itemErr;
    },
    onSuccess: () => {
      toast.success("Order created");
      qc.invalidateQueries({ queryKey: ["transactions-orders"] });
      onOpenChange(false);
      setCustomerId(""); setProductId(""); setQuantity("1"); setStatus("completed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
          <div>
            <Label>Product *</Label>
            <SearchableSelect
              value={productId}
              onValueChange={setProductId}
              options={products.map((p: any) => ({ value: p.id, label: `${p.name} — ₹${Number(p.price).toLocaleString("en-IN")}` }))}
              placeholder="Select product..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Quantity</Label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
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
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMut.mutate()} disabled={!customerId || !productId || createMut.isPending}>
            {createMut.isPending ? "Saving..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
