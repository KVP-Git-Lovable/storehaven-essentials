import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useAttendanceRole } from "@/hooks/useAttendanceRole";
import { useState } from "react";

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
  const { user } = useAuth();
  const { isManager, isEmployee } = useAttendanceRole();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

  // Get current user's employee record (for employees)
  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("id, name")
        .eq("email", user.email)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.email && isEmployee,
  });

  // Fetch all employees (for managers)
  const { data: employees } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, department")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: isManager,
  });

  // Determine which employee ID to use for fetching balances
  const effectiveEmployeeId = isEmployee ? currentEmployee?.id : selectedEmployeeId;

  // Fetch leave balances
  const { data: balances, isLoading } = useQuery({
    queryKey: ["leave-balances", effectiveEmployeeId],
    queryFn: async () => {
      if (!effectiveEmployeeId) return [];
      
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*, leave_types(name, code)")
        .eq("employee_id", effectiveEmployeeId)
        .eq("year", new Date().getFullYear());
      
      if (error) throw error;
      return (data || []) as unknown as LeaveBalance[];
    },
    enabled: !!effectiveEmployeeId,
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
        <h1 className="text-2xl font-semibold">
          {isManager ? "Employee Leave Balances" : "My Leave Balances"}
        </h1>
        <p className="text-muted-foreground">
          {isManager
            ? "View leave balances for all employees"
            : "View your leave balances for the current year"}
        </p>
      </div>

      {/* Manager: Employee Selector */}
      {isManager && (
        <div className="max-w-sm">
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Select an employee" />
            </SelectTrigger>
            <SelectContent>
              {employees?.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.name} - {emp.department}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !effectiveEmployeeId ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">
                {isManager ? "Select an employee to view balances" : "No employee record found"}
              </p>
              <p className="text-sm">
                {isManager
                  ? "Choose an employee from the dropdown above"
                  : "Your account is not linked to an employee record."}
              </p>
            </div>
          </CardContent>
        </Card>
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
                    <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950">
                      <p className="font-medium text-green-600">{balance.used}</p>
                      <p className="text-xs text-muted-foreground">Used</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950">
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
              <p className="text-sm">Leave balances haven't been initialized for this account yet.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
