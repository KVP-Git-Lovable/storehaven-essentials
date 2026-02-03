import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Package, AlertTriangle, TrendingUp, Clock, Wrench } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--success))"];

export default function AssetManagementDashboard() {
  const [stats, setStats] = useState({
    totalAssets: 0,
    activeAssets: 0,
    underWarranty: 0,
    expiredWarranty: 0,
    assetValue: 0,
  });
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([]);
  const [conditionData, setConditionData] = useState<{ name: string; value: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; count: number }[]>([]);
  const [valueByStore, setValueByStore] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch only active assets with valid asset_master_id (exclude orphaned/deleted)
      const { data: assets } = await supabase
        .from("assets")
        .select("*")
        .not("asset_status", "eq", "orphaned")
        .not("asset_master_id", "is", null);
      
      if (assets) {
        const now = new Date();
        const active = assets.filter(a => a.asset_status === "active" || a.asset_status === "working" || a.asset_status === "installed").length;
        const underWarranty = assets.filter(a => a.warranty_end_date && new Date(a.warranty_end_date) > now).length;
        const expired = assets.filter(a => a.warranty_end_date && new Date(a.warranty_end_date) <= now).length;
        const totalValue = assets.reduce((sum, a) => sum + (a.value || 0), 0);

        setStats({
          totalAssets: assets.length,
          activeAssets: active,
          underWarranty,
          expiredWarranty: expired,
          assetValue: totalValue,
        });

        // Category distribution
        const categoryCount: Record<string, number> = {};
        assets.forEach(a => {
          categoryCount[a.category] = (categoryCount[a.category] || 0) + 1;
        });
        setCategoryData(Object.entries(categoryCount).map(([name, value]) => ({ name, value })));

        // Condition distribution (service engagement)
        const conditionCount: Record<string, number> = {};
        assets.forEach(a => {
          const condition = a.condition || "Unknown";
          conditionCount[condition] = (conditionCount[condition] || 0) + 1;
        });
        setConditionData(Object.entries(conditionCount).map(([name, value]) => ({ name, value })));

        // Status distribution (exclude orphaned from display)
        const statusCount: Record<string, number> = {};
        assets.forEach(a => {
          statusCount[a.asset_status] = (statusCount[a.asset_status] || 0) + 1;
        });
        setStatusData(Object.entries(statusCount).map(([name, count]) => ({ name, count })));

        // Fetch value by store
        const { data: stores } = await supabase.from("stores").select("id, name");
        if (stores) {
          const storeValues = stores.slice(0, 10).map(store => ({
            name: store.name.replace("Polar Bear - ", ""),
            value: assets.filter(a => a.store_id === store.id).reduce((sum, a) => sum + (a.value || 0), 0),
          })).filter(s => s.value > 0);
          setValueByStore(storeValues);
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">Asset Management Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of all assets across stores</p>
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
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold">{stats.totalAssets}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{stats.activeAssets}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Clock className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Under Warranty</p>
                <p className="text-2xl font-bold">{stats.underWarranty}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Warranty Expired</p>
                <p className="text-2xl font-bold">{stats.expiredWarranty}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Wrench className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">₹{(stats.assetValue / 100000).toFixed(1)}L</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assets by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asset Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={statusData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asset Condition Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={conditionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {conditionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asset Value by Store (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={valueByStore} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
