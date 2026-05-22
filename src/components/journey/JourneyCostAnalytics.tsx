import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useJourneyCostAnalytics } from "@/hooks/useJourneyCostAnalytics";
import { CATEGORY_BADGE, Category, fmtINR, fmtUSD } from "@/lib/journeyCost";
import { JourneyCostSettingsPopover } from "./JourneyCostSettingsPopover";
import { Wallet, TrendingUp, AlertCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useState } from "react";

const CATS: Category[] = ["MARKETING", "UTILITY", "AUTHENTICATION"];

function MoneyCell({ usd, fx }: { usd: number; fx: number }) {
  return (
    <div className="leading-tight">
      <div className="font-semibold tabular-nums">{fmtINR(usd, fx)}</div>
      <div className="text-xs text-muted-foreground tabular-nums">{fmtUSD(usd)}</div>
    </div>
  );
}

export default function JourneyCostAnalytics({ journeyId }: { journeyId: string }) {
  const { data, isLoading } = useJourneyCostAnalytics(journeyId);
  const [bucket, setBucket] = useState<"day" | "week" | "month">("day");

  const wallet = useQuery({
    queryKey: ["twilio-balance-cost"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("twilio-balance");
      if (error) throw error;
      return data as { balance: string | null; currency: string };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader><CardTitle>Journey Cost Analytics</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const fx = data.pricing.fxRate;
  const { actual, projected } = data;
  const costPerDelivered = actual.delivered > 0 ? actual.totalUsd / actual.delivered : 0;
  const costPerRecipient = data.recipientCount > 0 ? actual.totalUsd / data.recipientCount : 0;

  const walletBalUsd = wallet.data?.balance ? parseFloat(wallet.data.balance) : null;
  const projRemaining = walletBalUsd !== null ? walletBalUsd - projected.totalUsd : null;
  const actualRemaining = walletBalUsd !== null ? walletBalUsd - actual.totalUsd : null;

  const trendBuckets = bucketize(data.trend, bucket);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Journey Cost Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Estimated and actual WhatsApp spend · 1 USD ≈ ₹{fx.toFixed(2)}
          </p>
        </div>
        <JourneyCostSettingsPopover
          journeyId={journeyId}
          inWindowPct={data.inWindowPct}
          entryPointType={data.entryPointType}
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Projected Spend</p>
            <MoneyCell usd={projected.totalUsd} fx={fx} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Actual Spend</p>
            <MoneyCell usd={actual.totalUsd} fx={fx} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Delivered</p>
            <p className="text-2xl font-semibold tabular-nums text-green-600">
              {actual.delivered.toLocaleString("en-IN")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Failed</p>
            <p className="text-2xl font-semibold tabular-nums text-destructive">
              {actual.failed.toLocaleString("en-IN")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Cost / Delivered</p>
            <MoneyCell usd={costPerDelivered} fx={fx} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Cost / Recipient</p>
            <MoneyCell usd={costPerRecipient} fx={fx} />
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown */}
      <Card>
        <CardHeader><CardTitle className="text-base">Category Cost Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CATS.map((c) => {
              const v = actual.byCategory[c];
              return (
                <div key={c} className="rounded-lg border p-4">
                  <Badge variant="outline" className={CATEGORY_BADGE[c]}>{c}</Badge>
                  <div className="mt-3">
                    <MoneyCell usd={v.usd} fx={fx} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {v.count.toLocaleString("en-IN")} delivered
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step costing */}
      <Card>
        <CardHeader><CardTitle className="text-base">Journey Step Costing</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Step</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">In-window</TableHead>
                <TableHead className="text-right">Out-window</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Actual Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.values(actual.byStep).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No sent messages yet.
                  </TableCell>
                </TableRow>
              ) : (
                Object.values(actual.byStep).map((s) => (
                  <TableRow key={s.node_id}>
                    <TableCell className="font-medium">{s.label || s.node_id}</TableCell>
                    <TableCell>
                      {s.category ? (
                        <Badge variant="outline" className={CATEGORY_BADGE[s.category]}>
                          {s.category}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.delivered}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.in_window_delivered}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.out_window_delivered}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{s.failed}</TableCell>
                    <TableCell className="text-right"><MoneyCell usd={s.actual_usd} fx={fx} /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Wallet impact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Wallet Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          {wallet.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : walletBalUsd === null ? (
            <p className="text-sm text-muted-foreground">Wallet balance unavailable.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Wallet Balance</p>
                <MoneyCell usd={walletBalUsd} fx={fx} />
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">After Projected Spend</p>
                <MoneyCell usd={Math.max(0, projRemaining || 0)} fx={fx} />
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">After Actual Spend</p>
                <MoneyCell usd={Math.max(0, actualRemaining || 0)} fx={fx} />
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">Informational only. Does not block sends.</p>
        </CardContent>
      </Card>

      {/* Trend */}
      {trendBuckets.length > 1 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Cost Trend
            </CardTitle>
            <div className="flex gap-1">
              {(["day", "week", "month"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBucket(b)}
                  className={`px-2.5 py-1 text-xs rounded ${
                    bucket === b ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {b[0].toUpperCase() + b.slice(1)}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendBuckets.map((p) => ({ ...p, inr: p.usd * fx }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Math.round(v)}`} />
                  <RTooltip formatter={(v: number) => fmtINR(v / fx, fx)} />
                  <Line type="monotone" dataKey="inr" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 border rounded-md bg-muted/30">
        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>
          Projected spend is estimated. Actual cost may vary based on service window eligibility,
          failed messages, delivery, and WhatsApp pricing updates.
        </p>
      </div>
    </div>
  );
}

function bucketize(
  trend: { day: string; usd: number }[],
  bucket: "day" | "week" | "month",
): { label: string; usd: number }[] {
  if (bucket === "day") return trend.map((t) => ({ label: t.day.slice(5), usd: t.usd }));
  const out = new Map<string, number>();
  for (const t of trend) {
    const d = new Date(t.day);
    let key: string;
    if (bucket === "month") {
      key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    } else {
      // ISO week start (Monday)
      const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const day = dt.getUTCDay() || 7;
      dt.setUTCDate(dt.getUTCDate() - day + 1);
      key = `W ${dt.toISOString().slice(5, 10)}`;
    }
    out.set(key, (out.get(key) || 0) + t.usd);
  }
  return Array.from(out.entries()).map(([label, usd]) => ({ label, usd }));
}