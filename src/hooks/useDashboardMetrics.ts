import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStoreAccess } from "./useStoreAccess";

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfPrevMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}
function pct(curr: number, prev: number): number {
  if (!prev) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

export type DashboardMetrics = {
  customers: { total: number; mom: number };
  leads: { total: number; mom: number };
  orders: { thisMonth: number; completed: number; pending: number; mom: number };
  revenue: { thisMonth: number; lastMonth: number; mom: number };
  marketing: { activeJourneys: number; whatsapp: number; voice: number; email: number };
  trend: { date: string; revenue: number; orders: number }[];
  comm: {
    today: number;
    whatsapp: { delivered: number; read: number };
    email: { open: number; click: number };
    voice: { connected: number; orders: number };
  };
  channelCompare: { channel: string; engagement: number }[];
  team: { active: number; topUser: { name: string; orders: number } | null };
  recent: { id: string; type: string; title: string; time: string }[];
  insights: string[];
};

export function useDashboardMetrics() {
  const { accessibleStoreIds, isAdmin, loading: accessLoading } = useStoreAccess();

  return useQuery({
    queryKey: ["dashboard-metrics", isAdmin, Array.from(accessibleStoreIds).sort().join(",")],
    enabled: !accessLoading,
    refetchInterval: 60000,
    queryFn: async (): Promise<DashboardMetrics> => {
      const storeIds = Array.from(accessibleStoreIds);
      const scopeStores = !isAdmin && storeIds.length > 0;
      const monthStart = startOfMonth().toISOString();
      const prevMonthStart = startOfPrevMonth().toISOString();
      const trendStart = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
      trendStart.setHours(0, 0, 0, 0);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Customers + Leads counts & MoM
      const [
        custTotal,
        custThis,
        custPrev,
        leadsTotal,
        leadsThis,
        leadsPrev,
      ] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("customers").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
        supabase.from("customers").select("id", { count: "exact", head: true }).gte("created_at", prevMonthStart).lt("created_at", monthStart),
        supabase.from("leads").select("id", { count: "exact", head: true }),
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", prevMonthStart).lt("created_at", monthStart),
      ]);

      // Orders this month
      let ordersBase = supabase.from("orders").select("id, total_amount, status, created_at, created_by", { count: "exact" }).gte("created_at", monthStart);
      if (scopeStores) ordersBase = ordersBase.in("store_id", storeIds);
      const { data: ordersMonth, count: ordersCount } = await ordersBase;
      const completed = (ordersMonth || []).filter((o: any) => o.status === "completed").length;
      const pending = (ordersMonth || []).filter((o: any) => o.status === "pending").length;
      const revenueThis = (ordersMonth || []).reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);

      // Previous month orders for MoM
      let prevOrdersQ = supabase.from("orders").select("id, total_amount", { count: "exact" }).gte("created_at", prevMonthStart).lt("created_at", monthStart);
      if (scopeStores) prevOrdersQ = prevOrdersQ.in("store_id", storeIds);
      const { data: prevOrders, count: prevOrdersCount } = await prevOrdersQ;
      const revenuePrev = (prevOrders || []).reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);

      // Trend (last 30d)
      let trendQ = supabase.from("orders").select("total_amount, created_at").gte("created_at", trendStart.toISOString());
      if (scopeStores) trendQ = trendQ.in("store_id", storeIds);
      const { data: trendRows } = await trendQ;
      const trendMap = new Map<string, { revenue: number; orders: number }>();
      for (let i = 0; i < 30; i++) {
        const d = new Date(trendStart);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        trendMap.set(key, { revenue: 0, orders: 0 });
      }
      for (const r of trendRows || []) {
        const key = (r as any).created_at.slice(0, 10);
        const bucket = trendMap.get(key);
        if (bucket) {
          bucket.revenue += Number((r as any).total_amount || 0);
          bucket.orders += 1;
        }
      }
      const trend = Array.from(trendMap.entries()).map(([date, v]) => ({ date, ...v }));

      // Marketing activity
      const { data: activeJourneys } = await supabase
        .from("journeys")
        .select("id, canvas_data")
        .eq("status", "active");
      const channelCounts = { whatsapp: 0, voice: 0, email: 0 };
      for (const j of activeJourneys || []) {
        const nodes = ((j as any).canvas_data?.nodes || []) as any[];
        const types = new Set<string>();
        for (const n of nodes) {
          const t = n?.type || n?.data?.type;
          if (typeof t === "string") {
            if (t.toLowerCase().includes("whatsapp")) types.add("whatsapp");
            if (t.toLowerCase().includes("voice")) types.add("voice");
            if (t.toLowerCase().includes("email")) types.add("email");
          }
        }
        if (types.has("whatsapp")) channelCounts.whatsapp++;
        if (types.has("voice")) channelCounts.voice++;
        if (types.has("email")) channelCounts.email++;
      }

      // Communication health (last 30d events)
      const { data: events } = await supabase
        .from("journey_message_events" as any)
        .select("event_type, event_timestamp")
        .gte("event_timestamp", trendStart.toISOString())
        .limit(10000);
      let sent = 0, delivered = 0, read = 0, todayMsgs = 0;
      for (const e of (events || []) as any[]) {
        if (e.event_type === "sent") sent++;
        if (e.event_type === "delivered") delivered++;
        if (e.event_type === "read") read++;
        if (new Date(e.event_timestamp) >= todayStart) todayMsgs++;
      }
      const deliveredPct = sent ? (delivered / sent) * 100 : 0;
      const readPct = sent ? (read / sent) * 100 : 0;

      // Team snapshot
      const { count: activeUsers } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");
      const byUser = new Map<string, number>();
      for (const o of (ordersMonth || []) as any[]) {
        const k = o.created_by || "Unknown";
        byUser.set(k, (byUser.get(k) || 0) + 1);
      }
      const topEntry = [...byUser.entries()].sort((a, b) => b[1] - a[1])[0];
      const topUser = topEntry ? { name: topEntry[0], orders: topEntry[1] } : null;

      // Recent activity
      const [recentJourneys, recentOrders, recentLeads, recentCustomers] = await Promise.all([
        supabase.from("journeys").select("id, name, created_at, status").order("created_at", { ascending: false }).limit(5),
        supabase.from("orders").select("id, order_number, created_at, total_amount").order("created_at", { ascending: false }).limit(5),
        supabase.from("leads").select("id, name, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("customers").select("id, name, created_at").order("created_at", { ascending: false }).limit(5),
      ]);
      const recent = [
        ...((recentJourneys.data || []).map((j: any) => ({ id: `j-${j.id}`, type: "journey", title: `Journey "${j.name}" ${j.status}`, time: j.created_at }))),
        ...((recentOrders.data || []).map((o: any) => ({ id: `o-${o.id}`, type: "order", title: `Order ${o.order_number} created`, time: o.created_at }))),
        ...((recentLeads.data || []).map((l: any) => ({ id: `l-${l.id}`, type: "lead", title: `New lead: ${l.name || "Unnamed"}`, time: l.created_at }))),
        ...((recentCustomers.data || []).map((c: any) => ({ id: `c-${c.id}`, type: "customer", title: `New customer: ${c.name || "Unnamed"}`, time: c.created_at }))),
      ]
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 8);

      // Top channel: only WhatsApp has real signal currently
      const channelCompare = [
        { channel: "WhatsApp", engagement: Math.round(readPct) },
        { channel: "Email", engagement: 0 },
        { channel: "Voice", engagement: 0 },
      ];

      // AI Insights (computed deltas)
      const insights: string[] = [];
      const revMom = pct(revenueThis, revenuePrev);
      if (revenuePrev > 0) insights.push(`Revenue ${revMom >= 0 ? "up" : "down"} ${Math.abs(revMom).toFixed(1)}% vs last month`);
      if (sent > 0) insights.push(`WhatsApp delivery rate at ${deliveredPct.toFixed(1)}% (last 30 days)`);
      const ordMom = pct(ordersCount || 0, prevOrdersCount || 0);
      if ((prevOrdersCount || 0) > 0) insights.push(`Orders ${ordMom >= 0 ? "trending up" : "down"} ${Math.abs(ordMom).toFixed(1)}% this month`);

      return {
        customers: { total: custTotal.count || 0, mom: pct(custThis.count || 0, custPrev.count || 0) },
        leads: { total: leadsTotal.count || 0, mom: pct(leadsThis.count || 0, leadsPrev.count || 0) },
        orders: { thisMonth: ordersCount || 0, completed, pending, mom: ordMom },
        revenue: { thisMonth: revenueThis, lastMonth: revenuePrev, mom: revMom },
        marketing: { activeJourneys: activeJourneys?.length || 0, ...channelCounts },
        trend,
        comm: {
          today: todayMsgs,
          whatsapp: { delivered: deliveredPct, read: readPct },
          email: { open: 0, click: 0 },
          voice: { connected: 0, orders: 0 },
        },
        channelCompare,
        team: { active: activeUsers || 0, topUser },
        recent,
        insights: insights.slice(0, 3),
      };
    },
  });
}

export function formatINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}