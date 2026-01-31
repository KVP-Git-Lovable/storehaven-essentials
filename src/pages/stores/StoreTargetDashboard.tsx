import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subQuarters, startOfYear, endOfYear } from "date-fns";
import { 
  Target, 
  TrendingUp, 
  Trophy,
  Medal,
  ArrowUp,
  ArrowDown,
  Calendar,
  Store
} from "lucide-react";

const MONTHS = [
  "Apr", "May", "Jun", "Jul", "Aug", "Sep",
  "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"
];

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();
const fiscalYears = [currentYear - 1, currentYear, currentYear + 1];

export default function StoreTargetDashboard() {
  const [selectedFY, setSelectedFY] = useState(currentYear.toString());
  const [viewPeriod, setViewPeriod] = useState<"monthly" | "quarterly" | "fy">("monthly");

  // Fetch store targets
  const { data: targets = [] } = useQuery({
    queryKey: ["store-targets-dashboard", selectedFY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_targets")
        .select(`
          *,
          store:stores(id, name),
          months:store_target_months(*)
        `)
        .eq("fiscal_year", parseInt(selectedFY))
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  // Fetch actual sales
  const { data: salesData = [] } = useQuery({
    queryKey: ["store-sales-dashboard", selectedFY],
    queryFn: async () => {
      const fyStart = new Date(parseInt(selectedFY), 3, 1);
      const fyEnd = new Date(parseInt(selectedFY) + 1, 2, 31, 23, 59, 59);

      const { data, error } = await supabase
        .from("orders")
        .select("store_id, total_amount, created_at")
        .eq("status", "completed")
        .gte("created_at", fyStart.toISOString())
        .lte("created_at", fyEnd.toISOString());
      
      if (error) throw error;
      return data;
    },
  });

  // Process data for charts and leaderboard
  const processedData = useMemo(() => {
    // Store-wise aggregation
    const storeData: Record<string, {
      name: string;
      target: number;
      actual: number;
      monthlyData: Record<number, { target: number; actual: number }>;
    }> = {};

    // Initialize from targets
    targets.forEach((t: any) => {
      storeData[t.store_id] = {
        name: t.store?.name || "Unknown",
        target: Number(t.annual_target),
        actual: 0,
        monthlyData: {},
      };

      // Add monthly targets
      t.months?.forEach((m: any) => {
        storeData[t.store_id].monthlyData[m.month] = {
          target: Number(m.target_amount),
          actual: 0,
        };
      });
    });

    // Add actuals from sales
    salesData.forEach((sale: any) => {
      if (sale.store_id && storeData[sale.store_id]) {
        storeData[sale.store_id].actual += Number(sale.total_amount);

        // Map to fiscal month (April = 1)
        const saleDate = new Date(sale.created_at);
        let fiscalMonth = saleDate.getMonth() - 2; // April = 1
        if (fiscalMonth <= 0) fiscalMonth += 12;

        if (!storeData[sale.store_id].monthlyData[fiscalMonth]) {
          storeData[sale.store_id].monthlyData[fiscalMonth] = { target: 0, actual: 0 };
        }
        storeData[sale.store_id].monthlyData[fiscalMonth].actual += Number(sale.total_amount);
      }
    });

    // Create leaderboard
    const leaderboard = Object.entries(storeData)
      .map(([id, data]) => ({
        id,
        name: data.name,
        target: data.target,
        actual: data.actual,
        achievement: data.target > 0 ? (data.actual / data.target) * 100 : 0,
        variance: data.actual - data.target,
      }))
      .sort((a, b) => b.achievement - a.achievement);

    // Monthly trend data
    const monthlyTrend = MONTHS.map((month, index) => {
      const fiscalMonth = index + 1;
      let totalTarget = 0;
      let totalActual = 0;

      Object.values(storeData).forEach((store) => {
        if (store.monthlyData[fiscalMonth]) {
          totalTarget += store.monthlyData[fiscalMonth].target;
          totalActual += store.monthlyData[fiscalMonth].actual;
        }
      });

      return {
        month,
        target: totalTarget,
        actual: totalActual,
        achievement: totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0,
      };
    });

    // Quarterly data
    const quarterlyData = [
      { quarter: "Q1", months: [1, 2, 3] },
      { quarter: "Q2", months: [4, 5, 6] },
      { quarter: "Q3", months: [7, 8, 9] },
      { quarter: "Q4", months: [10, 11, 12] },
    ].map((q) => {
      let target = 0;
      let actual = 0;

      q.months.forEach((m) => {
        const trend = monthlyTrend[m - 1];
        if (trend) {
          target += trend.target;
          actual += trend.actual;
        }
      });

      return {
        quarter: q.quarter,
        target,
        actual,
        achievement: target > 0 ? (actual / target) * 100 : 0,
      };
    });

    // Total summary
    const totalTarget = Object.values(storeData).reduce((sum, s) => sum + s.target, 0);
    const totalActual = Object.values(storeData).reduce((sum, s) => sum + s.actual, 0);

    return {
      storeData,
      leaderboard,
      monthlyTrend,
      quarterlyData,
      summary: {
        totalTarget,
        totalActual,
        achievement: totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0,
        variance: totalActual - totalTarget,
      },
    };
  }, [targets, salesData]);

  const { leaderboard, monthlyTrend, quarterlyData, summary } = processedData;

  // Determine current quarter for highlighting
  const currentQuarter = Math.ceil((currentMonth + 1 - 2) / 3);
  const lastQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Target Dashboard</h1>
          <p className="text-muted-foreground">Track store performance against targets</p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedFY} onValueChange={setSelectedFY}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Fiscal Year" />
            </SelectTrigger>
            <SelectContent>
              {fiscalYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  FY {year}-{(year + 1).toString().slice(-2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">FY Target</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{summary.totalTarget.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{targets.length} stores</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">FY Actuals</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">₹{summary.totalActual.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">YTD Achievement</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Achievement</CardTitle>
            <Trophy className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.achievement.toFixed(1)}%</div>
            <Progress value={Math.min(100, summary.achievement)} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variance</CardTitle>
            {summary.variance >= 0 ? (
              <ArrowUp className="h-4 w-4 text-green-600" />
            ) : (
              <ArrowDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {summary.variance >= 0 ? "+" : ""}₹{summary.variance.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.variance >= 0 ? "Above target" : "Below target"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Period Tabs */}
      <Tabs value={viewPeriod} onValueChange={(v) => setViewPeriod(v as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="monthly" className="gap-2">
            <Calendar className="h-4 w-4" />
            Monthly
          </TabsTrigger>
          <TabsTrigger value="quarterly" className="gap-2">
            <Calendar className="h-4 w-4" />
            Quarterly
          </TabsTrigger>
          <TabsTrigger value="fy" className="gap-2">
            <Target className="h-4 w-4" />
            Full Year
          </TabsTrigger>
        </TabsList>

        {/* Monthly View */}
        <TabsContent value="monthly">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Target vs Actuals</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="target" fill="hsl(var(--muted))" name="Target" />
                    <Bar dataKey="actual" fill="hsl(var(--primary))" name="Actual" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Achievement Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 150]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Line 
                      type="monotone" 
                      dataKey="achievement" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                    {/* 100% reference line */}
                    <Line 
                      type="monotone" 
                      dataKey={() => 100} 
                      stroke="#22c55e" 
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Quarterly View */}
        <TabsContent value="quarterly">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Quarterly Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={quarterlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="quarter" />
                    <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                    <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="target" fill="hsl(var(--muted))" name="Target" />
                    <Bar dataKey="actual" fill="hsl(var(--primary))" name="Actual" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quarter Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {quarterlyData.map((q, idx) => {
                  const isCurrentQ = idx + 1 === currentQuarter;
                  const isLastQ = idx + 1 === lastQuarter;
                  
                  return (
                    <div key={q.quarter} className={`p-4 rounded-lg ${isCurrentQ ? "bg-primary/10 border border-primary" : "bg-muted/50"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{q.quarter}</span>
                          {isCurrentQ && <Badge>Current</Badge>}
                          {isLastQ && <Badge variant="outline">Last</Badge>}
                        </div>
                        <span className={`font-bold ${q.achievement >= 100 ? "text-green-600" : q.achievement >= 80 ? "text-blue-600" : "text-orange-600"}`}>
                          {q.achievement.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Target: ₹{q.target.toLocaleString()}</span>
                        <span>Actual: ₹{q.actual.toLocaleString()}</span>
                      </div>
                      <Progress value={Math.min(100, q.achievement)} className="mt-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Full Year View */}
        <TabsContent value="fy">
          <Card>
            <CardHeader>
              <CardTitle>Store-wise FY Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={leaderboard} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="target" fill="hsl(var(--muted))" name="Target" />
                  <Bar dataKey="actual" fill="hsl(var(--primary))" name="Actual" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Store Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Achievement</TableHead>
                <TableHead className="text-right">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((store, index) => (
                <TableRow key={store.id}>
                  <TableCell>
                    {index === 0 && <Medal className="h-5 w-5 text-amber-500" />}
                    {index === 1 && <Medal className="h-5 w-5 text-gray-400" />}
                    {index === 2 && <Medal className="h-5 w-5 text-amber-700" />}
                    {index > 2 && <span className="text-muted-foreground">{index + 1}</span>}
                  </TableCell>
                  <TableCell className="font-medium">{store.name}</TableCell>
                  <TableCell className="text-right">₹{store.target.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    ₹{store.actual.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Progress value={Math.min(100, store.achievement)} className="w-20" />
                      <span className={`font-medium ${store.achievement >= 100 ? "text-green-600" : store.achievement >= 80 ? "text-blue-600" : "text-orange-600"}`}>
                        {store.achievement.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${store.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {store.variance >= 0 ? "+" : ""}₹{store.variance.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {leaderboard.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No active targets for this fiscal year
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
