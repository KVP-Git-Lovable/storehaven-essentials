import { Store, Package, AlertTriangle, Wrench, DollarSign, Users } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";

const stats = [
  {
    title: "Total Stores",
    value: 24,
    change: "+2 this month",
    changeType: "positive" as const,
    icon: Store,
    iconColor: "bg-primary/10 text-primary",
  },
  {
    title: "Active Assets",
    value: 1247,
    change: "98.5% operational",
    changeType: "positive" as const,
    icon: Package,
    iconColor: "bg-accent/10 text-accent",
  },
  {
    title: "Open Incidents",
    value: 8,
    change: "3 high priority",
    changeType: "negative" as const,
    icon: AlertTriangle,
    iconColor: "bg-destructive/10 text-destructive",
  },
  {
    title: "Pending Maintenance",
    value: 15,
    change: "5 overdue",
    changeType: "negative" as const,
    icon: Wrench,
    iconColor: "bg-warning/10 text-warning",
  },
  {
    title: "Monthly Expenses",
    value: "₹2.4L",
    change: "-8% from last month",
    changeType: "positive" as const,
    icon: DollarSign,
    iconColor: "bg-success/10 text-success",
  },
  {
    title: "Total Staff",
    value: 156,
    change: "4 on leave today",
    changeType: "neutral" as const,
    icon: Users,
    iconColor: "bg-info/10 text-info",
  },
];

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your store operations overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
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
