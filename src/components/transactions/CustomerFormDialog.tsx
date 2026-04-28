import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import { OrderFormDialog } from "@/components/transactions/OrderFormDialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customer?: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    tier: string | null;
    date_of_birth: string | null;
    anniversary_date: string | null;
  } | null;
  mode?: "create" | "edit" | "view";
}

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  tier: "bronze",
  date_of_birth: "",
  anniversary_date: "",
};

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export function CustomerFormDialog({ open, onOpenChange, customer = null, mode = "create" }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const isView = mode === "view";
  const isEdit = mode === "edit";

  useEffect(() => {
    if (!open) return;

    if (customer) {
      setForm({
        name: customer.name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        tier: customer.tier || "bronze",
        date_of_birth: customer.date_of_birth || "",
        anniversary_date: customer.anniversary_date || "",
      });
      return;
    }

    setForm(emptyForm);
  }, [open, customer]);

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["customer-orders", customer?.id],
    enabled: open && isView && !!customer?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, created_at, status, total_amount, order_items(quantity)")
        .eq("customer_id", customer!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name || null,
        phone: form.phone,
        email: form.email || null,
        tier: form.tier,
        date_of_birth: form.date_of_birth || null,
        anniversary_date: form.anniversary_date || null,
      };
      const query = isEdit
        ? supabase.from("customers").update(payload).eq("id", customer!.id)
        : supabase.from("customers").insert(payload);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Customer updated" : "Customer created");
      qc.invalidateQueries({ queryKey: ["transactions-customers"] });
      onOpenChange(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const title = isView ? "View Customer" : isEdit ? "Edit Customer" : "New Customer";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto ${isView ? "sm:max-w-3xl" : "sm:max-w-lg"}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2">
            <Label>Name</Label>
            <Input value={form.name} disabled={isView} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Phone *</Label>
            <Input value={form.phone} disabled={isView} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" disabled={isView} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Tier</Label>
            <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v })} disabled={isView}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bronze">Bronze</SelectItem>
                <SelectItem value="silver">Silver</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="platinum">Platinum</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date of Birth</Label>
            <Input type="date" disabled={isView} value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Anniversary</Label>
            <Input type="date" disabled={isView} value={form.anniversary_date} onChange={(e) => setForm({ ...form, anniversary_date: e.target.value })} />
          </div>
        </div>

        {isView && customer && (
          <div className="mt-2">
            <h3 className="text-sm font-semibold mb-2">Orders ({orders?.length ?? 0})</h3>
            <div className="border rounded-md max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground text-sm">Loading...</TableCell></TableRow>
                  ) : (orders ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground text-sm">No orders yet.</TableCell></TableRow>
                  ) : (
                    (orders ?? []).map((o: any) => {
                      const itemCount = (o.order_items ?? []).reduce(
                        (s: number, it: any) => s + Number(it.quantity ?? 0),
                        0
                      );
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-xs">
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={() => { setSelectedOrder(o); setOrderDialogOpen(true); }}
                            >
                              {o.order_number || o.id.slice(0, 8)}
                            </button>
                          </TableCell>
                          <TableCell className="text-xs">{o.created_at ? format(new Date(o.created_at), "dd MMM yyyy") : "—"}</TableCell>
                          <TableCell className="text-right">{itemCount}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize text-xs">{o.status || "—"}</Badge></TableCell>
                          <TableCell className="text-right font-medium">{inr(Number(o.total_amount) || 0)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isView ? "Close" : "Cancel"}</Button>
          {!isView && (
            <Button onClick={() => createMut.mutate()} disabled={!form.phone || createMut.isPending}>
              {createMut.isPending ? "Saving..." : isEdit ? "Save" : "Create"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      <OrderFormDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        order={selectedOrder}
        mode="view"
      />
    </Dialog>
  );
}
