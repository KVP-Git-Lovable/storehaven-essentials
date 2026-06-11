import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Activity, Users, Gauge, Wallet, RefreshCw } from "lucide-react";

function useJourneyOverview() {
  return useQuery({
    queryKey: ["dashboard-journey-overview"],
    queryFn: async () => {
      const { data: journeys, error: jErr } = await supabase
        .from("journeys")
        .select("id, status");
      if (jErr) throw jErr;
      const activeIds = (journeys || []).filter((j: any) => j.status === "active").map((j: any) => j.id);
      const totalJourneys = (journeys || []).length;
      const activeJourneys = activeIds.length;

      let totalUsers = 0;
      if (activeIds.length > 0) {
        const { count } = await supabase
          .from("journey_enrollments")
          .select("id", { count: "exact", head: true })
          .in("journey_id", activeIds);
        totalUsers = count || 0;
      }

      // Health score from engagement events
      const { data: events } = await supabase
        .from("journey_message_events" as any)
        .select("event_type")
        .limit(10000);
      const counts = { sent: 0, delivered: 0, read: 0, clicked: 0, failed: 0 };
      for (const e of (events || []) as any[]) {
        const t = e.event_type as keyof typeof counts;
        if (t in counts) counts[t]++;
      }
      const sent = counts.sent || 0;
      const deliveredRate = sent ? counts.delivered / sent : 0;
      const readRate = counts.delivered ? counts.read / counts.delivered : 0;
      const clickRate = counts.read ? counts.clicked / counts.read : 0;
      const failRate = sent ? counts.failed / sent : 0;
      const activeRatio = totalJourneys ? activeJourneys / totalJourneys : 0;

      const health = sent === 0 && totalJourneys === 0
        ? 0
        : Math.round(
            deliveredRate * 30 +
            readRate * 25 +
            clickRate * 20 +
            (1 - failRate) * 15 +
            activeRatio * 10
          );

      return {
        activeJourneys,
        totalUsers,
        health: Math.max(0, Math.min(100, health)),
      };
    },
    staleTime: 60_000,
  });
}

function useWhatsAppBalanceInr() {
  const balance = useQuery<{ balance: string; currency: string }>({
    queryKey: ["twilio-balance"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("twilio-balance");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
    staleTime: 3 * 60_000,
    refetchOnWindowFocus: false,
  });

  const fx = useQuery<{ rate: number }>({
    queryKey: ["usd-inr-rate"],
    queryFn: async () => {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const json = await res.json();
      const rate = json?.rates?.INR;
      if (!rate) throw new Error("INR rate unavailable");
      return { rate };
    },
    staleTime: 6 * 60 * 60_000,
    refetchOnWindowFocus: false,
  });

  return { balance, fx };
}

function HealthGauge({ value }: { value: number }) {
  const radius = 56;
  const circ = Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const dash = circ * pct;
  const color = value >= 75 ? "hsl(var(--success))" : value >= 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  return (
    <div className="relative w-[160px] h-[90px]">
      <svg viewBox="0 0 140 80" className="w-full h-full">
        <path d="M 14 74 A 56 56 0 0 1 126 74" stroke="hsl(var(--muted))" strokeWidth="12" fill="none" strokeLinecap="round" />
        <path
          d="M 14 74 A 56 56 0 0 1 126 74"
          stroke={color}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
        <span className="text-2xl font-bold leading-none">{value}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

export function JourneyOverviewSection() {
  const { data, isLoading } = useJourneyOverview();
  const { balance, fx } = useWhatsAppBalanceInr();

  const usd = balance.data?.balance != null ? parseFloat(balance.data.balance) : null;
  const inr = usd != null && !Number.isNaN(usd) && fx.data?.rate ? usd * fx.data.rate : null;
  const inrFormatted = inr != null
    ? inr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";

  return (
    <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Journey Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Active Journeys</p>
                <p className="text-2xl md:text-3xl font-semibold mt-1">{(data?.activeJourneys || 0).toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> Journey Users
                </p>
                <p className="text-2xl md:text-3xl font-semibold mt-1">{(data?.totalUsers || 0).toLocaleString("en-IN")}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            Overall Journey Health
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          {isLoading ? <Skeleton className="h-20 w-40" /> : <HealthGauge value={data?.health ?? 0} />}
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            WhatsApp API Wallet Balance
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => balance.refetch()}
            disabled={balance.isFetching}
            title="Refresh balance"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${balance.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {balance.isLoading ? (
            <Skeleton className="h-10 w-32" />
          ) : (
            <>
              <p className="text-2xl md:text-3xl font-semibold">₹{inrFormatted}</p>
              {fx.data?.rate && (
                <p className="text-[11px] text-muted-foreground mt-1">1 USD ≈ ₹{fx.data.rate.toFixed(2)}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}