import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "@/hooks/useDashboardMetrics";

type Row = { date: string; revenue: number; orders: number };

export function RevenueOrdersTrend({ data }: { data: Row[] }) {
  return (
    <div className="stat-card h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm md:text-base">Revenue & Orders Trend</h3>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </div>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(data.length / 6)}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}k`)}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={45}
            />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={30} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              labelFormatter={(d) => new Date(d as string).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              formatter={(v: number, name: string) => (name === "revenue" ? [formatINR(v), "Revenue"] : [v, "Orders"])}
            />
            <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revGradient)" />
            <Line yAxisId="right" type="monotone" dataKey="orders" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}