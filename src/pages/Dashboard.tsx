import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Users, UserPlus, ShoppingCart, IndianRupee, Megaphone, Loader2, AlertCircle, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { WhatsappMessageTrend } from "@/components/dashboard/WhatsappMessageTrend";
import { CommunicationHealth } from "@/components/dashboard/CommunicationHealth";
import { MarketingQuickActions } from "@/components/dashboard/MarketingQuickActions";
import { TeamSnapshotCard } from "@/components/dashboard/TeamSnapshotCard";
import { OrderFormDialog } from "@/components/transactions/OrderFormDialog";
import { LeadFormDialog } from "@/components/transactions/LeadFormDialog";
import { useDashboardMetrics, formatINR } from "@/hooks/useDashboardMetrics";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useDashboardMetrics();
  const [onlineOrderCount, setOnlineOrderCount] = useState(0);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create");

  useEffect(() => {
    async function fetchOnlineOrdersCount() {
      try {
        const { count } = await supabase
          .from("online_orders")
          .select("*", { count: "exact", head: true });
        setOnlineOrderCount(count || 0);
      } catch (error) {
        console.error("Failed to fetch online orders count:", error);
      }
    }
    fetchOnlineOrdersCount();
  }, []);

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
        <div className="flex gap-2">
          <Button onClick={() => { setSelectedOrder(null); setDialogMode("create"); setCreateOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New Sale
          </Button>
          <Button variant="outline" onClick={() => setLeadFormOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> New Lead
          </Button>
        </div>
      </div>

      {/* Online Orders Banner */}
      {onlineOrderCount > 0 && (
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
            You have new Online Order requests - <span className="font-semibold">{onlineOrderCount}</span>.{" "}
            <Link to="/transactions/online-orders" className="font-semibold underline hover:no-underline">
              Click here
            </Link>{" "}
            to view details
          </AlertDescription>
        </Alert>
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
          <WhatsappMessageTrend />
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
      <LeadFormDialog open={leadFormOpen} onOpenChange={setLeadFormOpen} mode="create" />
    </div>
  );
}
