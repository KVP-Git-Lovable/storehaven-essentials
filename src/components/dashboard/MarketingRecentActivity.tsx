import { Sparkles, ShoppingCart, UserPlus, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { DashboardMetrics } from "@/hooks/useDashboardMetrics";

const iconMap: Record<string, any> = {
  journey: Sparkles,
  order: ShoppingCart,
  lead: UserPlus,
  customer: Users,
};
const colorMap: Record<string, string> = {
  journey: "bg-primary/10 text-primary",
  order: "bg-success/10 text-success",
  lead: "bg-warning/10 text-warning",
  customer: "bg-accent/10 text-accent",
};

export function MarketingRecentActivity({ items }: { items: DashboardMetrics["recent"] }) {
  return (
    <div className="stat-card h-full">
      <h3 className="font-semibold text-sm md:text-base mb-3">Recent Activity</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No recent activity</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const Icon = iconMap[item.type] || Sparkles;
            return (
              <div key={item.id} className="flex items-start gap-2.5">
                <div className={`rounded-md p-1.5 shrink-0 ${colorMap[item.type] || "bg-muted"}`}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(item.time), { addSuffix: true })}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}