import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Users, UserPlus, ShoppingCart, IndianRupee, Megaphone, Loader2, Plus, AlertCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RevenueOrdersTrend } from "@/components/dashboard/RevenueOrdersTrend";
import { CommunicationHealth } from "@/components/dashboard/CommunicationHealth";
import { MarketingQuickActions } from "@/components/dashboard/MarketingQuickActions";
import { TeamSnapshotCard } from "@/components/dashboard/TeamSnapshotCard";
import { OrderFormDialog } from "@/components/transactions/OrderFormDialog";
import { useDashboardMetrics, formatINR } from "@/hooks/useDashboardMetrics";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useDashboardMetrics();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create");

  const { data: pendingOrders } = useQuery({
    queryKey: ["pending-online-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("online_orders")
        .select("id", { count: "exact" })
        .eq("status", "pending");

      if (error) throw error;
      return data || [];
    },
  });

  const pendingCount = pendingOrders?.length || 0;

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Business and marketing pulse at a glance.</p>
        </div>
        <Button onClick={() => { setSelectedOrder(null); setDialogMode("create"); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New Sale
        </Button>
      </div>

      {/* Online Orders Banner */}
      {pendingCount > 0 && (
        <div
          onClick={() => navigate("/transactions/online-orders")}
          className="cursor-pointer bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg p-4 flex items-center justify-between hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <div>
              <p className="font-medium text-orange-900 dark:text-orange-100">
                You have new Online Order requests - {pendingCount}
              </p>
              <p className="text-sm text-orange-800 dark:text-orange-200">Click here to view details</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
        </div>
      )}

      {/* Section 1: KPI Row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Customers / Leads"
          primary={data.customers.total.toLocaleString("en-IN")}
          primaryLabel="customers"
          subMetrics={[{ label: "Leads", value: data.leads.total.toLocaleString("en-IN") }]}
          delta={data.customers.mom}
          icon={Users}
          iconColor="bg-primary/10 text-primary"
        />
        <KpiCard
          title="Orders (This Month)"
          primary={data.orders.thisMonth.toLocaleString("en-IN")}
          subMetrics={[
            { label: "Completed", value: data.orders.completed },
            { label: "Pending", value: data.orders.pending },
          ]}
          delta={data.orders.mom}
          icon={ShoppingCart}
          iconColor="bg-accent/10 text-accent"
        />
        <KpiCard
          title="Revenue (This Month)"
          primary={formatINR(data.revenue.thisMonth)}
          subMetrics={[{ label: "Last month", value: formatINR(data.revenue.lastMonth) }]}
          delta={data.revenue.mom}
          icon={IndianRupee}
          iconColor="bg-success/10 text-success"
        />
        <KpiCard
          title="Marketing Activity"
          primary={data.marketing.activeJourneys}
          primaryLabel="active journeys"
          subMetrics={[
            { label: "WhatsApp", value: data.marketing.whatsapp },
            { label: "Voice", value: data.marketing.voice },
            { label: "Email", value: data.marketing.email },
          ]}
          icon={Megaphone}
          iconColor="bg-warning/10 text-warning"
        />
      </div>

      {/* Section 2 + 3: Trend + Communication Health */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueOrdersTrend data={data.trend} />
        </div>
        <div>
          <CommunicationHealth comm={data.comm} />
        </div>
      </div>

      {/* Section 4 + (6,7,8 stacked) */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        <div className="space-y-4 md:space-y-6">
          <MarketingQuickActions />
        </div>
        <div className="space-y-4 md:space-y-6">
          <TeamSnapshotCard team={data.team} />
        </div>
      </div>

      <OrderFormDialog open={createOpen} onOpenChange={setCreateOpen} order={selectedOrder} mode={dialogMode} />
    </div>
  );
}
