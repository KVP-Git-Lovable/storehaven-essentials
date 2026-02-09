import { useState, useEffect } from "react";
import { Store, Package, AlertTriangle, Wrench, DollarSign, Users, Loader2 } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { useStoreAccess } from "@/hooks/useStoreAccess";
import { supabase } from "@/integrations/supabase/client";

type DashboardStats = {
  totalStores: number;
  activeAssets: number;
  openIncidents: number;
  pendingMaintenance: number;
  monthlyExpenses: string;
  totalStaff: number;
};

export default function Dashboard() {
  const { accessibleStoreIds, isAdmin, loading: accessLoading } = useStoreAccess();
  const [stats, setStats] = useState<DashboardStats>({
    totalStores: 0,
    activeAssets: 0,
    openIncidents: 0,
    pendingMaintenance: 0,
    monthlyExpenses: "₹0",
    totalStaff: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessLoading) {
      fetchStats();
    }
  }, [accessLoading, accessibleStoreIds]);

  const fetchStats = async () => {
    setLoading(true);
    
    try {
      const storeIds = Array.from(accessibleStoreIds);
      
      // Fetch stores count
      let storesQuery = supabase.from("stores").select("id", { count: "exact", head: true });
      if (!isAdmin && storeIds.length > 0) {
        storesQuery = storesQuery.in("id", storeIds);
      }
      const { count: storesCount } = await storesQuery;

      // Fetch active assets count
      let assetsQuery = supabase.from("assets").select("id", { count: "exact", head: true }).eq("asset_status", "active");
      if (!isAdmin && storeIds.length > 0) {
        assetsQuery = assetsQuery.in("store_id", storeIds);
      }
      const { count: assetsCount } = await assetsQuery;

      // Fetch open incidents count
      let ticketsQuery = supabase.from("service_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]);
      if (!isAdmin && storeIds.length > 0) {
        ticketsQuery = ticketsQuery.in("store_id", storeIds);
      }
      const { count: ticketsCount } = await ticketsQuery;

      // Fetch pending maintenance count
      let maintenanceQuery = supabase.from("maintenance_tasks").select("id", { count: "exact", head: true }).in("status", ["scheduled", "due-soon", "overdue"]);
      if (!isAdmin && storeIds.length > 0) {
        maintenanceQuery = maintenanceQuery.in("store_id", storeIds);
      }
      const { count: maintenanceCount } = await maintenanceQuery;

      // Fetch this month's petty cash expenses
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      let expensesQuery = supabase.from("petty_cash_expenses").select("amount").gte("date", startOfMonth.toISOString());
      if (!isAdmin && storeIds.length > 0) {
        // Join through petty_cash to filter by store
        expensesQuery = supabase
          .from("petty_cash_expenses")
          .select("amount, petty_cash!inner(store_id)")
          .gte("date", startOfMonth.toISOString());
        
        if (storeIds.length > 0) {
          expensesQuery = supabase
            .from("petty_cash_expenses")
            .select("amount, petty_cash!inner(store_id)")
            .gte("date", startOfMonth.toISOString())
            .in("petty_cash.store_id", storeIds);
        }
      }
      const { data: expensesData } = await expensesQuery;
      const totalExpenses = (expensesData || []).reduce((sum, e) => sum + (e.amount || 0), 0);
      const formattedExpenses = totalExpenses >= 100000 
        ? `₹${(totalExpenses / 100000).toFixed(1)}L`
        : `₹${totalExpenses.toLocaleString("en-IN")}`;

      // Fetch employees count
      const { count: staffCount } = await supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "active");

      setStats({
        totalStores: storesCount || 0,
        activeAssets: assetsCount || 0,
        openIncidents: ticketsCount || 0,
        pendingMaintenance: maintenanceCount || 0,
        monthlyExpenses: formattedExpenses,
        totalStaff: staffCount || 0,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || accessLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Stores",
      value: stats.totalStores,
      change: isAdmin ? "All stores" : `${stats.totalStores} accessible`,
      changeType: "positive" as const,
      icon: Store,
      iconColor: "bg-primary/10 text-primary",
    },
    {
      title: "Active Assets",
      value: stats.activeAssets,
      change: "Operational",
      changeType: "positive" as const,
      icon: Package,
      iconColor: "bg-accent/10 text-accent",
    },
    {
      title: "Open Incidents",
      value: stats.openIncidents,
      change: stats.openIncidents > 0 ? "Needs attention" : "All resolved",
      changeType: stats.openIncidents > 0 ? "negative" as const : "positive" as const,
      icon: AlertTriangle,
      iconColor: "bg-destructive/10 text-destructive",
    },
    {
      title: "Pending Maintenance",
      value: stats.pendingMaintenance,
      change: stats.pendingMaintenance > 0 ? "Scheduled" : "Up to date",
      changeType: stats.pendingMaintenance > 3 ? "negative" as const : "neutral" as const,
      icon: Wrench,
      iconColor: "bg-warning/10 text-warning",
    },
    {
      title: "Monthly Expenses",
      value: stats.monthlyExpenses,
      change: "This month",
      changeType: "neutral" as const,
      icon: DollarSign,
      iconColor: "bg-success/10 text-success",
    },
    {
      title: "Total Staff",
      value: stats.totalStaff,
      change: "Active employees",
      changeType: "neutral" as const,
      icon: Users,
      iconColor: "bg-info/10 text-info",
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome back! Here's your store operations overview.</p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {statCards.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <QuickActions />
        </div>
        <div>
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}
