import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type MessageTrendRow = { month: string; sent: number; delivered: number };

export function WhatsappMessageTrend() {
  const [data, setData] = useState<MessageTrendRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get last 4 months of data
        const fourMonthsAgo = new Date();
        fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 3);

        // First, get all journeys with 'Trayi' in the name
        const { data: journeys, error: journeyError } = await supabase
          .from("journeys")
          .select("id")
          .ilike("name", "%Trayi%");

        if (journeyError) throw journeyError;
        if (!journeys || journeys.length === 0) {
          setData([]);
          setLoading(false);
          return;
        }

        const journeyIds = journeys.map((j) => j.id);

        // Get message log data for those journeys
        const { data: messages, error: msgError } = await supabase
          .from("journey_message_log")
          .select("sent_at, delivery_status")
          .in("journey_id", journeyIds)
          .eq("channel", "whatsapp_template")
          .gte("sent_at", fourMonthsAgo.toISOString());

        if (msgError) throw msgError;

        // Group by month and count sent vs delivered
        const monthMap = new Map<string, { sent: number; delivered: number }>();

        messages?.forEach((msg) => {
          const date = new Date(msg.sent_at);
          const monthKey = date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

          if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, { sent: 0, delivered: 0 });
          }

          const current = monthMap.get(monthKey)!;
          current.sent += 1;
          if (msg.delivery_status === "delivered") {
            current.delivered += 1;
          }
        });

        // Convert to array and sort by date
        const result = Array.from(monthMap.entries())
          .map(([month, counts]) => ({ month, ...counts }))
          .sort((a, b) => {
            const dateA = new Date(a.month);
            const dateB = new Date(b.month);
            return dateA.getTime() - dateB.getTime();
          });

        setData(result);
      } catch (error) {
        console.error("Error fetching WhatsApp message trend:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="stat-card h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="stat-card h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm md:text-base">WhatsApp Message Trend</h3>
        <span className="text-xs text-muted-foreground">Last 4 months</span>
      </div>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="deliveredGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={45}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={45}
            />
            <Tooltip
              contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              labelFormatter={(d) => `${d}`}
              formatter={(v: number, name: string) => (name === "delivered" ? [`${v}`, "Delivered"] : [`${v}`, "Sent"])}
            />
            <Area yAxisId="left" type="monotone" dataKey="delivered" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#deliveredGradient)" />
            <Line yAxisId="right" type="monotone" dataKey="sent" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
