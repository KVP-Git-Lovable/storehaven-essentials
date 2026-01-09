import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Clock, XCircle, Tag, RotateCcw, Package } from "lucide-react";
import { format, differenceInDays, parseISO, isAfter, isBefore, addDays } from "date-fns";

type ExpiryItem = {
  id: string;
  item_id: string;
  item_name: string;
  batch_number: string | null;
  expiry_date: string;
  quantity: number;
  unit_cost: number;
  location_type: string;
  location_id: string;
  days_until_expiry: number;
  total_value: number;
  status: "expired" | "critical" | "warning" | "safe";
  recommendation: string;
};

const ExpiryManagement = () => {
  const [activeTab, setActiveTab] = useState("all");

  const { data: expiryItems = [], isLoading } = useQuery({
    queryKey: ["expiry-items"],
    queryFn: async () => {
      const today = new Date();
      const warningDate = addDays(today, 30);

      // Get stock ledger entries with expiry dates
      const { data: stockData, error: stockError } = await supabase
        .from("stock_ledger")
        .select(`
          id,
          item_id,
          batch_number,
          expiry_date,
          quantity_change,
          unit_cost,
          location_type,
          location_id,
          inventory_items (name)
        `)
        .not("expiry_date", "is", null)
        .lte("expiry_date", format(warningDate, "yyyy-MM-dd"))
        .gt("quantity_change", 0);

      if (stockError) throw stockError;

      // Get GRN items with expiry dates
      const { data: grnData, error: grnError } = await supabase
        .from("grn_items")
        .select(`
          id,
          item_id,
          batch_number,
          expiry_date,
          quantity_received,
          unit_cost,
          grn (store_id),
          inventory_items (name)
        `)
        .not("expiry_date", "is", null)
        .lte("expiry_date", format(warningDate, "yyyy-MM-dd"))
        .gt("quantity_received", 0);

      if (grnError) throw grnError;

      const items: ExpiryItem[] = [];

      // Process stock ledger items
      stockData?.forEach((item) => {
        if (!item.expiry_date) return;
        
        const expiryDate = parseISO(item.expiry_date);
        const daysUntil = differenceInDays(expiryDate, today);
        
        let status: ExpiryItem["status"] = "safe";
        let recommendation = "";

        if (daysUntil < 0) {
          status = "expired";
          recommendation = "Immediate RTV or disposal required";
        } else if (daysUntil <= 7) {
          status = "critical";
          recommendation = "Priority clearance sale or RTV";
        } else if (daysUntil <= 30) {
          status = "warning";
          recommendation = "Consider clearance pricing";
        }

        items.push({
          id: item.id,
          item_id: item.item_id,
          item_name: item.inventory_items?.name || "Unknown Item",
          batch_number: item.batch_number,
          expiry_date: item.expiry_date,
          quantity: item.quantity_change,
          unit_cost: item.unit_cost,
          location_type: item.location_type,
          location_id: item.location_id,
          days_until_expiry: daysUntil,
          total_value: item.quantity_change * item.unit_cost,
          status,
          recommendation,
        });
      });

      // Process GRN items
      grnData?.forEach((item) => {
        if (!item.expiry_date) return;
        
        const expiryDate = parseISO(item.expiry_date);
        const daysUntil = differenceInDays(expiryDate, today);
        
        let status: ExpiryItem["status"] = "safe";
        let recommendation = "";

        if (daysUntil < 0) {
          status = "expired";
          recommendation = "Immediate RTV or disposal required";
        } else if (daysUntil <= 7) {
          status = "critical";
          recommendation = "Priority clearance sale or RTV";
        } else if (daysUntil <= 30) {
          status = "warning";
          recommendation = "Consider clearance pricing";
        }

        items.push({
          id: item.id,
          item_id: item.item_id,
          item_name: item.inventory_items?.name || "Unknown Item",
          batch_number: item.batch_number,
          expiry_date: item.expiry_date,
          quantity: item.quantity_received,
          unit_cost: item.unit_cost,
          location_type: "store",
          location_id: item.grn?.store_id || "",
          days_until_expiry: daysUntil,
          total_value: item.quantity_received * item.unit_cost,
          status,
          recommendation,
        });
      });

      return items.sort((a, b) => a.days_until_expiry - b.days_until_expiry);
    },
  });

  const expiredItems = expiryItems.filter((item) => item.status === "expired");
  const criticalItems = expiryItems.filter((item) => item.status === "critical");
  const warningItems = expiryItems.filter((item) => item.status === "warning");

  const totalAtRiskValue = expiryItems.reduce((sum, item) => sum + item.total_value, 0);
  const expiredValue = expiredItems.reduce((sum, item) => sum + item.total_value, 0);
  const criticalValue = criticalItems.reduce((sum, item) => sum + item.total_value, 0);

  const getStatusBadge = (status: ExpiryItem["status"]) => {
    switch (status) {
      case "expired":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Expired</Badge>;
      case "critical":
        return <Badge className="gap-1 bg-orange-500 hover:bg-orange-600"><AlertTriangle className="h-3 w-3" /> Critical</Badge>;
      case "warning":
        return <Badge variant="secondary" className="gap-1 bg-yellow-500 text-yellow-950 hover:bg-yellow-600"><Clock className="h-3 w-3" /> Warning</Badge>;
      default:
        return <Badge variant="outline">Safe</Badge>;
    }
  };

  const getFilteredItems = () => {
    switch (activeTab) {
      case "expired":
        return expiredItems;
      case "critical":
        return criticalItems;
      case "warning":
        return warningItems;
      default:
        return expiryItems;
    }
  };

  const renderItemsTable = (items: ExpiryItem[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Batch</TableHead>
          <TableHead>Expiry Date</TableHead>
          <TableHead>Days Left</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead className="text-right">Value at Risk</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Recommendation</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
              No items found in this category
            </TableCell>
          </TableRow>
        ) : (
          items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.item_name}</TableCell>
              <TableCell>{item.batch_number || "-"}</TableCell>
              <TableCell>{format(parseISO(item.expiry_date), "MMM dd, yyyy")}</TableCell>
              <TableCell>
                <span className={item.days_until_expiry < 0 ? "text-destructive font-medium" : item.days_until_expiry <= 7 ? "text-orange-600 font-medium" : "text-yellow-600"}>
                  {item.days_until_expiry < 0 ? `${Math.abs(item.days_until_expiry)} days ago` : `${item.days_until_expiry} days`}
                </span>
              </TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell className="text-right font-medium">₹{item.total_value.toLocaleString()}</TableCell>
              <TableCell>{getStatusBadge(item.status)}</TableCell>
              <TableCell className="max-w-[200px] text-sm text-muted-foreground">{item.recommendation}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Tag className="h-3 w-3" />
                    Clearance
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <RotateCcw className="h-3 w-3" />
                    RTV
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expiry Management</h1>
          <p className="text-muted-foreground">Loading expiry data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Expiry Management</h1>
        <p className="text-muted-foreground">
          Monitor items nearing expiration and take action to minimize losses
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total At-Risk Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiryItems.length}</div>
            <p className="text-xs text-muted-foreground">
              ₹{totalAtRiskValue.toLocaleString()} total value
            </p>
          </CardContent>
        </Card>

        <Card className="border-destructive">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{expiredItems.length}</div>
            <p className="text-xs text-muted-foreground">
              ₹{expiredValue.toLocaleString()} at risk
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical (≤7 days)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{criticalItems.length}</div>
            <p className="text-xs text-muted-foreground">
              ₹{criticalValue.toLocaleString()} at risk
            </p>
          </CardContent>
        </Card>

        <Card className="border-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warning (≤30 days)</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{warningItems.length}</div>
            <p className="text-xs text-muted-foreground">
              Consider clearance pricing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Items Table with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Items Requiring Action</CardTitle>
          <CardDescription>
            Review and take action on items approaching or past expiration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all" className="gap-2">
                All <Badge variant="secondary">{expiryItems.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="expired" className="gap-2">
                Expired <Badge variant="destructive">{expiredItems.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="critical" className="gap-2">
                Critical <Badge className="bg-orange-500">{criticalItems.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="warning" className="gap-2">
                Warning <Badge className="bg-yellow-500 text-yellow-950">{warningItems.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">{renderItemsTable(getFilteredItems())}</TabsContent>
            <TabsContent value="expired">{renderItemsTable(getFilteredItems())}</TabsContent>
            <TabsContent value="critical">{renderItemsTable(getFilteredItems())}</TabsContent>
            <TabsContent value="warning">{renderItemsTable(getFilteredItems())}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpiryManagement;
