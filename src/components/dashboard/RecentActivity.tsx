import { AlertTriangle, CheckCircle, Clock, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const activities = [
  {
    id: 1,
    type: "incident",
    title: "AC unit malfunction",
    store: "Downtown Store",
    time: "2 hours ago",
    status: "open",
  },
  {
    id: 2,
    type: "maintenance",
    title: "Generator servicing completed",
    store: "Mall Outlet",
    time: "4 hours ago",
    status: "completed",
  },
  {
    id: 3,
    type: "incident",
    title: "POS terminal issue",
    store: "Airport Kiosk",
    time: "Yesterday",
    status: "in-progress",
  },
  {
    id: 4,
    type: "maintenance",
    title: "Fire extinguisher inspection due",
    store: "Suburban Store",
    time: "Tomorrow",
    status: "pending",
  },
];

const statusConfig = {
  open: { color: "text-destructive", bgColor: "bg-destructive/10", icon: AlertTriangle },
  completed: { color: "text-success", bgColor: "bg-success/10", icon: CheckCircle },
  "in-progress": { color: "text-warning", bgColor: "bg-warning/10", icon: Clock },
  pending: { color: "text-info", bgColor: "bg-info/10", icon: Clock },
};

export function RecentActivity() {
  return (
    <div className="stat-card">
      <h3 className="font-semibold mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {activities.map((activity) => {
          const config = statusConfig[activity.status as keyof typeof statusConfig];
          const StatusIcon = config.icon;
          return (
            <div key={activity.id} className="flex items-start gap-3">
              <div className={cn("rounded-lg p-2", config.bgColor)}>
                <StatusIcon className={cn("h-4 w-4", config.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{activity.title}</p>
                <p className="text-xs text-muted-foreground">
                  {activity.store} • {activity.time}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
