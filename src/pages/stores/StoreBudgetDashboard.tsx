import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ArrowLeft,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
} from "lucide-react";

interface StoreBudget {
  id: string;
  store_id: string;
  fiscal_year: number;
  total_amount: number;
  status: string;
  stores?: { id: string; name: string };
}

interface BudgetItem {
  id: string;
  budget_id: string;
  group_name: string;
  item_name: string;
  item_type: string;
  budgeted_amount: number;
  actual_amount: number;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(217, 91%, 60%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)"];

export default function StoreBudgetDashboard() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const years = [currentYear - 1, currentYear, currentYear + 1];

  // Fetch all budgets for the year
  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["store-budgets-dashboard", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_budgets")
        .select("*, stores(id, name)")
        .eq("fiscal_year", parseInt(selectedYear))
        .eq("budget_type", "annual");
      if (error) throw error;
      return data as StoreBudget[];
    },
  });

  // Fetch all budget items for these budgets
  const budgetIds = budgets.map((b) => b.id);
  const { data: allItems = [] } = useQuery({
    queryKey: ["budget-items-dashboard", budgetIds],
    queryFn: async () => {
      if (budgetIds.length === 0) return [];
      const { data, error } = await supabase
        .from("store_budget_items")
        .select("*")
        .in("budget_id", budgetIds);
      if (error) throw error;
      return data as BudgetItem[];
    },
    enabled: budgetIds.length > 0,
  });

  // Calculate summary stats
  const totalBudgeted = budgets.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const totalActual = allItems.reduce((sum, item) => sum + item.actual_amount, 0);
  const totalVariance = totalBudgeted - totalActual;
  const approvedBudgets = budgets.filter((b) => b.status === "approved").length;

  // Store-wise comparison data
  const storeComparisonData = useMemo(() => {
    return budgets.map((budget) => {
      const budgetItems = allItems.filter((item) => item.budget_id === budget.id);
      const actual = budgetItems.reduce((sum, item) => sum + item.actual_amount, 0);
      return {
        name: budget.stores?.name || "Unknown",
        budgeted: budget.total_amount || 0,
        actual,
        variance: (budget.total_amount || 0) - actual,
      };
    });
  }, [budgets, allItems]);

  // Category-wise breakdown
  const categoryBreakdown = useMemo(() => {
    const categories: Record<string, { budgeted: number; actual: number }> = {};
    allItems.forEach((item) => {
      if (!categories[item.item_type]) {
        categories[item.item_type] = { budgeted: 0, actual: 0 };
      }
      categories[item.item_type].budgeted += item.budgeted_amount;
      categories[item.item_type].actual += item.actual_amount;
    });

    const typeLabels: Record<string, string> = {
      expense: "General Expense",
      rental: "Rental",
      utility: "Utility",
      staff: "Staff/Payroll",
      inventory: "Inventory",
      incidental: "Incidental",
    };

    return Object.entries(categories).map(([type, values]) => ({
      name: typeLabels[type] || type,
      budgeted: values.budgeted,
      actual: values.actual,
    }));
  }, [allItems]);

  // Group-wise pie chart data
  const groupBreakdown = useMemo(() => {
    const groups: Record<string, number> = {};
    allItems.forEach((item) => {
      if (!groups[item.group_name]) {
        groups[item.group_name] = 0;
      }
      groups[item.group_name] += item.budgeted_amount;
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [allItems]);

  // Store leaderboard (by variance performance)
  const storeLeaderboard = useMemo(() => {
    return [...storeComparisonData]
      .map((store) => ({
        ...store,
        variancePercent:
          store.budgeted > 0 ? ((store.budgeted - store.actual) / store.budgeted) * 100 : 0,
      }))
      .sort((a, b) => b.variancePercent - a.variancePercent);
  }, [storeComparisonData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/stores/budget")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Budget Dashboard</h1>
            <p className="text-muted-foreground">Budget vs Actual Analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  FY {y}-{y + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Budgeted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              <IndianRupee className="h-5 w-5" />
              {totalBudgeted.toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              <IndianRupee className="h-5 w-5" />
              {totalActual.toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Variance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold flex items-center ${
                totalVariance >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {totalVariance >= 0 ? (
                <TrendingUp className="h-5 w-5 mr-1" />
              ) : (
                <TrendingDown className="h-5 w-5 mr-1" />
              )}
              <IndianRupee className="h-5 w-5" />
              {Math.abs(totalVariance).toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved Budgets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {approvedBudgets} / {budgets.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store-wise Comparison Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Store-wise Budget vs Actual</CardTitle>
          </CardHeader>
          <CardContent>
            {storeComparisonData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={storeComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, ""]}
                  />
                  <Legend />
                  <Bar dataKey="budgeted" name="Budgeted" fill="hsl(var(--primary))" />
                  <Bar dataKey="actual" name="Actual" fill="hsl(var(--secondary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No budget data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget Breakdown by Group */}
        <Card>
          <CardHeader>
            <CardTitle>Budget Breakdown by Group</CardTitle>
          </CardHeader>
          <CardContent>
            {groupBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={groupBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {groupBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Amount"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category-wise Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Category-wise Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, ""]}
                />
                <Legend />
                <Bar dataKey="budgeted" name="Budgeted" fill="hsl(var(--primary))" />
                <Bar dataKey="actual" name="Actual" fill="hsl(var(--secondary))" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No category data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Store Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Store Budget Performance Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {storeLeaderboard.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Rank</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Budgeted</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-right">Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storeLeaderboard.map((store, index) => (
                  <TableRow key={store.name}>
                    <TableCell>
                      {index === 0 && "🥇"}
                      {index === 1 && "🥈"}
                      {index === 2 && "🥉"}
                      {index > 2 && index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{store.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      ₹{store.budgeted.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right">
                      ₹{store.actual.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={store.variance >= 0 ? "text-green-600" : "text-red-600"}>
                        {store.variance >= 0 ? "+" : ""}₹{store.variance.toLocaleString("en-IN")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={store.variancePercent >= 0 ? "default" : "destructive"}>
                        {store.variancePercent >= 0 ? "+" : ""}
                        {store.variancePercent.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No budget data available for comparison
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
