import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  IndianRupee,
  Save
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";

interface NsoMasterAsset {
  id: string;
  asset_master_id: string;
  quantity: number;
  asset_masters?: {
    id: string;
    name: string;
    standard_price: number | null;
  };
}

interface NSOBudgetSectionProps {
  masterId: string;
  plannedBudget: number;
  prescribedSqft: number;
  requiredAssets: NsoMasterAsset[];
}

interface SqFtBudget {
  id: string;
  name: string | null;
  price_per_sqft: number;
  status: string;
}

export function NSOBudgetSection({
  masterId,
  plannedBudget: initialPlannedBudget,
  prescribedSqft: initialPrescribedSqft,
  requiredAssets,
}: NSOBudgetSectionProps) {
  const queryClient = useQueryClient();
  const [plannedBudget, setPlannedBudget] = useState(initialPlannedBudget || 0);
  const [prescribedSqft, setPrescribedSqft] = useState(initialPrescribedSqft || 0);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch active sq ft budget rate
  const { data: sqftBudgetRate } = useQuery({
    queryKey: ["sqft-budget-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sqft_budget_master")
        .select("*")
        .eq("status", "active")
        .order("effective_from", { ascending: false, nullsFirst: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as SqFtBudget) || null;
    },
  });

  // Calculate Actual Budget from required assets
  const actualBudget = useMemo(() => {
    return requiredAssets.reduce((sum, asset) => {
      const price = asset.asset_masters?.standard_price || 0;
      return sum + price * asset.quantity;
    }, 0);
  }, [requiredAssets]);

  // Calculate Prescribed Budget from sq ft rate
  const prescribedBudget = useMemo(() => {
    if (!sqftBudgetRate || prescribedSqft <= 0) return 0;
    return prescribedSqft * sqftBudgetRate.price_per_sqft;
  }, [sqftBudgetRate, prescribedSqft]);

  // Calculate variances
  const varianceVsPrescribed = prescribedBudget > 0 ? actualBudget - prescribedBudget : 0;
  const varianceVsPlanned = plannedBudget > 0 ? actualBudget - plannedBudget : 0;

  const variancePercentVsPrescribed = prescribedBudget > 0 
    ? ((actualBudget - prescribedBudget) / prescribedBudget) * 100 
    : 0;
  const variancePercentVsPlanned = plannedBudget > 0 
    ? ((actualBudget - plannedBudget) / plannedBudget) * 100 
    : 0;

  // Update state when props change
  useEffect(() => {
    setPlannedBudget(initialPlannedBudget || 0);
    setPrescribedSqft(initialPrescribedSqft || 0);
    setHasChanges(false);
  }, [initialPlannedBudget, initialPrescribedSqft]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("nso_checklist_masters")
        .update({
          planned_budget: plannedBudget,
          prescribed_sqft: prescribedSqft,
        })
        .eq("id", masterId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-checklist-masters"] });
      toast.success("Budget settings saved");
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast.error("Failed to save: " + error.message);
    },
  });

  const handlePlannedBudgetChange = (value: string) => {
    const num = parseFloat(value) || 0;
    setPlannedBudget(num);
    setHasChanges(true);
  };

  const handlePrescribedSqftChange = (value: string) => {
    const num = parseFloat(value) || 0;
    setPrescribedSqft(num);
    setHasChanges(true);
  };

  const getVarianceColor = (variance: number, percentage: number) => {
    if (variance === 0) return "text-muted-foreground";
    if (percentage > 10) return "text-destructive"; // Red - exceeded
    if (percentage > 0) return "text-warning"; // Amber - nearing limit (using semantic token)
    return "text-primary"; // Green - within budget (using semantic token)
  };

  const getVarianceBadge = (variance: number, percentage: number) => {
    if (variance === 0) return <Badge variant="outline">On Target</Badge>;
    if (percentage > 10) return <Badge variant="destructive">Over Budget</Badge>;
    if (percentage > 0) return <Badge variant="secondary" className="border-orange-400/50 bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">Near Limit</Badge>;
    return <Badge variant="secondary" className="border-green-400/50 bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">Under Budget</Badge>;
  };

  const getVarianceIcon = (variance: number) => {
    if (variance === 0) return <Minus className="h-4 w-4" />;
    if (variance > 0) return <TrendingUp className="h-4 w-4" />;
    return <TrendingDown className="h-4 w-4" />;
  };

  const formatCurrency = (value: number) => {
    return `₹ ${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header with save button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Budget Overview
          </h3>
          <p className="text-sm text-muted-foreground">
            Track prescribed, planned, and actual budgets for this NSO template
          </p>
        </div>
        {hasChanges && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        )}
      </div>

      {/* Budget Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Prescribed Budget */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Prescribed Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              <IndianRupee className="h-5 w-5" />
              {prescribedBudget > 0 
                ? prescribedBudget.toLocaleString("en-IN") 
                : "Not configured"}
            </div>
            <div className="mt-3 space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Store Size (Sq Ft)</Label>
                <Input
                  type="number"
                  min={0}
                  value={prescribedSqft || ""}
                  onChange={(e) => handlePrescribedSqftChange(e.target.value)}
                  placeholder="Enter sq ft"
                  className="h-8"
                />
              </div>
              {sqftBudgetRate && (
                <p className="text-xs text-muted-foreground">
                  Rate: ₹{sqftBudgetRate.price_per_sqft.toLocaleString("en-IN")}/sq ft
                  {sqftBudgetRate.name && ` (${sqftBudgetRate.name})`}
                </p>
              )}
              {!sqftBudgetRate && (
                <p className="text-xs text-amber-600">
                  No active rate configured in Sq Ft Budget Master
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Planned Budget */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Planned Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              <IndianRupee className="h-5 w-5" />
              {plannedBudget > 0 
                ? plannedBudget.toLocaleString("en-IN") 
                : "Not set"}
            </div>
            <div className="mt-3 space-y-1">
              <Label className="text-xs">Expected Budget (₹)</Label>
              <Input
                type="number"
                min={0}
                value={plannedBudget || ""}
                onChange={(e) => handlePlannedBudgetChange(e.target.value)}
                placeholder="Enter planned budget"
                className="h-8"
              />
              <p className="text-xs text-muted-foreground">
                Editable by Admin / Store Manager
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actual Budget */}
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Actual Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1 text-primary">
              <IndianRupee className="h-5 w-5" />
              {actualBudget.toLocaleString("en-IN")}
            </div>
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">
                Calculated from {requiredAssets.length} required asset{requiredAssets.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                (Asset Value × Quantity)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Budget Variance Section */}
      <div>
        <h4 className="font-medium mb-4">Budget Variance Analysis</h4>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Actual vs Prescribed */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Actual vs Prescribed</span>
                {prescribedBudget > 0 && getVarianceBadge(varianceVsPrescribed, variancePercentVsPrescribed)}
              </div>
              {prescribedBudget > 0 ? (
                <div className={`flex items-center gap-2 ${getVarianceColor(varianceVsPrescribed, variancePercentVsPrescribed)}`}>
                  {getVarianceIcon(varianceVsPrescribed)}
                  <span className="text-lg font-semibold">
                    {varianceVsPrescribed > 0 ? "+" : ""}{formatCurrency(varianceVsPrescribed)}
                  </span>
                  <span className="text-sm">
                    ({variancePercentVsPrescribed > 0 ? "+" : ""}{variancePercentVsPrescribed.toFixed(1)}%)
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Configure prescribed budget to see variance
                </p>
              )}
            </CardContent>
          </Card>

          {/* Actual vs Planned */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Actual vs Planned</span>
                {plannedBudget > 0 && getVarianceBadge(varianceVsPlanned, variancePercentVsPlanned)}
              </div>
              {plannedBudget > 0 ? (
                <div className={`flex items-center gap-2 ${getVarianceColor(varianceVsPlanned, variancePercentVsPlanned)}`}>
                  {getVarianceIcon(varianceVsPlanned)}
                  <span className="text-lg font-semibold">
                    {varianceVsPlanned > 0 ? "+" : ""}{formatCurrency(varianceVsPlanned)}
                  </span>
                  <span className="text-sm">
                    ({variancePercentVsPlanned > 0 ? "+" : ""}{variancePercentVsPlanned.toFixed(1)}%)
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Set a planned budget to see variance
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Asset Breakdown Summary */}
      {requiredAssets.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="font-medium mb-3">Asset Cost Breakdown</h4>
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 font-medium">Asset</th>
                    <th className="text-right p-2 font-medium">Unit Price</th>
                    <th className="text-right p-2 font-medium">Qty</th>
                    <th className="text-right p-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {requiredAssets.map((asset) => {
                    const price = asset.asset_masters?.standard_price || 0;
                    const total = price * asset.quantity;
                    return (
                      <tr key={asset.id} className="border-b last:border-0">
                        <td className="p-2">{asset.asset_masters?.name || "Unknown"}</td>
                        <td className="text-right p-2 text-muted-foreground">
                          {price > 0 ? formatCurrency(price) : "N/A"}
                        </td>
                        <td className="text-right p-2">{asset.quantity}</td>
                        <td className="text-right p-2 font-medium">
                          {total > 0 ? formatCurrency(total) : "N/A"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-semibold">
                    <td colSpan={3} className="p-2 text-right">Total Actual Budget:</td>
                    <td className="p-2 text-right">{formatCurrency(actualBudget)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
