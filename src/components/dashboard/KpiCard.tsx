import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SubMetric = { label: string; value: string | number };

interface KpiCardProps {
  title: string;
  primary: string | number;
  primaryLabel?: string;
  subMetrics?: SubMetric[];
  delta?: number;
  icon: LucideIcon;
  iconColor?: string;
}

export function KpiCard({ title, primary, primaryLabel, subMetrics, delta, icon: Icon, iconColor = "bg-primary/10 text-primary" }: KpiCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">{title}</p>
          <p className="mt-1 text-lg sm:text-xl md:text-2xl font-semibold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
            {primary}
            {primaryLabel && <span className="ml-1 text-xs text-muted-foreground font-normal">{primaryLabel}</span>}
          </p>
          {subMetrics && subMetrics.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {subMetrics.map((m) => (
                <div key={m.label} className="flex items-center justify-between text-[11px] sm:text-xs text-muted-foreground gap-2">
                  <span className="truncate">{m.label}</span>
                  <span className="font-medium text-foreground whitespace-nowrap">{m.value}</span>
                </div>
              ))}
            </div>
          )}
          {typeof delta === "number" && (
            <p className={cn("mt-2 text-xs font-medium whitespace-nowrap", delta >= 0 ? "text-success" : "text-destructive")}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% MoM
            </p>
          )}
        </div>
        <div className={cn("rounded-lg p-2 shrink-0", iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}