import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Clock, CheckCircle, XCircle, AlertCircle, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function Regularization() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    attendance_date: format(new Date(), "yyyy-MM-dd"),
    request_type: "forgot_checkin",
    reason: "",
    requested_time: "",
  });

  // Fetch regularization requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ["regularization-requests"],
    queryFn: async () => {
      // For now, return empty array - table doesn't exist yet
      return [];
    },
  });

  const handleSubmit = () => {
    toast.info("Regularization feature will be available soon");
    setIsOpen(false);
  };

  const requestTypes = [
    { value: "forgot_checkin", label: "Forgot Check-in" },
    { value: "forgot_checkout", label: "Forgot Check-out" },
    { value: "wrong_location", label: "Wrong Location" },
    { value: "system_error", label: "System Error" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Attendance Regularization</h1>
          <p className="text-muted-foreground">Request corrections for attendance records</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Request
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Regularization</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Attendance Date</Label>
                <Input
                  type="date"
                  value={form.attendance_date}
                  onChange={(e) => setForm({ ...form, attendance_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Request Type</Label>
                <Select value={form.request_type} onValueChange={(v) => setForm({ ...form, request_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {requestTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Requested Time</Label>
                <Input
                  type="time"
                  value={form.requested_time}
                  onChange={(e) => setForm({ ...form, requested_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Explain why regularization is needed..."
                />
              </div>
              <Button className="w-full" onClick={handleSubmit}>
                Submit Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Regularization Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            </div>
          ) : requests && requests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Requests will be mapped here */}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No regularization requests found</p>
              <p className="text-sm">Submit a request if you need to correct attendance records</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
