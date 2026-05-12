import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function WalletBalanceCard() {
  const { data, isLoading, refetch, isFetching } = useQuery<{ balance: string; currency: string; fetched_at: string; cached: boolean }>({
    queryKey: ["twilio-balance"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("twilio-balance");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { balance: string; currency: string; fetched_at: string; cached: boolean };
    },
    staleTime: 3 * 60_000,
    refetchOnWindowFocus: false,
  });

  const balanceNum = data?.balance != null ? parseFloat(data.balance) : null;
  const formatted =
    balanceNum != null && !Number.isNaN(balanceNum)
      ? balanceNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "—";

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Twilio Wallet Balance
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-32 mt-1" />
            ) : (
              <p className="text-xl md:text-2xl font-semibold">
                ${formatted} <span className="text-sm text-muted-foreground font-normal">{data?.currency || "USD"}</span>
              </p>
            )}
            {data?.fetched_at && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Updated {new Date(data.fetched_at).toLocaleTimeString()}
                {data.cached ? " (cached)" : ""}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          title="Refresh balance"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </CardContent>
    </Card>
  );
}