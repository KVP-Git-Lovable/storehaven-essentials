import { Gauge, Zap, Droplets, Fuel } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const chartData = [
  { month: "Jan", power: 4200, water: 850, generator: 120 },
  { month: "Feb", power: 3800, water: 920, generator: 95 },
  { month: "Mar", power: 4500, water: 780, generator: 150 },
  { month: "Apr", power: 5200, water: 1100, generator: 180 },
  { month: "May", power: 5800, water: 1250, generator: 220 },
  { month: "Jun", power: 6100, water: 1400, generator: 280 },
];

const readings = [
  { id: 1, store: "Downtown Store", date: "2024-03-20", power: 1250, water: 45, generator: 12 },
  { id: 2, store: "Mall Outlet", date: "2024-03-20", power: 1820, water: 62, generator: 8 },
  { id: 3, store: "Airport Kiosk", date: "2024-03-20", power: 680, water: 28, generator: 5 },
  { id: 4, store: "Suburban Store", date: "2024-03-20", power: 1100, water: 38, generator: 15 },
  { id: 5, store: "Highway Express", date: "2024-03-20", power: 950, water: 32, generator: 22 },
];

const stats = [
  { title: "Total Power (kWh)", value: "5,800", change: "+12% from last month", changeType: "negative" as const, icon: Zap, iconColor: "bg-warning/10 text-warning" },
  { title: "Water (KL)", value: "205", change: "-5% from last month", changeType: "positive" as const, icon: Droplets, iconColor: "bg-info/10 text-info" },
  { title: "Generator (Hours)", value: "62", change: "+8% from last month", changeType: "negative" as const, icon: Fuel, iconColor: "bg-destructive/10 text-destructive" },
  { title: "Monthly Cost", value: "₹2.8L", change: "+4% from last month", changeType: "negative" as const, icon: Gauge, iconColor: "bg-primary/10 text-primary" },
];

export default function Utilities() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">Utilities Monitoring</h1>
        <p className="text-muted-foreground">Track power, water, and generator consumption</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="stat-card">
        <h3 className="font-semibold mb-4">Consumption Trends</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="power" stroke="hsl(var(--warning))" strokeWidth={2} name="Power (kWh)" />
              <Line type="monotone" dataKey="water" stroke="hsl(var(--info))" strokeWidth={2} name="Water (KL)" />
              <Line type="monotone" dataKey="generator" stroke="hsl(var(--destructive))" strokeWidth={2} name="Generator (hrs)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Latest Readings</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Power (kWh)</TableHead>
              <TableHead>Water (KL)</TableHead>
              <TableHead>Generator (hrs)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {readings.map((reading) => (
              <TableRow key={reading.id}>
                <TableCell className="font-medium">{reading.store}</TableCell>
                <TableCell>{new Date(reading.date).toLocaleDateString()}</TableCell>
                <TableCell>{reading.power.toLocaleString()}</TableCell>
                <TableCell>{reading.water}</TableCell>
                <TableCell>{reading.generator}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
