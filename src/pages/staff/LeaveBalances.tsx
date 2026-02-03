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
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Fetch all active users (for managers) from profiles table
  const { data: users } = useQuery({
    queryKey: ["profiles-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, email")
        .eq("status", "active")
        .order("username");
      if (error) throw error;
      return data;
    },
    enabled: isManager,
  });

  // Determine which user ID to use for fetching balances
  const effectiveUserId = isEmployee ? user?.id : selectedUserId;

  // Fetch leave balances using user_id
  const { data: balances, isLoading } = useQuery({
    queryKey: ["leave-balances", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*, leave_types(name, code)")
        .eq("user_id", effectiveUserId)
        .eq("year", new Date().getFullYear());
      
      if (error) throw error;
      return (data || []) as unknown as LeaveBalance[];
    },
    enabled: !!effectiveUserId,
  });

  const getBalancePercentage = (balance: LeaveBalance) => {
    const total = balance.granted || 0;
    if (total === 0) return 0;
    return ((balance.used + balance.pending) / total) * 100;
  };

  const getTotal = (balance: LeaveBalance) => balance.granted || 0;

  // Get current user's display name
  const currentUserName = users?.find(u => u.id === user?.id)?.username || user?.email;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">
          {isManager ? "User Leave Balances" : "My Leave Balances"}
        </h1>
        <p className="text-muted-foreground">
          {isManager
            ? "View leave balances for all users"
            : "View your leave balances for the current year"}
        </p>
      </div>

      {/* Manager: User Selector */}
      {isManager && (
        <div className="max-w-sm">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a user" />
            </SelectTrigger>
            <SelectContent>
              {users?.map((usr) => (
                <SelectItem key={usr.id} value={usr.id}>
                  {usr.username || usr.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Employee: Show read-only current user */}
      {isEmployee && (
        <div className="max-w-sm">
          <div className="p-3 bg-muted rounded-md border">
            <span className="font-medium">{currentUserName || "Loading..."}</span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !effectiveUserId ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">
                {isManager ? "Select a user to view balances" : "No user record found"}
              </p>
              <p className="text-sm">
                {isManager
                  ? "Choose a user from the dropdown above"
                  : "Your account is not properly configured."}
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