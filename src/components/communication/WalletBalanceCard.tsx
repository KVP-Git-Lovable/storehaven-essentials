import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function WalletBalanceCard() {
  const { data, isLoading, refetch, isFetching } = useQuery<{ balance: string; currency: string; fetched_at: string; cached: boolean }>({
    queryKey: ["twilio-balance"],
    queryFn: async ({ meta }) => {
      const force = (meta as any)?.force === true;
      const { data, error } = await supabase.functions.invoke("twilio-balance", {
        body: force ? { force: true } : {},
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { balance: string; currency: string; fetched_at: string; cached: boolean };
    },
    staleTime: 3 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: fx } = useQuery<{ rate: number; date: string }>({
    queryKey: ["usd-inr-rate"],
    queryFn: async () => {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const json = await res.json();
      const rate = json?.rates?.INR;
      if (!rate) throw new Error("INR rate unavailable");
      return { rate, date: json?.time_last_update_utc ?? "" };
    },
    staleTime: 6 * 60 * 60_000,
    refetchOnWindowFocus: false,
  });

  const balanceNum = data?.balance != null ? parseFloat(data.balance) : null;
  const formatted =
    balanceNum != null && !Number.isNaN(balanceNum)
      ? balanceNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "—";

  const inrFormatted =
    balanceNum != null && !Number.isNaN(balanceNum) && fx?.rate
      ? (balanceNum * fx.rate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : null;

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              API Wallet Balance
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-32 mt-1" />
            ) : (
              <p className="text-xl md:text-2xl font-semibold">
                ${formatted} <span className="text-sm text-muted-foreground font-normal">{data?.currency || "USD"}</span>
                {inrFormatted && (
                  <span className="text-sm text-muted-foreground font-normal"> (₹{inrFormatted})</span>
                )}
              </p>
            )}
            {data?.fetched_at && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Updated {new Date(data.fetched_at).toLocaleTimeString()}
                {data.cached ? " (cached)" : ""}
                {fx?.rate ? ` · 1 USD ≈ ₹${fx.rate.toFixed(2)}` : ""}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch({ meta: { force: true } } as any)}
          disabled={isFetching}
          title="Refresh balance"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </CardContent>
    </Card>
  );
}