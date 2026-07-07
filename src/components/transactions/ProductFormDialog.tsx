import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product?: {
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
    brand: string | null;
    model: string | null;
    warranty: string | null;
    price: number | null;
    stock_qty: number | null;
    image_url?: string | null;
  } | null;
  mode?: "create" | "edit" | "view";
}

const emptyForm = {
  name: "",
  sku: "",
  category: "",
  brand: "",
  model: "",
  warranty: "",
  price: "",
  stock_qty: "",
};

export function ProductFormDialog({ open, onOpenChange, product = null, mode = "create" }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const isView = mode === "view";
  const isEdit = mode === "edit";

  useEffect(() => {
    if (!open) return;

    if (product) {
      setForm({
        name: product.name || "",
        sku: product.sku || "",
        category: product.category || "",
        brand: product.brand || "",
        model: product.model || "",
        warranty: product.warranty || "",
        price: product.price != null ? String(product.price) : "",
        stock_qty: product.stock_qty != null ? String(product.stock_qty) : "",
      });
      return;
    }

    setForm(emptyForm);
  }, [open, product]);

  const createMut = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name,
        sku: form.sku || null,
        category: form.category,
        brand: form.brand,
        model: form.model || "N/A",
        warranty: form.warranty || "N/A",
        selling_price: Number(form.price) || 0,
        unit_cost: 0,
        unit: "pcs",
        min_stock: 0,
        status: "active",
      };
      const query = isEdit
        ? supabase.from("inventory_items").update(payload).eq("id", product!.id)
        : supabase.from("inventory_items").insert(payload).select("id").single();
      const { data: result, error } = await query as any;
      if (error) throw error;

      // For new items with an opening stock quantity, write a single ledger entry
      const newId = isEdit ? product!.id : result?.id;
      const openingQty = form.stock_qty ? Number(form.stock_qty) : 0;
      if (!isEdit && newId && openingQty > 0) {
        await supabase.from("stock_ledger").insert({
          item_id: newId,
          location_type: "global",
          transaction_type: "opening_balance",
          quantity_change: openingQty,
          unit_cost: 0,
          reference_type: "product_form",
          notes: "Opening stock from Products form",
          created_by: "product-form",
        } as any);
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Product updated" : "Product created");
      qc.invalidateQueries({ queryKey: ["transactions-products"] });
      qc.invalidateQueries({ queryKey: ["inventory-stock-map"] });
      onOpenChange(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const valid = form.name && form.category && form.brand && form.price;
  const title = isView ? "View Product" : isEdit ? "Edit Product" : "New Product";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {product?.image_url && (
          <div className="flex justify-center">
            <img
              src={product.image_url}
              alt={product.name}
              className="h-40 w-40 object-cover rounded-md border"
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2">
            <Label>Name *</Label>
            <Input disabled={isView} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>SKU</Label>
            <Input disabled={isView} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div>
            <Label>Category *</Label>
            <Input disabled={isView} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <Label>Brand *</Label>
            <Input disabled={isView} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          </div>
          <div>
            <Label>Model</Label>
            <Input disabled={isView} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div>
            <Label>Price (₹) *</Label>
            <Input type="number" disabled={isView} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div>
            <Label>Stock Qty</Label>
            <Input type="number" disabled={isView} value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Warranty</Label>
            <Input disabled={isView} value={form.warranty} onChange={(e) => setForm({ ...form, warranty: e.target.value })} placeholder="e.g., 1 Year" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isView ? "Close" : "Cancel"}</Button>
          {!isView && (
            <Button onClick={() => createMut.mutate()} disabled={!valid || createMut.isPending}>
              {createMut.isPending ? "Saving..." : isEdit ? "Save" : "Create"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
