import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, CheckCircle2 } from "lucide-react";

interface NSOStoreBudgetSectionProps {
  masterId: string | null;
}

interface MasterBudget {
  estimated_budget: number | null;
  budget: number | null;
  actual_budget: number | null;
}

export function NSOStoreBudgetSection({ masterId }: NSOStoreBudgetSectionProps) {
  // Fetch master budget data
  const { data: masterBudget, isLoading } = useQuery({
    queryKey: ["nso-master-budget", masterId],
    queryFn: async () => {
      if (!masterId) return null;
      const { data, error } = await supabase
        .from("nso_checklist_masters")
        .select("estimated_budget, budget, actual_budget")
        .eq("id", masterId)
        .single();
      if (error) throw error;
      return data as MasterBudget;
    },
    enabled: !!masterId,
  });

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (!masterId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No template linked to this checklist</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!masterBudget) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Budget data not available</p>
      </div>
    );
  }

  const budgetItems = [
    {
      title: "Estimated Budget",
      value: masterBudget.estimated_budget,
      icon: TrendingUp,
      description: "Initial projected budget from template",
    },
    {
      title: "Budget",
      value: masterBudget.budget,
      icon: DollarSign,
      description: "Approved working budget",
    },
    {
      title: "Actual Budget",
      value: masterBudget.actual_budget,
      icon: CheckCircle2,
      description: "Final recorded expenditure",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {budgetItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {item.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(item.value)}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="rounded-lg border bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Note:</strong> Budget values are inherited from the linked NSO Checklist Template. 
          To modify budget allocations, please update the master template configuration.
        </p>
      </div>
    </div>
  );
}
