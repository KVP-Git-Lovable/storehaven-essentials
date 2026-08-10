import { useState } from "react";
import { Users, UserPlus, ShoppingCart, IndianRupee, Megaphone, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RevenueOrdersTrend } from "@/components/dashboard/RevenueOrdersTrend";
import { CommunicationHealth } from "@/components/dashboard/CommunicationHealth";
import { MarketingQuickActions } from "@/components/dashboard/MarketingQuickActions";
import { MarketingRecentActivity } from "@/components/dashboard/MarketingRecentActivity";
import { TopChannelCard } from "@/components/dashboard/TopChannelCard";
import { TeamSnapshotCard } from "@/components/dashboard/TeamSnapshotCard";
import { AIInsightsCard } from "@/components/dashboard/AIInsightsCard";
import { JourneyOverviewSection } from "@/components/dashboard/JourneyOverviewSection";
import { OrderFormDialog } from "@/components/transactions/OrderFormDialog";
import { useDashboardMetrics, formatINR } from "@/hooks/useDashboardMetrics";

export default function Dashboard() {
  const { data, isLoading } = useDashboardMetrics();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create");

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

      {/* Journey overview + health + WhatsApp wallet */}
      <JourneyOverviewSection />

      {/* Section 4 + 5 + (6,7,8 stacked) */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="space-y-4 md:space-y-6">
          <MarketingQuickActions />
        </div>
        <div>
          <MarketingRecentActivity items={data.recent} />
        </div>
        <div className="space-y-4 md:space-y-6">
          <TopChannelCard data={data.channelCompare} />
          <TeamSnapshotCard team={data.team} />
          <AIInsightsCard insights={data.insights} />
        </div>
      </div>

      <OrderFormDialog open={createOpen} onOpenChange={setCreateOpen} order={selectedOrder} mode={dialogMode} />
    </div>
  );
}
