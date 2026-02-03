import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Clock, AlertTriangle, CheckCircle, XCircle, Timer, MapPin, Camera, Edit } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";

interface PolicyRule {
  title: string;
  description: string;
  value: string;
  icon: React.ElementType;
  iconColor: string;
  key: string;
}

export default function AttendancePolicy() {
  const { isAdmin } = usePermissions();
  const { toast } = useToast();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Editable policy values (in a real app these would come from database)
  const [policyValues, setPolicyValues] = useState({
    checkInTime: "9:00 AM",
    gracePeriod: "15",
    halfDayCutoff: "11:00 AM",
    absentCutoff: "2:00 PM",
    minWorkingHours: "8",
    gpsEnabled: true,
    faceVerificationEnabled: true,
    faceThreshold: "85",
  });

  const policies: PolicyRule[] = [
    {
      title: "Standard Check-in Time",
      description: "Employees must check in by this time to be marked 'Present'",
      value: policyValues.checkInTime,
      icon: Clock,
      iconColor: "text-green-500",
      key: "checkInTime",
    },
    {
      title: "Late Arrival Grace Period",
      description: "Time allowed after standard check-in before marked as 'Late'",
      value: `${policyValues.gracePeriod} minutes`,
      icon: Timer,
      iconColor: "text-amber-500",
      key: "gracePeriod",
    },
    {
      title: "Half Day Cut-off",
      description: "Arrival after this time counts as half-day",
      value: policyValues.halfDayCutoff,
      icon: AlertTriangle,
      iconColor: "text-orange-500",
      key: "halfDayCutoff",
    },
    {
      title: "Absent Cut-off",
      description: "No check-in after this time marks employee as Absent",
      value: policyValues.absentCutoff,
      icon: XCircle,
      iconColor: "text-red-500",
      key: "absentCutoff",
    },
    {
      title: "Minimum Working Hours",
      description: "Required hours per day for full attendance",
      value: `${policyValues.minWorkingHours} hours`,
      icon: Clock,
      iconColor: "text-blue-500",
      key: "minWorkingHours",
    },
    {
      title: "GPS Verification",
      description: "Location verification required for attendance",
      value: policyValues.gpsEnabled ? "Enabled" : "Disabled",
      icon: MapPin,
      iconColor: "text-primary",
      key: "gpsEnabled",
    },
    {
      title: "Face Verification",
      description: "AI face matching required for attendance",
      value: policyValues.faceVerificationEnabled ? `Enabled (${policyValues.faceThreshold}% threshold)` : "Disabled",
      icon: Camera,
      iconColor: "text-primary",
      key: "faceVerificationEnabled",
    },
  ];

  const handleSavePolicies = () => {
    toast({
      title: "Policies Updated",
      description: "Attendance policies have been saved successfully.",
    });
    setEditDialogOpen(false);
  };

  const leaveAccrualPolicies = [
    { type: "Casual Leave", accrual: "1.5 days/month", maxCarryForward: "5 days", encashment: "No" },
    { type: "Sick Leave", accrual: "1 day/month", maxCarryForward: "0 days", encashment: "No" },
    { type: "Earned Leave", accrual: "1.25 days/month", maxCarryForward: "30 days", encashment: "Yes" },
    { type: "Compensatory Off", accrual: "As earned", maxCarryForward: "60 days", encashment: "No" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Attendance Policy</h1>
          <p className="text-muted-foreground">View company attendance rules and guidelines</p>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" /> Edit Policies
          </Button>
        )}
      </div>

      {/* Edit Policies Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Attendance Policies</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkInTime">Standard Check-in Time</Label>
                <Input
                  id="checkInTime"
                  value={policyValues.checkInTime}
                  onChange={(e) => setPolicyValues(prev => ({ ...prev, checkInTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gracePeriod">Grace Period (minutes)</Label>
                <Input
                  id="gracePeriod"
                  type="number"
                  value={policyValues.gracePeriod}
                  onChange={(e) => setPolicyValues(prev => ({ ...prev, gracePeriod: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="halfDayCutoff">Half Day Cut-off</Label>
                <Input
                  id="halfDayCutoff"
                  value={policyValues.halfDayCutoff}
                  onChange={(e) => setPolicyValues(prev => ({ ...prev, halfDayCutoff: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="absentCutoff">Absent Cut-off</Label>
                <Input
                  id="absentCutoff"
                  value={policyValues.absentCutoff}
                  onChange={(e) => setPolicyValues(prev => ({ ...prev, absentCutoff: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minWorkingHours">Min Working Hours</Label>
                <Input
                  id="minWorkingHours"
                  type="number"
                  value={policyValues.minWorkingHours}
                  onChange={(e) => setPolicyValues(prev => ({ ...prev, minWorkingHours: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="faceThreshold">Face Match Threshold (%)</Label>
                <Input
                  id="faceThreshold"
                  type="number"
                  value={policyValues.faceThreshold}
                  onChange={(e) => setPolicyValues(prev => ({ ...prev, faceThreshold: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="gpsEnabled">GPS Verification</Label>
              <Switch
                id="gpsEnabled"
                checked={policyValues.gpsEnabled}
                onCheckedChange={(checked) => setPolicyValues(prev => ({ ...prev, gpsEnabled: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="faceEnabled">Face Verification</Label>
              <Switch
                id="faceEnabled"
                checked={policyValues.faceVerificationEnabled}
                onCheckedChange={(checked) => setPolicyValues(prev => ({ ...prev, faceVerificationEnabled: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePolicies}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Core Policies */}
      <Card>
        <CardHeader>
          <CardTitle>Core Attendance Rules</CardTitle>
          <CardDescription>These rules apply to all employees across stores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {policies.map((policy) => (
              <div
                key={policy.title}
                className="flex items-start gap-4 p-4 rounded-lg border bg-card"
              >
                <div className={`p-2 rounded-full bg-muted ${policy.iconColor}`}>
                  <policy.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium">{policy.title}</h4>
                    <Badge variant="secondary">{policy.value}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{policy.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leave Accrual Policies */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Accrual & Limits</CardTitle>
          <CardDescription>Monthly accrual rates and carry-forward rules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Leave Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Accrual Rate</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Max Carry Forward</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Encashment</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leaveAccrualPolicies.map((policy) => (
                  <tr key={policy.type}>
                    <td className="px-4 py-3 font-medium">{policy.type}</td>
                    <td className="px-4 py-3">{policy.accrual}</td>
                    <td className="px-4 py-3">{policy.maxCarryForward}</td>
                    <td className="px-4 py-3">
                      <Badge variant={policy.encashment === "Yes" ? "default" : "secondary"}>
                        {policy.encashment}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>General Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <p className="text-sm">Employees must mark attendance using the mobile app or web portal with face verification and GPS.</p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <p className="text-sm">Regularization requests must be submitted within 48 hours of the attendance date.</p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <p className="text-sm">Leave requests should be submitted at least 3 days in advance for planned leaves.</p>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <p className="text-sm">Three consecutive late arrivals will trigger a warning notification to the manager.</p>
          </div>
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <p className="text-sm">Unauthorized absence may result in deduction from salary and disciplinary action.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
