import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, IndianRupee, TrendingUp, TrendingDown, Package } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NSOStoreBudgetSectionProps {
  checklistId: string;
  storeId: string;
  prescribedBudget: number;
  budget: number;
  finalBudget: number;
  onBudgetUpdate: (field: "budget" | "final_budget", value: number) => void;
}

interface BudgetItem {
  id: string;
  checklist_id: string;
  description: string;
  category: string;
  amount: number;
  sort_order: number;
  created_at: string;
}

interface StoreAsset {
  id: string;
  asset_master_id: string;
  quantity: number;
  asset_master?: {
    name: string;
    standard_price: number | null;
  };
}

const BUDGET_CATEGORIES = [
  { value: "rent", label: "Rent" },
  { value: "labour", label: "Labour Charges" },
  { value: "utilities", label: "Utilities" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Other" },
];

export function NSOStoreBudgetSection({
  checklistId,
  storeId,
  prescribedBudget,
  budget,
  finalBudget,
  onBudgetUpdate,
}: NSOStoreBudgetSectionProps) {
  const queryClient = useQueryClient();
  const [editingBudget, setEditingBudget] = useState<string>(budget.toString());
  const [editingFinalBudget, setEditingFinalBudget] = useState<string>(finalBudget.toString());
  const [newItem, setNewItem] = useState({
    description: "",
    category: "other",
    amount: "",
  });

  // Fetch budget line items
  const { data: budgetItems = [] } = useQuery({
    queryKey: ["nso-budget-items", checklistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nso_store_budget_items")
        .select("*")
        .eq("checklist_id", checklistId)
        .order("sort_order");
      if (error) throw error;
      return data as BudgetItem[];
    },
  });

  // Fetch store assets with their values
  const { data: storeAssets = [] } = useQuery({
    queryKey: ["nso-store-assets-with-values", checklistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nso_store_assets")
        .select(`
          id,
          asset_master_id,
          quantity,
          asset_master:asset_masters(name, standard_price)
        `)
        .eq("checklist_id", checklistId);
      if (error) throw error;
      return data as StoreAsset[];
    },
  });

  // Add budget item mutation
  const addItemMutation = useMutation({
    mutationFn: async (item: typeof newItem) => {
      const maxOrder = budgetItems.length > 0
        ? Math.max(...budgetItems.map((i) => i.sort_order)) + 1
        : 0;
      const { error } = await supabase.from("nso_store_budget_items").insert({
        checklist_id: checklistId,
        description: item.description,
        category: item.category,
        amount: parseFloat(item.amount) || 0,
        sort_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-budget-items", checklistId] });
      toast.success("Line item added");
      setNewItem({ description: "", category: "other", amount: "" });
    },
    onError: () => toast.error("Failed to add line item"),
  });

  // Delete budget item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("nso_store_budget_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-budget-items", checklistId] });
      toast.success("Line item removed");
    },
    onError: () => toast.error("Failed to remove line item"),
  });

  // Calculate totals
  const assetCostsTotal = storeAssets.reduce((sum, asset) => {
    const price = asset.asset_master?.standard_price || 0;
    return sum + price * asset.quantity;
  }, 0);

  const lineItemsTotal = budgetItems.reduce((sum, item) => sum + item.amount, 0);
  const totalUtilized = assetCostsTotal + lineItemsTotal;
  const activeBudget = budget || prescribedBudget;
  const remainingBudget = activeBudget - totalUtilized;

  // Determine status
  const utilizationPercent = activeBudget > 0 ? (totalUtilized / activeBudget) * 100 : 0;
  const getBudgetStatus = () => {
    if (utilizationPercent > 100) return { label: "Over Budget", color: "destructive" as const, icon: TrendingDown };
    if (utilizationPercent >= 80) return { label: "Near Limit", color: "warning" as const, icon: TrendingUp };
    return { label: "Within Budget", color: "default" as const, icon: TrendingUp };
  };
  const budgetStatus = getBudgetStatus();

  const handleBudgetBlur = () => {
    const value = parseFloat(editingBudget) || 0;
    if (value !== budget) {
      onBudgetUpdate("budget", value);
    }
  };

  const handleFinalBudgetBlur = () => {
    const value = parseFloat(editingFinalBudget) || 0;
    if (value !== finalBudget) {
      onBudgetUpdate("final_budget", value);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Budget Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Prescribed Budget */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Prescribed Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(prescribedBudget)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Based on store sq ft × rate
            </p>
          </CardContent>
        </Card>

        {/* Editable Budget */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                value={editingBudget}
                onChange={(e) => setEditingBudget(e.target.value)}
                onBlur={handleBudgetBlur}
                className="pl-9 text-lg font-semibold"
                placeholder="0"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Planned budget (editable)
            </p>
          </CardContent>
        </Card>

        {/* Editable Final Budget */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Final Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                value={editingFinalBudget}
                onChange={(e) => setEditingFinalBudget(e.target.value)}
                onBlur={handleFinalBudgetBlur}
                className="pl-9 text-lg font-semibold"
                placeholder="0"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Final approved budget
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Utilization Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Budget Utilization</CardTitle>
            <Badge
              variant={budgetStatus.color === "warning" ? "secondary" : budgetStatus.color}
              className={cn(
                budgetStatus.color === "warning" && "bg-amber-100 text-amber-800 hover:bg-amber-100"
              )}
            >
              <budgetStatus.icon className="h-3 w-3 mr-1" />
              {budgetStatus.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Asset Costs</p>
              <p className="text-lg font-semibold">{formatCurrency(assetCostsTotal)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Line Items</p>
              <p className="text-lg font-semibold">{formatCurrency(lineItemsTotal)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Total Utilized</p>
              <p className="text-lg font-semibold">{formatCurrency(totalUtilized)}</p>
            </div>
            <div
              className={cn(
                "p-3 rounded-lg",
                remainingBudget < 0
                  ? "bg-destructive/10"
                  : remainingBudget < activeBudget * 0.2
                    ? "bg-amber-100"
                    : "bg-green-100"
              )}
            >
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p
                className={cn(
                  "text-lg font-semibold",
                  remainingBudget < 0 ? "text-destructive" : "text-green-700"
                )}
              >
                {formatCurrency(remainingBudget)}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Budget Usage</span>
              <span>{utilizationPercent.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  utilizationPercent > 100
                    ? "bg-destructive"
                    : utilizationPercent >= 80
                      ? "bg-amber-500"
                      : "bg-green-500"
                )}
                style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Asset Costs Breakdown */}
      {storeAssets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Asset Costs Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storeAssets.map((asset) => {
                  const price = asset.asset_master?.standard_price || 0;
                  const total = price * asset.quantity;
                  return (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">
                        {asset.asset_master?.name || "Unknown Asset"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(price)}
                      </TableCell>
                      <TableCell className="text-right">{asset.quantity}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(total)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={3} className="font-semibold">
                    Total Asset Costs
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(assetCostsTotal)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Additional Line Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Additional Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new item form */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">Description</Label>
              <Input
                value={newItem.description}
                onChange={(e) =>
                  setNewItem((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="e.g., Rent deposit"
              />
            </div>
            <div className="w-40">
              <Label className="text-xs">Category</Label>
              <Select
                value={newItem.category}
                onValueChange={(v) =>
                  setNewItem((prev) => ({ ...prev, category: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Label className="text-xs">Amount (₹)</Label>
              <Input
                type="number"
                value={newItem.amount}
                onChange={(e) =>
                  setNewItem((prev) => ({ ...prev, amount: e.target.value }))
                }
                placeholder="0"
              />
            </div>
            <Button
              size="sm"
              onClick={() => addItemMutation.mutate(newItem)}
              disabled={!newItem.description.trim() || !newItem.amount || addItemMutation.isPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Items table */}
          {budgetItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgetItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {BUDGET_CATEGORIES.find((c) => c.value === item.category)?.label ||
                          item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteItemMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={2} className="font-semibold">
                    Total Line Items
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(lineItemsTotal)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">No additional line items yet</p>
              <p className="text-xs">Add expenses like rent, labour charges, etc.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
