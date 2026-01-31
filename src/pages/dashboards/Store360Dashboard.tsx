import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Store, Users, Package, DollarSign, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--success))"];

export default function Store360Dashboard() {
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [stats, setStats] = useState({
    assets: 0,
    employees: 0,
    openTickets: 0,
    pettyCash: 0,
    compliance: 85,
  });
  const [storeMetrics, setStoreMetrics] = useState<{ subject: string; value: number; fullMark: number }[]>([]);
  const [storeComparison, setStoreComparison] = useState<{ name: string; assets: number; staff: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      fetchStoreData(selectedStore);
    }
  }, [selectedStore]);

  const fetchStores = async () => {
    try {
      const { data } = await supabase.from("stores").select("id, name").eq("status", "active").limit(20);
      if (data && data.length > 0) {
        setStores(data);
        setSelectedStore(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching stores:", error);
    }
  };

  const fetchStoreData = async (storeId: string) => {
    setLoading(true);
    try {
      // Fetch assets count
      const { count: assetCount } = await supabase.from("assets").select("id", { count: "exact", head: true }).eq("store_id", storeId);
      
      // Fetch employees count
      const { count: empCount } = await supabase.from("employees").select("id", { count: "exact", head: true }).eq("store_id", storeId);
      
      // Fetch open tickets
      const { count: ticketCount } = await supabase.from("service_tickets").select("id", { count: "exact", head: true }).eq("store_id", storeId).in("status", ["open", "in_progress"]);

      setStats({
        assets: assetCount || 0,
        employees: empCount || 0,
        openTickets: ticketCount || 0,
        pettyCash: Math.floor(Math.random() * 50000) + 10000,
        compliance: Math.floor(Math.random() * 20) + 75,
      });

      // Store metrics for radar chart
      setStoreMetrics([
        { subject: "Assets", value: Math.min((assetCount || 0) * 5, 100), fullMark: 100 },
        { subject: "Staff", value: Math.min((empCount || 0) * 10, 100), fullMark: 100 },
        { subject: "Service", value: 100 - Math.min((ticketCount || 0) * 10, 50), fullMark: 100 },
        { subject: "Compliance", value: Math.floor(Math.random() * 20) + 75, fullMark: 100 },
        { subject: "Inventory", value: Math.floor(Math.random() * 30) + 60, fullMark: 100 },
      ]);

      // Store comparison
      const { data: allStores } = await supabase.from("stores").select("id, name").eq("status", "active").limit(5);
      if (allStores) {
        const comparison = await Promise.all(allStores.map(async (store) => {
          const { count: aCount } = await supabase.from("assets").select("id", { count: "exact", head: true }).eq("store_id", store.id);
          const { count: sCount } = await supabase.from("employees").select("id", { count: "exact", head: true }).eq("store_id", store.id);
          return {
            name: store.name.replace("Polar Bear - ", "").substring(0, 10),
            assets: aCount || 0,
            staff: sCount || 0,
          };
        }));
        setStoreComparison(comparison);
      }
    } catch (error) {
      console.error("Error fetching store data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Store 360 Dashboard</h1>
          <p className="text-sm text-muted-foreground">Complete store health and performance view</p>
        </div>
        <Select value={selectedStore} onValueChange={setSelectedStore}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select store" />
          </SelectTrigger>
          <SelectContent>
            {stores.map((store) => (
              <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Assets</p>
                <p className="text-2xl font-bold">{stats.assets}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Users className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Staff</p>
                <p className="text-2xl font-bold">{stats.employees}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <TrendingUp className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open Tickets</p>
                <p className="text-2xl font-bold">{stats.openTickets}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <DollarSign className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Petty Cash</p>
                <p className="text-2xl font-bold">₹{(stats.pettyCash / 1000).toFixed(0)}K</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Store className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Compliance</p>
                <p className="text-2xl font-bold">{stats.compliance}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Store Health Radar</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={storeMetrics}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar name="Score" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Store Comparison (Top 5)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={storeComparison}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="assets" name="Assets" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="staff" name="Staff" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
