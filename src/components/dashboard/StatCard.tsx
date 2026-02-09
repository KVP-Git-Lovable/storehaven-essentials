import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
}

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor = "bg-primary/10 text-primary",
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs md:text-sm font-medium text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">{title}</p>
          <p className="mt-1 md:mt-2 text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">{value}</p>
          {change && (
            <p
              className={cn(
                "mt-1 text-xs md:text-sm whitespace-nowrap overflow-hidden text-ellipsis",
                changeType === "positive" && "text-success",
                changeType === "negative" && "text-destructive",
                changeType === "neutral" && "text-muted-foreground"
              )}
            >
              {change}
            </p>
          )}
        </div>
        <div className={cn("rounded-lg p-1.5 sm:p-2 md:p-2.5 shrink-0", iconColor)}>
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
        </div>
      </div>
    </div>
  );
}
