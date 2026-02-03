import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";

interface LeaveBalance {
  id: string;
  leave_type_id: string;
  granted: number;
  used: number;
  pending: number;
  available: number;
  leave_types: {
    name: string;
    code: string;
  } | null;
}

export default function LeaveBalances() {
  const { user, profile } = useAuth();

  // Fetch leave balances for current user's employee record
  const { data: balances, isLoading } = useQuery({
    queryKey: ["my-leave-balances", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // First find employee by email
      const { data: employee } = await supabase
        .from("employees")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();
      
      if (!employee) return [];
      
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*, leave_types(name, code)")
        .eq("employee_id", employee.id)
        .eq("year", new Date().getFullYear());
      
      if (error) throw error;
      return (data || []) as unknown as LeaveBalance[];
    },
    enabled: !!user?.id,
  });

  const getBalancePercentage = (balance: LeaveBalance) => {
    const total = balance.granted || 0;
    if (total === 0) return 0;
    return ((balance.used + balance.pending) / total) * 100;
  };

  const getTotal = (balance: LeaveBalance) => balance.granted || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">My Leave Balances</h1>
        <p className="text-muted-foreground">View your leave balances for the current year</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : balances && balances.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {balances.map((balance) => {
            const total = getTotal(balance);
            const available = balance.available || 0;
            const usedPercentage = getBalancePercentage(balance);
            
            return (
              <Card key={balance.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">
                    {balance.leave_types?.name || "Unknown"}
                  </CardTitle>
                  <CardDescription>
                    {balance.leave_types?.code || "-"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold text-primary">{available}</span>
                    <span className="text-sm text-muted-foreground">of {total} days</span>
                  </div>
                  
                  <Progress value={usedPercentage} className="h-2" />
                  
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center p-2 rounded-lg bg-muted">
                      <p className="font-medium">{total}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-green-50">
                      <p className="font-medium text-green-600">{balance.used}</p>
                      <p className="text-xs text-muted-foreground">Used</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-amber-50">
                      <p className="font-medium text-amber-600">{balance.pending}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No leave balances found</p>
              <p className="text-sm">Leave balances haven't been initialized for your account yet.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
