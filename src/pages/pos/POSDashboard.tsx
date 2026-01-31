import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { 
  Receipt, 
  TrendingUp, 
  ShoppingCart, 
  Users,
  IndianRupee,
  Package,
  Clock
} from "lucide-react";

const PAYMENT_COLORS = {
  cash: "#22c55e",
  upi: "#8b5cf6",
  card: "#3b82f6",
  loyalty_points: "#f59e0b",
};

export default function POSDashboard() {
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("today");

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "yesterday":
        return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
      case "week":
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case "month":
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  };

  const { start, end } = getDateRange();

  // Fetch stores
  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch orders for the period
  const { data: orders = [] } = useQuery({
    queryKey: ["pos-dashboard-orders", selectedStore, dateRange],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .eq("status", "completed");

      if (selectedStore !== "all") {
        query = query.eq("store_id", selectedStore);
      }

      const { data, error } = await query.order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch order items for top products
  const { data: orderItems = [] } = useQuery({
    queryKey: ["pos-dashboard-items", selectedStore, dateRange],
    queryFn: async () => {
      let query = supabase
        .from("order_items")
        .select(`
          *,
          order:orders!inner(created_at, status, store_id),
          product:products(name)
        `)
        .gte("order.created_at", start.toISOString())
        .lte("order.created_at", end.toISOString())
        .eq("order.status", "completed");

      if (selectedStore !== "all") {
        query = query.eq("order.store_id", selectedStore);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Calculate metrics
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);

  // Payment method breakdown
  const paymentBreakdown = orders.reduce((acc: Record<string, number>, order) => {
    const method = order.payment_method || "other";
    acc[method] = (acc[method] || 0) + Number(order.total_amount || 0);
    return acc;
  }, {});

  const paymentData = Object.entries(paymentBreakdown).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: PAYMENT_COLORS[name as keyof typeof PAYMENT_COLORS] || "#6b7280",
  }));

  // Hourly sales trend
  const hourlyData = Array.from({ length: 24 }, (_, hour) => {
    const hourOrders = orders.filter((o) => {
      const orderHour = new Date(o.created_at).getHours();
      return orderHour === hour;
    });
    return {
      hour: `${hour.toString().padStart(2, "0")}:00`,
      orders: hourOrders.length,
      revenue: hourOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
    };
  });

  // Top selling products
  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  orderItems.forEach((item: any) => {
    const name = item.product?.name || "Unknown";
    if (!productSales[name]) {
      productSales[name] = { name, qty: 0, revenue: 0 };
    }
    productSales[name].qty += item.quantity;
    productSales[name].revenue += Number(item.total_amount || 0);
  });

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">POS Dashboard</h1>
          <p className="text-muted-foreground">Real-time sales analytics</p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Today" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              {dateRange === "today" ? "Today" : `Last ${dateRange}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Completed orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Ticket Size</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{avgTicket.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">Per order</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Items Sold</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
            <p className="text-xs text-muted-foreground">Total quantity</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Hourly Sales Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Hourly Sales Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Method Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Payment Methods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {paymentData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <span className="font-medium">₹{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Top Selling Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={150} 
                tick={{ fontSize: 11 }}
              />
              <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
