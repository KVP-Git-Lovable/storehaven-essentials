import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, parseISO } from "date-fns";
import { Calendar, Plus, Check, X, Clock, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAttendanceRole } from "@/hooks/useAttendanceRole";

interface LeaveType {
  id: string;
  name: string;
  is_paid: boolean;
  max_per_year: number;
}

interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  opening_balance: number;
  granted: number;
  used: number;
  lapsed: number;
  pending: number;
  available: number;
  leave_types: LeaveType;
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  days_count: number;
  half_day_type: string | null;
  reason: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  employees: { name: string; department: string };
  leave_types: { name: string };
}

interface LeaveForm {
  employee_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  half_day_type: string;
  reason: string;
}

const defaultForm: LeaveForm = {
  employee_id: "",
  leave_type_id: "",
  from_date: "",
  to_date: "",
  half_day_type: "full",
  reason: "",
};

export default function LeaveManagement() {
  const { user, profile } = useAuth();
  const { isManager, isEmployee } = useAttendanceRole();
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [form, setForm] = useState<LeaveForm>(defaultForm);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const queryClient = useQueryClient();

  // Get current user's employee record
  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, department")
        .eq("email", user.email)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.email,
  });

  // Pre-populate employee_id for regular employees
  useEffect(() => {
    if (isEmployee && currentEmployee && !form.employee_id) {
      setForm((prev) => ({ ...prev, employee_id: currentEmployee.id }));
      setSelectedEmployee(currentEmployee.id);
    }
  }, [isEmployee, currentEmployee, form.employee_id]);

  // Fetch employees (only for managers)
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

  // Fetch leave types
  const { data: leaveTypes } = useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_types")
        .select("*")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as LeaveType[];
    },
  });

  // Fetch leave balances for selected employee
  const { data: balances } = useQuery({
    queryKey: ["leave-balances", selectedEmployee],
    queryFn: async () => {
      if (!selectedEmployee) return [];
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*, leave_types(*)")
        .eq("employee_id", selectedEmployee)
        .eq("year", new Date().getFullYear());
      if (error) throw error;
      return data as LeaveBalance[];
    },
    enabled: !!selectedEmployee,
  });

  // Fetch leave requests - filtered by role
  const { data: requests, isLoading } = useQuery({
    queryKey: ["leave-requests", isManager, currentEmployee?.id],
    queryFn: async () => {
      let query = supabase
        .from("leave_requests")
        .select("*, employees(name, department), leave_types(name)")
        .order("created_at", { ascending: false });

      // Employees only see their own requests
      if (isEmployee && currentEmployee?.id) {
        query = query.eq("employee_id", currentEmployee.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as LeaveRequest[];
    },
    enabled: isManager || !!currentEmployee?.id,
  });

  const pendingRequests = requests?.filter((r) => r.status === "pending") || [];
  const allRequests = requests || [];

  // Calculate days
  const calculatedDays = useMemo(() => {
    if (!form.from_date || !form.to_date) return 0;
    const days = differenceInDays(parseISO(form.to_date), parseISO(form.from_date)) + 1;
    if (form.half_day_type === "first_half" || form.half_day_type === "second_half") {
      return 0.5;
    }
    return days > 0 ? days : 0;
  }, [form.from_date, form.to_date, form.half_day_type]);

  // Apply leave mutation
  const applyMutation = useMutation({
    mutationFn: async (data: LeaveForm) => {
      const { error } = await supabase.from("leave_requests").insert({
        employee_id: data.employee_id,
        leave_type_id: data.leave_type_id,
        from_date: data.from_date,
        to_date: data.to_date,
        days_count: calculatedDays,
        half_day_type: data.half_day_type === "full" ? null : data.half_day_type,
        reason: data.reason || null,
      });
      if (error) throw error;

      // Update pending balance
      try {
        const { data: existingBalance } = await supabase
          .from("leave_balances")
          .select("pending")
          .eq("employee_id", data.employee_id)
          .eq("leave_type_id", data.leave_type_id)
          .eq("year", new Date().getFullYear())
          .single();

        if (existingBalance) {
          await supabase
            .from("leave_balances")
            .update({ pending: (existingBalance.pending || 0) + calculatedDays })
            .eq("employee_id", data.employee_id)
            .eq("leave_type_id", data.leave_type_id)
            .eq("year", new Date().getFullYear());
        }
      } catch (e) {
        console.log("Could not update pending balance");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
      toast.success("Leave request submitted");
      setIsApplyOpen(false);
      setForm(defaultForm);
      // Reset employee_id for employees
      if (isEmployee && currentEmployee) {
        setForm((prev) => ({ ...prev, employee_id: currentEmployee.id }));
      }
    },
    onError: (error: any) => toast.error(error.message),
  });

  // Approve/Reject mutation (only for managers)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const request = requests?.find((r) => r.id === id);
      const { error } = await supabase
        .from("leave_requests")
        .update({
          status,
          approved_by: profile?.username || "Manager",
          approved_at: new Date().toISOString(),
          rejection_reason: reason || null,
        })
        .eq("id", id);
      if (error) throw error;

      // If approved, update used balance
      if (status === "approved" && request) {
        const { data: balance } = await supabase
          .from("leave_balances")
          .select("used, pending")
          .eq("employee_id", request.employee_id)
          .eq("leave_type_id", request.leave_type_id)
          .eq("year", new Date().getFullYear())
          .single();

        if (balance) {
          await supabase
            .from("leave_balances")
            .update({
              used: (balance.used || 0) + request.days_count,
              pending: Math.max(0, (balance.pending || 0) - request.days_count),
            })
            .eq("employee_id", request.employee_id)
            .eq("leave_type_id", request.leave_type_id)
            .eq("year", new Date().getFullYear());
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
      toast.success(`Leave ${variables.status}`);
    },
    onError: (error: any) => toast.error(error.message),
  });

  const handleApply = () => {
    if (!form.employee_id || !form.leave_type_id || !form.from_date || !form.to_date) {
      toast.error("Please fill all required fields");
      return;
    }
    applyMutation.mutate(form);
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leave Management</h1>
          <p className="text-muted-foreground">
            {isManager
              ? "Apply for leave, track balances, and manage approvals"
              : "Apply for leave and track your requests"}
          </p>
        </div>
        <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Apply Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Employee selector - only for managers */}
              {isManager ? (
                <div className="space-y-2">
                  <Label>Employee *</Label>
                  <Select
                    value={form.employee_id}
                    onValueChange={(v) => {
                      setForm({ ...form, employee_id: v });
                      setSelectedEmployee(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
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
              ) : (
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-sm text-muted-foreground">Applying as</div>
                  <div className="font-medium">{currentEmployee?.name || user?.email}</div>
                </div>
              )}

              {selectedEmployee && balances && balances.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {balances.map((bal) => (
                    <div key={bal.id} className="p-2 rounded-lg bg-muted text-center">
                      <div className="text-xs text-muted-foreground">{bal.leave_types.name}</div>
                      <div className="font-semibold">{bal.available}</div>
                      <div className="text-xs text-muted-foreground">Available</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label>Leave Type *</Label>
                <Select value={form.leave_type_id} onValueChange={(v) => setForm({ ...form, leave_type_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes?.map((lt) => (
                      <SelectItem key={lt.id} value={lt.id}>
                        {lt.name} {!lt.is_paid && "(Unpaid)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Date *</Label>
                  <Input
                    type="date"
                    value={form.from_date}
                    onChange={(e) => setForm({ ...form, from_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>To Date *</Label>
                  <Input
                    type="date"
                    value={form.to_date}
                    min={form.from_date}
                    onChange={(e) => setForm({ ...form, to_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Day Type</Label>
                <Select value={form.half_day_type} onValueChange={(v) => setForm({ ...form, half_day_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Day</SelectItem>
                    <SelectItem value="first_half">First Half</SelectItem>
                    <SelectItem value="second_half">Second Half</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {calculatedDays > 0 && (
                <div className="p-3 rounded-lg bg-primary/10 text-center">
                  <span className="text-2xl font-bold text-primary">{calculatedDays}</span>
                  <span className="text-muted-foreground ml-2">day(s) requested</span>
                </div>
              )}

              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Optional reason for leave"
                />
              </div>

              <Button onClick={handleApply} disabled={applyMutation.isPending} className="w-full">
                {applyMutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats - different for employees vs managers */}
      <div className={`grid gap-4 ${isManager ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{pendingRequests.length}</div>
                <div className="text-sm text-muted-foreground">
                  {isManager ? "Pending Approval" : "My Pending"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {requests?.filter((r) => r.status === "approved").length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Approved</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <X className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {requests?.filter((r) => r.status === "rejected").length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Rejected</div>
              </div>
            </div>
          </CardContent>
        </Card>
        {isManager && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {requests?.reduce((sum, r) => sum + (r.status === "approved" ? r.days_count : 0), 0) || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Days Approved</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs - different for employees vs managers */}
      {isManager ? (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending Approval ({pendingRequests.length})</TabsTrigger>
            <TabsTrigger value="all">All Requests</TabsTrigger>
            <TabsTrigger value="balances">Leave Balances</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Leave Requests</CardTitle>
                <CardDescription>Review and approve/reject leave applications</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No pending requests</div>
                ) : (
                  <div className="space-y-4">
                    {pendingRequests.map((req) => (
                      <div key={req.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{req.employees?.name}</div>
                          <div className="text-sm text-muted-foreground">{req.employees?.department}</div>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <Badge variant="outline">{req.leave_types?.name}</Badge>
                            <span>
                              {format(parseISO(req.from_date), "MMM dd")} - {format(parseISO(req.to_date), "MMM dd, yyyy")}
                            </span>
                            <span className="font-medium">{req.days_count} days</span>
                          </div>
                          {req.reason && <p className="text-sm mt-2 text-muted-foreground">{req.reason}</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => updateStatusMutation.mutate({ id: req.id, status: "rejected" })}
                          >
                            <X className="h-4 w-4 mr-1" /> Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updateStatusMutation.mutate({ id: req.id, status: "approved" })}
                          >
                            <Check className="h-4 w-4 mr-1" /> Approve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Approved By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allRequests.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-medium">{req.employees?.name}</TableCell>
                          <TableCell>{req.leave_types?.name}</TableCell>
                          <TableCell>
                            {format(parseISO(req.from_date), "MMM dd")} - {format(parseISO(req.to_date), "MMM dd")}
                          </TableCell>
                          <TableCell>{req.days_count}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{req.reason || "-"}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[req.status]}>{req.status}</Badge>
                          </TableCell>
                          <TableCell>{req.approved_by || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="balances" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Employee Leave Balances</CardTitle>
                <CardDescription>Select an employee to view their leave balance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-sm mb-6">
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees?.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedEmployee && balances && (
                  <div className="grid gap-4 md:grid-cols-3">
                    {balances.map((bal) => (
                      <Card key={bal.id}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{bal.leave_types.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Opening:</span>
                              <span className="ml-2 font-medium">{bal.opening_balance}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Granted:</span>
                              <span className="ml-2 font-medium">{bal.granted}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Used:</span>
                              <span className="ml-2 font-medium">{bal.used}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Pending:</span>
                              <span className="ml-2 font-medium">{bal.pending}</span>
                            </div>
                          </div>
                          <div className="mt-4 p-3 rounded-lg bg-primary/10 text-center">
                            <span className="text-2xl font-bold text-primary">{bal.available}</span>
                            <div className="text-xs text-muted-foreground">Available</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {selectedEmployee && (!balances || balances.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    No leave balances found. Initialize balances for this employee.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        /* Employee View - Only My Requests */
        <Tabs defaultValue="requests">
          <TabsList>
            <TabsTrigger value="requests">My Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>My Leave Requests</CardTitle>
                <CardDescription>Track the status of your leave applications</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                  </div>
                ) : allRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No leave requests found</p>
                    <p className="text-sm">Click "Apply Leave" to submit a new request</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allRequests.map((req) => (
                      <div key={req.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">{req.leave_types?.name}</Badge>
                          <Badge className={statusColors[req.status]}>{req.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span>
                            {format(parseISO(req.from_date), "MMM dd, yyyy")} - {format(parseISO(req.to_date), "MMM dd, yyyy")}
                          </span>
                          <span className="font-medium">{req.days_count} day(s)</span>
                        </div>
                        {req.reason && (
                          <p className="text-sm text-muted-foreground mt-2">{req.reason}</p>
                        )}
                        {req.status !== "pending" && req.approved_by && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {req.status === "approved" ? "Approved" : "Rejected"} by {req.approved_by}
                          </p>
                        )}
                        {req.rejection_reason && (
                          <p className="text-sm text-red-600 mt-1">Reason: {req.rejection_reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
