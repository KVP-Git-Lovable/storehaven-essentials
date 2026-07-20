import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function GoldRateDialog() {
  const [open, setOpen] = useState(false);
  const [rate18, setRate18] = useState("");
  const [rate22, setRate22] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: existing } = useQuery({
    queryKey: ["gold-rate-today", today],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gold_rates" as any)
        .select("karat, price_per_gram")
        .eq("rate_date", today);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!open || !existing) return;
    const r18 = existing.find((r: any) => r.karat === "18K");
    const r22 = existing.find((r: any) => r.karat === "22K");
    setRate18(r18 ? String(r18.price_per_gram) : "");
    setRate22(r22 ? String(r22.price_per_gram) : "");
  }, [open, existing]);

  const save = async () => {
    const v18 = Number(rate18);
    const v22 = Number(rate22);
    if (!(v18 > 0) && !(v22 > 0)) {
      toast.error("Enter at least one rate");
      return;
    }
    setSaving(true);
    try {
      const rows: any[] = [];
      if (v18 > 0) rows.push({ rate_date: today, karat: "18K", price_per_gram: v18 });
      if (v22 > 0) rows.push({ rate_date: today, karat: "22K", price_per_gram: v22 });
      const { error } = await supabase.from("gold_rates" as any).upsert(rows, { onConflict: "rate_date,karat" });
      if (error) throw error;
      toast.success("Gold rate saved for today");
      qc.invalidateQueries({ queryKey: ["gold-rate-today"] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save gold rate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Coins className="mr-2 h-4 w-4" /> Set Gold Rate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Gold Rate</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Date</Label>
            <Input value={format(new Date(), "dd MMM yyyy")} disabled />
          </div>
          <div>
            <Label>18K – Price per 1g (₹)</Label>
            <Input type="number" min="0" step="0.01" value={rate18} onChange={(e) => setRate18(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <Label>22K – Price per 1g (₹)</Label>
            <Input type="number" min="0" step="0.01" value={rate22} onChange={(e) => setRate22(e.target.value)} placeholder="0.00" />
          </div>
          <p className="text-xs text-muted-foreground">This rate will be used to price jewellery products in orders created today.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}