import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, Clock, Wrench, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useStoreAccess } from "@/hooks/useStoreAccess";
import { formatDistanceToNow } from "date-fns";

type ActivityItem = {
  id: string;
  type: "incident" | "maintenance";
  title: string;
  store: string;
  time: string;
  status: string;
};

const statusConfig = {
  open: { color: "text-destructive", bgColor: "bg-destructive/10", icon: AlertTriangle },
  in_progress: { color: "text-warning", bgColor: "bg-warning/10", icon: Clock },
  completed: { color: "text-success", bgColor: "bg-success/10", icon: CheckCircle },
  resolved: { color: "text-success", bgColor: "bg-success/10", icon: CheckCircle },
  closed: { color: "text-muted-foreground", bgColor: "bg-muted", icon: CheckCircle },
  scheduled: { color: "text-info", bgColor: "bg-info/10", icon: Clock },
  "due-soon": { color: "text-warning", bgColor: "bg-warning/10", icon: Clock },
  overdue: { color: "text-destructive", bgColor: "bg-destructive/10", icon: AlertTriangle },
};

export function RecentActivity() {
  const { accessibleStoreIds, isAdmin, loading: accessLoading } = useStoreAccess();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessLoading) {
      fetchActivities();
    }
  }, [accessLoading, accessibleStoreIds]);

  const fetchActivities = async () => {
    setLoading(true);
    
    try {
      const storeIds = Array.from(accessibleStoreIds);
      
      // Fetch recent tickets
      let ticketsQuery = supabase
        .from("service_tickets")
        .select("id, title, status, created_at, store:store_id(name)")
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (!isAdmin && storeIds.length > 0) {
        ticketsQuery = ticketsQuery.in("store_id", storeIds);
      }
      
      const { data: ticketsData } = await ticketsQuery;
      
      // Fetch recent maintenance tasks
      let maintenanceQuery = supabase
        .from("maintenance_tasks")
        .select("id, asset, status, next_due, store:store_id(name)")
        .order("updated_at", { ascending: false })
        .limit(5);
      
      if (!isAdmin && storeIds.length > 0) {
        maintenanceQuery = maintenanceQuery.in("store_id", storeIds);
      }
      
      const { data: maintenanceData } = await maintenanceQuery;

      // Combine and format activities
      const ticketActivities: ActivityItem[] = (ticketsData || []).map(t => ({
        id: `ticket-${t.id}`,
        type: "incident" as const,
        title: t.title,
        store: (t.store as { name: string } | null)?.name || "Unknown Store",
        time: formatDistanceToNow(new Date(t.created_at), { addSuffix: true }),
        status: t.status,
      }));

      const maintenanceActivities: ActivityItem[] = (maintenanceData || []).map(m => ({
        id: `maintenance-${m.id}`,
        type: "maintenance" as const,
        title: m.asset,
        store: (m.store as { name: string } | null)?.name || "Unknown Store",
        time: formatDistanceToNow(new Date(m.next_due), { addSuffix: true }),
        status: m.status,
      }));

      // Combine and take latest 4
      const combined = [...ticketActivities, ...maintenanceActivities]
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 4);

      setActivities(combined);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || accessLoading) {
    return (
      <div className="stat-card">
        <h3 className="font-semibold mb-4">Recent Activity</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <h3 className="font-semibold mb-4">Recent Activity</h3>
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => {
            const config = statusConfig[activity.status as keyof typeof statusConfig] || statusConfig.scheduled;
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
      )}
    </div>
  );
}
