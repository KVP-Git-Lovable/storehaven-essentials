import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import { GenderSelect, formatDOB } from "@/components/shared/GenderSelect";

export interface LeadRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string;
  city: string | null;
  state: string | null;
  country: string | null;
  address: string | null;
  is_converted: boolean;
  converted_at: string | null;
  converted_customer_id: string | null;
  created_at: string;
  date_of_birth?: string | null;
  gender?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lead?: LeadRow | null;
  mode?: "create" | "edit" | "view";
}

const empty = { name: "", email: "", phone: "", city: "", state: "", country: "", address: "", date_of_birth: "", gender: "" };

export function LeadFormDialog({ open, onOpenChange, lead = null, mode = "create" }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const isView = mode === "view";
  const isEdit = mode === "edit";

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setForm({
        name: lead.name || "",
        email: lead.email || "",
        phone: lead.phone || "",
        city: lead.city || "",
        state: lead.state || "",
        country: lead.country || "",
        address: lead.address || "",
        date_of_birth: (lead as any).date_of_birth || "",
        gender: (lead as any).gender || "",
      });
    } else {
      setForm(empty);
    }
  }, [open, lead]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name || null,
        email: form.email || null,
        phone: form.phone,
        city: form.city || null,
        state: form.state || null,
        country: form.country || null,
        address: form.address || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
      };
      const q = isEdit
        ? supabase.from("leads").update(payload).eq("id", lead!.id)
        : supabase.from("leads").insert(payload);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Lead updated" : "Lead created");
      qc.invalidateQueries({ queryKey: ["transactions-leads"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const title = isView ? "View Lead" : isEdit ? "Edit Lead" : "New Lead";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!inset-0 !left-0 !right-0 !w-screen !max-h-none !max-w-none !translate-x-0 !translate-y-0 !rounded-none !m-0 overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
            {lead?.is_converted && <Badge variant="secondary">Converted</Badge>}
          </DialogTitle>
        </DialogHeader>

        {isView && lead?.is_converted && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            Converted on {lead.converted_at ? format(new Date(lead.converted_at), "dd MMM yyyy, HH:mm") : "—"}.
          </div>
        )}

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
            <Input type="email" value={form.email} disabled={isView} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>City</Label>
            <Input value={form.city} disabled={isView} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div>
            <Label>State</Label>
            <Input value={form.state} disabled={isView} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </div>
          <div>
            <Label>Date of Birth</Label>
            {isView ? (
              <Input value={formatDOB(form.date_of_birth)} disabled />
            ) : (
              <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            )}
            {!isView && <p className="text-[11px] text-muted-foreground mt-1">Displayed as dd-mm-yyyy</p>}
          </div>
          <div>
            <Label>Gender</Label>
            <GenderSelect value={form.gender} onChange={(v) => setForm({ ...form, gender: v || "" })} disabled={isView} />
          </div>
          <div className="col-span-2">
            <Label>Country</Label>
            <Input value={form.country} disabled={isView} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Address</Label>
            <Textarea value={form.address} disabled={isView} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isView ? "Close" : "Cancel"}</Button>
          {!isView && (
            <Button onClick={() => saveMut.mutate()} disabled={!form.phone || saveMut.isPending}>
              {saveMut.isPending ? "Saving..." : isEdit ? "Save" : "Create"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
