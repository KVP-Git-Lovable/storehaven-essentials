import { UserCheck, TrendingUp, TrendingDown, Store } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const chartData = [
  { store: "Downtown", footfall: 1250 },
  { store: "Mall", footfall: 2100 },
  { store: "Airport", footfall: 850 },
  { store: "Suburban", footfall: 680 },
  { store: "Highway", footfall: 420 },
];

const dailyData = [
  { store: "Downtown Store", today: 1250, yesterday: 1180, weekAvg: 1150, change: "+6%" },
  { store: "Mall Outlet", today: 2100, yesterday: 2250, weekAvg: 2000, change: "-7%" },
  { store: "Airport Kiosk", today: 850, yesterday: 920, weekAvg: 880, change: "-8%" },
  { store: "Suburban Store", today: 680, yesterday: 650, weekAvg: 620, change: "+5%" },
  { store: "Highway Express", today: 420, yesterday: 380, weekAvg: 400, change: "+11%" },
];

const stats = [
  { title: "Total Today", value: "5,300", change: "+3% from yesterday", changeType: "positive" as const, icon: UserCheck, iconColor: "bg-primary/10 text-primary" },
  { title: "Peak Store", value: "Mall Outlet", icon: Store, iconColor: "bg-success/10 text-success" },
  { title: "Highest Growth", value: "Highway +11%", icon: TrendingUp, iconColor: "bg-info/10 text-info" },
  { title: "Needs Attention", value: "Airport -8%", icon: TrendingDown, iconColor: "bg-warning/10 text-warning" },
];

export default function Footfall() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">Footfall Tracking</h1>
        <p className="text-muted-foreground">Monitor daily customer visits across stores</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="stat-card">
        <h3 className="font-semibold mb-4">Today's Footfall by Store</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="store" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Bar dataKey="footfall" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Detailed Comparison</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store</TableHead>
              <TableHead className="text-right">Today</TableHead>
              <TableHead className="text-right">Yesterday</TableHead>
              <TableHead className="text-right">Week Avg</TableHead>
              <TableHead className="text-right">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dailyData.map((row) => (
              <TableRow key={row.store}>
                <TableCell className="font-medium">{row.store}</TableCell>
                <TableCell className="text-right">{row.today.toLocaleString()}</TableCell>
                <TableCell className="text-right">{row.yesterday.toLocaleString()}</TableCell>
                <TableCell className="text-right">{row.weekAvg.toLocaleString()}</TableCell>
                <TableCell className={`text-right font-medium ${row.change.startsWith("+") ? "text-success" : "text-destructive"}`}>
                  {row.change}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
