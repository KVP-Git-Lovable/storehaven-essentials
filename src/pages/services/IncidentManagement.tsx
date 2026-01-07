import { Plus, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
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

const incidents = [
  { id: "INC-001", title: "AC not cooling", store: "Downtown Store", asset: "Split AC 1.5T", priority: "high", reportedAt: "2024-03-20 09:30", status: "open" },
  { id: "INC-002", title: "POS terminal freeze", store: "Mall Outlet", asset: "POS Terminal", priority: "critical", reportedAt: "2024-03-20 10:15", status: "in-progress" },
  { id: "INC-003", title: "Camera offline", store: "Airport Kiosk", asset: "CCTV Camera", priority: "medium", reportedAt: "2024-03-19 14:00", status: "in-progress" },
  { id: "INC-004", title: "Generator start issue", store: "Suburban Store", asset: "Generator 10KVA", priority: "high", reportedAt: "2024-03-18 16:45", status: "resolved" },
  { id: "INC-005", title: "Refrigerator leak", store: "Highway Express", asset: "Display Fridge", priority: "medium", reportedAt: "2024-03-17 11:20", status: "resolved" },
];

const stats = [
  { title: "Total Incidents", value: "42", icon: AlertTriangle, iconColor: "bg-primary/10 text-primary" },
  { title: "Open", value: "8", icon: XCircle, iconColor: "bg-destructive/10 text-destructive" },
  { title: "In Progress", value: "12", icon: Clock, iconColor: "bg-warning/10 text-warning" },
  { title: "Resolved", value: "22", icon: CheckCircle, iconColor: "bg-success/10 text-success" },
];

export default function IncidentManagement() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Incident Management</h1>
          <p className="text-muted-foreground">Track and resolve asset-related issues</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Log Incident
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
              <TableHead>Incident ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Reported</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incidents.map((incident) => (
              <TableRow key={incident.id}>
                <TableCell className="font-mono text-sm">{incident.id}</TableCell>
                <TableCell className="font-medium">{incident.title}</TableCell>
                <TableCell>{incident.store}</TableCell>
                <TableCell>{incident.asset}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      incident.priority === "critical" ? "destructive" :
                      incident.priority === "high" ? "secondary" : "outline"
                    }
                  >
                    {incident.priority}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{incident.reportedAt}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      incident.status === "resolved" ? "default" :
                      incident.status === "in-progress" ? "secondary" : "destructive"
                    }
                  >
                    {incident.status}
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
