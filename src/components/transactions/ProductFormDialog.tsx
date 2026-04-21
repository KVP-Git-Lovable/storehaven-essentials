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
        price: Number(form.price) || 0,
        stock_qty: form.stock_qty ? Number(form.stock_qty) : 0,
      };
      const query = isEdit
        ? supabase.from("products").update(payload).eq("id", product!.id)
        : supabase.from("products").insert(payload);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Product updated" : "Product created");
      qc.invalidateQueries({ queryKey: ["transactions-products"] });
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
