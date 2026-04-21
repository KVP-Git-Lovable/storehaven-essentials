import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

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

export function CustomerFormDialog({ open, onOpenChange, customer = null, mode = "create" }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
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
      <DialogContent>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isView ? "Close" : "Cancel"}</Button>
          {!isView && (
            <Button onClick={() => createMut.mutate()} disabled={!form.phone || createMut.isPending}>
              {createMut.isPending ? "Saving..." : isEdit ? "Save" : "Create"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
