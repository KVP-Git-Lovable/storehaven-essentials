import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Coins, Gem, Sparkles, Hammer } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const KARATS = ["14K", "18K", "22K"] as const;
type Karat = (typeof KARATS)[number];

export default function PriceConfiguration() {
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const todayLabel = format(new Date(), "dd MMM yyyy");

  // ---------- Making Charges ----------
  const [making, setMaking] = useState("");
  const [savingMaking, setSavingMaking] = useState(false);

  const { data: makingRow } = useQuery({
    queryKey: ["making-rate-today", today],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("making_charges_rates")
        .select("price_per_gram")
        .eq("rate_date", today)
        .maybeSingle();
      if (error) throw error;
      return data as { price_per_gram: number } | null;
    },
  });

  useEffect(() => {
    if (makingRow) setMaking(String(makingRow.price_per_gram));
  }, [makingRow]);

  const saveMaking = async () => {
    const v = Number(making);
    if (!(v > 0)) {
      toast.error("Enter a valid Making Charges rate");
      return;
    }
    setSavingMaking(true);
    try {
      const { error } = await (supabase as any)
        .from("making_charges_rates")
        .upsert([{ rate_date: today, price_per_gram: v }], { onConflict: "rate_date" });
      if (error) throw error;
      toast.success("Making Charges rate saved for today");
      qc.invalidateQueries({ queryKey: ["making-rate-today"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to save Making Charges rate");
    } finally {
      setSavingMaking(false);
    }
  };

  // ---------- Gold ----------
  const [gold, setGold] = useState<Record<Karat, string>>({ "14K": "", "18K": "", "22K": "" });
  const [savingGold, setSavingGold] = useState(false);

  const { data: goldRows } = useQuery({
    queryKey: ["gold-rates-today", today],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gold_rates")
        .select("karat, price_per_gram")
        .eq("rate_date", today);
      if (error) throw error;
      return (data || []) as { karat: string; price_per_gram: number }[];
    },
  });

  useEffect(() => {
    if (!goldRows) return;
    const next = { "14K": "", "18K": "", "22K": "" } as Record<Karat, string>;
    for (const r of goldRows) {
      if ((KARATS as readonly string[]).includes(r.karat)) {
        next[r.karat as Karat] = String(r.price_per_gram);
      }
    }
    setGold(next);
  }, [goldRows]);

  const saveGold = async () => {
    const rows: any[] = [];
    for (const k of KARATS) {
      const v = Number(gold[k]);
      if (v > 0) rows.push({ rate_date: today, karat: k, price_per_gram: v });
    }
    if (rows.length === 0) {
      toast.error("Enter at least one rate");
      return;
    }
    setSavingGold(true);
    try {
      const { error } = await (supabase as any)
        .from("gold_rates")
        .upsert(rows, { onConflict: "rate_date,karat" });
      if (error) throw error;
      toast.success("Gold rates saved for today");
      qc.invalidateQueries({ queryKey: ["gold-rates-today"] });
      qc.invalidateQueries({ queryKey: ["gold-rate-today"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to save gold rates");
    } finally {
      setSavingGold(false);
    }
  };

  // ---------- Diamond ----------
  type DiamondRow = { id: string; particulars: string; size_label: string; price_per_ct: number; sort_order: number };
  const [diamonds, setDiamonds] = useState<DiamondRow[]>([]);
  const [savingDia, setSavingDia] = useState(false);

  const { data: diaRows } = useQuery({
    queryKey: ["diamond-rates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("diamond_rates")
        .select("id, particulars, size_label, price_per_ct, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as DiamondRow[];
    },
  });

  useEffect(() => {
    if (diaRows) setDiamonds(diaRows);
  }, [diaRows]);

  const updateDia = (id: string, value: string) => {
    setDiamonds((prev) => prev.map((r) => (r.id === id ? { ...r, price_per_ct: Number(value) || 0 } : r)));
  };

  const saveDiamonds = async () => {
    setSavingDia(true);
    try {
      const updates = diamonds.map((r) =>
        (supabase as any).from("diamond_rates").update({ price_per_ct: r.price_per_ct }).eq("id", r.id)
      );
      const results = await Promise.all(updates);
      const firstErr = results.find((r: any) => r.error)?.error;
      if (firstErr) throw firstErr;
      toast.success("Diamond rates saved");
      qc.invalidateQueries({ queryKey: ["diamond-rates"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to save diamond rates");
    } finally {
      setSavingDia(false);
    }
  };

  // ---------- CS ----------
  const [cs, setCs] = useState("");
  const [savingCs, setSavingCs] = useState(false);

  const { data: csRow } = useQuery({
    queryKey: ["cs-rate-today", today],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cs_rates")
        .select("price_per_gram")
        .eq("rate_date", today)
        .maybeSingle();
      if (error) throw error;
      return data as { price_per_gram: number } | null;
    },
  });

  useEffect(() => {
    if (csRow) setCs(String(csRow.price_per_gram));
  }, [csRow]);

  const saveCs = async () => {
    const v = Number(cs);
    if (!(v > 0)) {
      toast.error("Enter a valid CS rate");
      return;
    }
    setSavingCs(true);
    try {
      const { error } = await (supabase as any)
        .from("cs_rates")
        .upsert([{ rate_date: today, price_per_gram: v }], { onConflict: "rate_date" });
      if (error) throw error;
      toast.success("CS rate saved for today");
      qc.invalidateQueries({ queryKey: ["cs-rate-today"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to save CS rate");
    } finally {
      setSavingCs(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Price Configuration</h1>
        <p className="text-muted-foreground">Set gold, diamond and colour-stone rates used to price jewellery in new orders.</p>
      </div>

      {/* Gold */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" /> Gold Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Date</Label>
              <Input value={todayLabel} disabled />
            </div>
            {KARATS.map((k) => (
              <div key={k}>
                <Label>{k} – Price per 1g (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={gold[k]}
                  onChange={(e) => setGold((prev) => ({ ...prev, [k]: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={saveGold} disabled={savingGold}>
              {savingGold ? "Saving..." : "Save Gold Rates"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Diamond */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gem className="h-5 w-5" /> Diamond Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="w-16 text-center">SR NO</TableHead>
                  <TableHead>PARTICULARS</TableHead>
                  <TableHead>SIZE</TableHead>
                  <TableHead className="text-right">PRICE/CT (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diamonds.map((row, i) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-center">{i + 1}</TableCell>
                    <TableCell>{row.particulars}</TableCell>
                    <TableCell>{row.size_label}</TableCell>
                    <TableCell className="text-right bg-emerald-50">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={row.price_per_ct}
                        onChange={(e) => updateDia(row.id, e.target.value)}
                        className="text-right"
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {diamonds.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveDiamonds} disabled={savingDia || diamonds.length === 0}>
              {savingDia ? "Saving..." : "Save Diamond Rates"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Colour Stone (CS) Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Date</Label>
              <Input value={todayLabel} disabled />
            </div>
            <div>
              <Label>CS – Price per 1g (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={cs}
                onChange={(e) => setCs(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            CS Price on an order line = Colour Stone Wt of the product × today's CS rate.
          </p>
          <div className="flex justify-end">
            <Button onClick={saveCs} disabled={savingCs}>
              {savingCs ? "Saving..." : "Save CS Rate"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}