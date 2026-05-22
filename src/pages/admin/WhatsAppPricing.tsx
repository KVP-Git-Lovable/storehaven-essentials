import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { CATEGORY_BADGE, fmtINR } from "@/lib/journeyCost";

export default function WhatsAppPricing() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const pricingQ = useQuery({
    queryKey: ["wa-pricing-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_pricing_config")
        .select("*")
        .order("category")
        .order("service_window");
      if (error) throw error;
      return data || [];
    },
  });

  const fxQ = useQuery({
    queryKey: ["fx-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fx_rates")
        .select("*")
        .eq("from_currency", "USD")
        .eq("to_currency", "INR")
        .order("fetched_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const [edits, setEdits] = useState<Record<string, { meta: string; twilio: string }>>({});
  useEffect(() => {
    if (!pricingQ.data) return;
    const m: Record<string, { meta: string; twilio: string }> = {};
    pricingQ.data.forEach((r: any) => {
      m[r.id] = { meta: String(r.meta_fee_usd), twilio: String(r.twilio_fee_usd) };
    });
    setEdits(m);
  }, [pricingQ.data]);

  const [newRate, setNewRate] = useState("");

  if (!isAdmin) {
    return <div className="p-6 text-muted-foreground">Admin access required.</div>;
  }

  const saveRow = async (id: string) => {
    const e = edits[id];
    if (!e) return;
    const { error } = await supabase
      .from("whatsapp_pricing_config")
      .update({ meta_fee_usd: Number(e.meta), twilio_fee_usd: Number(e.twilio) })
      .eq("id", id);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Pricing updated" });
    qc.invalidateQueries({ queryKey: ["wa-pricing-admin"] });
    qc.invalidateQueries({ queryKey: ["wa-pricing-table"] });
  };

  const saveFx = async () => {
    const v = parseFloat(newRate);
    if (!v || v <= 0) return toast({ title: "Enter a valid rate", variant: "destructive" });
    // Mark old rows inactive, insert new one as active
    await supabase.from("fx_rates").update({ is_active: false })
      .eq("from_currency", "USD").eq("to_currency", "INR").eq("is_active", true);
    const { error } = await supabase.from("fx_rates").insert({
      from_currency: "USD", to_currency: "INR", rate: v, source: "manual", is_active: true,
    });
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "FX rate updated" });
    setNewRate("");
    qc.invalidateQueries({ queryKey: ["fx-admin"] });
    qc.invalidateQueries({ queryKey: ["wa-pricing-table"] });
  };

  const activeFx = fxQ.data?.find((r: any) => r.is_active);
  const fx = activeFx ? Number(activeFx.rate) : 95;

  return (
    <div className="space-y-6 p-1">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp Pricing</h1>
        <p className="text-muted-foreground">Per-message fees used by Journey Cost Analytics.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">USD → INR Exchange Rate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            Active rate: <span className="font-semibold">1 USD ≈ ₹{fx.toFixed(2)}</span>
            {activeFx && (
              <span className="text-xs text-muted-foreground ml-2">
                · source: {activeFx.source} · {new Date(activeFx.fetched_at).toLocaleString("en-IN")}
              </span>
            )}
          </p>
          <div className="flex gap-2 max-w-sm">
            <Input
              type="number"
              step="0.01"
              placeholder="New rate"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
            />
            <Button onClick={saveFx}>Update</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Message Pricing (India)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Service Window</TableHead>
                <TableHead className="text-right">Meta fee (USD)</TableHead>
                <TableHead className="text-right">Twilio fee (USD)</TableHead>
                <TableHead className="text-right">Total / msg</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(pricingQ.data || []).map((r: any) => {
                const e = edits[r.id] || { meta: "", twilio: "" };
                const totalUsd = (Number(e.meta) || 0) + (Number(e.twilio) || 0);
                const catKey = r.category === "FAILED_FEE" ? null : (r.category as any);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      {catKey ? (
                        <Badge variant="outline" className={CATEGORY_BADGE[catKey as keyof typeof CATEGORY_BADGE]}>
                          {r.category}
                        </Badge>
                      ) : (
                        <Badge variant="outline">FAILED FEE</Badge>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{r.service_window}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.0001"
                        value={e.meta}
                        onChange={(ev) =>
                          setEdits((s) => ({ ...s, [r.id]: { ...s[r.id], meta: ev.target.value } }))
                        }
                        className="w-28 ml-auto text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.0001"
                        value={e.twilio}
                        onChange={(ev) =>
                          setEdits((s) => ({ ...s, [r.id]: { ...s[r.id], twilio: ev.target.value } }))
                        }
                        className="w-28 ml-auto text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${totalUsd.toFixed(4)} <span className="text-xs text-muted-foreground">· {fmtINR(totalUsd, fx)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => saveRow(r.id)}>Save</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}