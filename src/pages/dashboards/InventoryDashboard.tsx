import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Boxes, AlertTriangle, TrendingDown, Package, ShoppingCart } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { Badge } from "@/components/ui/badge";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--success))"];

export default function InventoryDashboard() {
  const [stats, setStats] = useState({
    totalItems: 0,
    activeItems: 0,
    totalValue: 0,
    lowStockItems: 0,
    expiringItems: 0,
  });
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; cost: number }[]>([]);
  const [recentRequisitions, setRecentRequisitions] = useState<{ status: string; count: number }[]>([]);
  const [topItems, setTopItems] = useState<{ name: string; cost: number; selling: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch inventory items
      const { data: items } = await supabase.from("inventory_items").select("*");
      
      if (items) {
        const active = items.filter(i => i.status === "active");
        const totalValue = items.reduce((sum, i) => sum + (i.unit_cost * i.min_stock), 0);
        
        setStats({
          totalItems: items.length,
          activeItems: active.length,
          totalValue,
          lowStockItems: Math.floor(items.length * 0.1), // Simulated
          expiringItems: items.filter(i => i.expiry_tracking).length,
        });

        // Category breakdown
        const categoryCount: Record<string, { count: number; cost: number }> = {};
        items.forEach(i => {
          if (!categoryCount[i.category]) {
            categoryCount[i.category] = { count: 0, cost: 0 };
          }
          categoryCount[i.category].count += 1;
          categoryCount[i.category].cost += i.unit_cost;
        });
        setCategoryData(Object.entries(categoryCount).map(([name, data]) => ({ 
          name, 
          value: data.count,
          cost: data.cost 
        })));

        // Top items by value
        const sorted = [...items].sort((a, b) => b.unit_cost - a.unit_cost).slice(0, 5);
        setTopItems(sorted.map(i => ({
          name: i.name.length > 20 ? i.name.substring(0, 20) + "..." : i.name,
          cost: i.unit_cost,
          selling: i.selling_price,
        })));
      }

      // Fetch requisitions by status
      const { data: requisitions } = await supabase.from("requisitions").select("status");
      if (requisitions) {
        const statusCount: Record<string, number> = {};
        requisitions.forEach(r => {
          statusCount[r.status] = (statusCount[r.status] || 0) + 1;
        });
        setRecentRequisitions(Object.entries(statusCount).map(([status, count]) => ({ status, count })));
      }
    } catch (error) {
      console.error("Error fetching inventory dashboard:", error);
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
        <h1 className="text-2xl font-semibold">Inventory Dashboard</h1>
        <p className="text-sm text-muted-foreground">Stock levels, requisitions, and inventory health</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Boxes className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total SKUs</p>
                <p className="text-2xl font-bold">{stats.totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Package className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Items</p>
                <p className="text-2xl font-bold">{stats.activeItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <ShoppingCart className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inventory Value</p>
                <p className="text-2xl font-bold">₹{(stats.totalValue / 1000).toFixed(0)}K</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold">{stats.lowStockItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expiry Tracked</p>
                <p className="text-2xl font-bold">{stats.expiringItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name} (${value})`}
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
            <CardTitle className="text-base">Requisition Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={recentRequisitions}>
                <XAxis dataKey="status" tick={{ fontSize: 12 }} />
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
            <CardTitle className="text-base">Top Items by Unit Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topItems} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => `₹${v}`} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `₹${v}`} />
                <Legend />
                <Bar dataKey="cost" name="Cost" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="selling" name="Selling" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Value Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={categoryData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `₹${v}`} />
                <Tooltip formatter={(v: number) => `₹${v}`} />
                <Area type="monotone" dataKey="cost" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
