import { Plus, Calendar, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const schedules = [
  { id: "PM-001", asset: "Split AC - Downtown", type: "Quarterly Service", lastDone: "2024-01-15", nextDue: "2024-04-15", assignedTo: "CoolTech", status: "due-soon" },
  { id: "PM-002", asset: "Generator - Mall", type: "Monthly Check", lastDone: "2024-03-01", nextDue: "2024-04-01", assignedTo: "PowerGen", status: "overdue" },
  { id: "PM-003", asset: "Fire Extinguisher - All", type: "Annual Inspection", lastDone: "2023-06-20", nextDue: "2024-06-20", assignedTo: "SafeFirst", status: "scheduled" },
  { id: "PM-004", asset: "CCTV System - Airport", type: "Quarterly Service", lastDone: "2024-02-10", nextDue: "2024-05-10", assignedTo: "SecureView", status: "scheduled" },
  { id: "PM-005", asset: "Refrigerator - Suburban", type: "Monthly Check", lastDone: "2024-03-05", nextDue: "2024-04-05", assignedTo: "CoolTech", status: "due-soon" },
];

const stats = [
  { title: "Total Schedules", value: "156", icon: Calendar, iconColor: "bg-primary/10 text-primary" },
  { title: "Completed", value: "128", icon: CheckCircle, iconColor: "bg-success/10 text-success" },
  { title: "Due Soon", value: "18", icon: Clock, iconColor: "bg-warning/10 text-warning" },
  { title: "Overdue", value: "10", icon: AlertTriangle, iconColor: "bg-destructive/10 text-destructive" },
];

export default function PreventiveMaintenance() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Preventive Maintenance</h1>
          <p className="text-muted-foreground">Schedule and track routine maintenance</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Schedule
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Schedule ID</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Last Done</TableHead>
              <TableHead>Next Due</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell className="font-mono text-sm">{schedule.id}</TableCell>
                <TableCell className="font-medium">{schedule.asset}</TableCell>
                <TableCell>{schedule.type}</TableCell>
                <TableCell>{new Date(schedule.lastDone).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(schedule.nextDue).toLocaleDateString()}</TableCell>
                <TableCell>{schedule.assignedTo}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      schedule.status === "scheduled" ? "default" :
                      schedule.status === "due-soon" ? "secondary" : "destructive"
                    }
                  >
                    {schedule.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
