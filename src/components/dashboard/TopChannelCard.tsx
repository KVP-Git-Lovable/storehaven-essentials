import { TrendingUp } from "lucide-react";
import type { DashboardMetrics } from "@/hooks/useDashboardMetrics";

export function TopChannelCard({ data }: { data: DashboardMetrics["channelCompare"] }) {
  const sorted = [...data].sort((a, b) => b.engagement - a.engagement);
  const top = sorted[0];
  const second = sorted[1];
  const delta = top && second && second.engagement > 0 ? ((top.engagement - second.engagement) / Math.max(second.engagement, 1)) * 100 : null;

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">Top Performing Channel</h3>
        <TrendingUp className="h-4 w-4 text-success" />
      </div>
      <p className="text-xl font-semibold">{top?.channel || "—"}</p>
      <p className="text-xs text-muted-foreground mt-1">
        Engagement {top?.engagement || 0}%
        {delta !== null && second && (
          <span className="ml-1 text-success font-medium">• {delta.toFixed(0)}% better than {second.channel}</span>
        )}
      </p>
    </div>
  );
}