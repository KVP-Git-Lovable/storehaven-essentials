import { Users } from "lucide-react";
import type { DashboardMetrics } from "@/hooks/useDashboardMetrics";

export function TeamSnapshotCard({ team }: { team: DashboardMetrics["team"] }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">Team Activity</h3>
        <Users className="h-4 w-4 text-info" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Active users</span>
          <span className="font-semibold">{team.active}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Top performer</span>
          <span className="font-medium truncate ml-2">{team.topUser ? `${team.topUser.name} (${team.topUser.orders})` : "—"}</span>
        </div>
      </div>
    </div>
  );
}