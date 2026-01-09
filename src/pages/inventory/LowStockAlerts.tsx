import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Package, TrendingDown, ShoppingCart, Search, Bell, RefreshCw } from "lucide-react";

type StockAlert = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  current_stock: number;
  min_stock: number;
  max_stock: number | null;
  unit: string;
  unit_cost: number;
  stock_percentage: number;
  shortage: number;
  suggested_reorder: number;
  reorder_value: number;
  status: "critical" | "low" | "warning";
};

export default function LowStockAlerts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const { data: stockAlerts = [], isLoading, refetch } = useQuery({
    queryKey: ["low-stock-alerts"],
    queryFn: async () => {
      // Get all active inventory items
      const { data: items, error: itemsError } = await supabase
        .from("inventory_items")
        .select("id, name, sku, category, min_stock, max_stock, unit, unit_cost")
        .eq("status", "active");

      if (itemsError) throw itemsError;

      // Get stock levels from stock_ledger
      const { data: stockData, error: stockError } = await supabase
        .from("stock_ledger")
        .select("item_id, quantity_change");

      if (stockError) throw stockError;

      // Calculate current stock for each item
      const stockByItem: Record<string, number> = {};
      stockData?.forEach((entry) => {
        if (!stockByItem[entry.item_id]) {
          stockByItem[entry.item_id] = 0;
        }
        stockByItem[entry.item_id] += entry.quantity_change;
      });

      // Process items and identify low stock
      const alerts: StockAlert[] = [];

      items?.forEach((item) => {
        const currentStock = stockByItem[item.id] || 0;
        const minStock = item.min_stock || 0;
        const maxStock = item.max_stock || minStock * 3;

        // Only include items below or near minimum stock
        if (currentStock <= minStock * 1.5) {
          const stockPercentage = minStock > 0 ? (currentStock / minStock) * 100 : 100;
          const shortage = Math.max(0, minStock - currentStock);
          const suggestedReorder = Math.max(0, maxStock - currentStock);

          let status: StockAlert["status"] = "warning";
          if (currentStock <= 0) {
            status = "critical";
          } else if (currentStock < minStock) {
            status = "low";
          }

          alerts.push({
            id: item.id,
            name: item.name,
            sku: item.sku,
            category: item.category,
            current_stock: currentStock,
            min_stock: minStock,
            max_stock: maxStock,
            unit: item.unit,
            unit_cost: item.unit_cost,
            stock_percentage: Math.min(stockPercentage, 150),
            shortage,
            suggested_reorder: suggestedReorder,
            reorder_value: suggestedReorder * item.unit_cost,
            status,
          });
        }
      });

      // Sort by status severity then by stock percentage
      return alerts.sort((a, b) => {
        const statusOrder = { critical: 0, low: 1, warning: 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        return a.stock_percentage - b.stock_percentage;
      });
    },
  });

  const criticalItems = stockAlerts.filter((item) => item.status === "critical");
  const lowItems = stockAlerts.filter((item) => item.status === "low");
  const warningItems = stockAlerts.filter((item) => item.status === "warning");

  const totalReorderValue = stockAlerts.reduce((sum, item) => sum + item.reorder_value, 0);
  const criticalValue = criticalItems.reduce((sum, item) => sum + item.reorder_value, 0);

  const getFilteredItems = () => {
    let filtered = stockAlerts;
    
    switch (activeTab) {
      case "critical":
        filtered = criticalItems;
        break;
      case "low":
        filtered = lowItems;
        break;
      case "warning":
        filtered = warningItems;
        break;
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const getStatusBadge = (status: StockAlert["status"]) => {
    switch (status) {
      case "critical":
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Out of Stock</Badge>;
      case "low":
        return <Badge className="gap-1 bg-orange-500 hover:bg-orange-600"><TrendingDown className="h-3 w-3" /> Low Stock</Badge>;
      case "warning":
        return <Badge variant="secondary" className="gap-1 bg-yellow-500 text-yellow-950 hover:bg-yellow-600"><Bell className="h-3 w-3" /> Reorder Soon</Badge>;
    }
  };

  const getStockBarColor = (percentage: number) => {
    if (percentage <= 0) return "bg-destructive";
    if (percentage < 50) return "bg-orange-500";
    if (percentage < 100) return "bg-yellow-500";
    return "bg-green-500";
  };

  const createQuickRequisition = async (item: StockAlert) => {
    toast.success(`Requisition created for ${item.suggested_reorder} ${item.unit} of ${item.name}`);
    // This would integrate with the requisitions system
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Low Stock Alerts</h1>
          <p className="text-muted-foreground">Loading stock data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Low Stock Alerts</h1>
          <p className="text-muted-foreground">
            Monitor inventory levels and reorder recommendations
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-destructive">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical (Out of Stock)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{criticalItems.length}</div>
            <p className="text-xs text-muted-foreground">
              ₹{criticalValue.toLocaleString()} to restock
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{lowItems.length}</div>
            <p className="text-xs text-muted-foreground">
              Below minimum level
            </p>
          </CardContent>
        </Card>

        <Card className="border-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reorder Soon</CardTitle>
            <Bell className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{warningItems.length}</div>
            <p className="text-xs text-muted-foreground">
              Approaching minimum
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reorder Value</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalReorderValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              To reach optimal levels
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by item name, SKU, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Alerts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Alerts</CardTitle>
          <CardDescription>
            Items requiring attention based on minimum stock levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all" className="gap-2">
                All Alerts <Badge variant="secondary">{stockAlerts.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="critical" className="gap-2">
                Critical <Badge variant="destructive">{criticalItems.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="low" className="gap-2">
                Low <Badge className="bg-orange-500">{lowItems.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="warning" className="gap-2">
                Warning <Badge className="bg-yellow-500 text-yellow-950">{warningItems.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Stock Level</TableHead>
                  <TableHead className="text-center">Current</TableHead>
                  <TableHead className="text-center">Min</TableHead>
                  <TableHead className="text-center">Shortage</TableHead>
                  <TableHead className="text-center">Suggested Order</TableHead>
                  <TableHead className="text-right">Reorder Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getFilteredItems().length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {stockAlerts.length === 0 
                        ? "All items are adequately stocked!" 
                        : "No items match your search"}
                    </TableCell>
                  </TableRow>
                ) : (
                  getFilteredItems().map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.sku && (
                            <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.category}</Badge>
                      </TableCell>
                      <TableCell className="w-[140px]">
                        <div className="space-y-1">
                          <Progress 
                            value={item.stock_percentage} 
                            className="h-2"
                          />
                          <p className="text-xs text-muted-foreground text-center">
                            {Math.round(item.stock_percentage)}% of min
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={item.current_stock <= 0 ? "text-destructive font-bold" : ""}>
                          {item.current_stock} {item.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {item.min_stock} {item.unit}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.shortage > 0 ? (
                          <span className="text-destructive font-medium">-{item.shortage}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {item.suggested_reorder} {item.unit}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{item.reorder_value.toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => createQuickRequisition(item)}
                          className="gap-1"
                        >
                          <ShoppingCart className="h-3 w-3" />
                          Order
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Tabs>
        </CardContent>
      </Card>

      {/* Quick Stats by Category */}
      {stockAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alerts by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              {Object.entries(
                stockAlerts.reduce((acc, item) => {
                  if (!acc[item.category]) {
                    acc[item.category] = { count: 0, value: 0 };
                  }
                  acc[item.category].count++;
                  acc[item.category].value += item.reorder_value;
                  return acc;
                }, {} as Record<string, { count: number; value: number }>)
              ).map(([category, data]) => (
                <Card key={category} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{category}</p>
                      <p className="text-2xl font-bold">{data.count}</p>
                    </div>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ₹{data.value.toLocaleString()} to reorder
                  </p>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
