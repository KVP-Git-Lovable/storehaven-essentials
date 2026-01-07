import { ShieldCheck, Users, AlertTriangle, Clock } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const securityChecklist = [
  { id: 1, task: "CCTV systems check", frequency: "Daily", lastDone: "2024-03-20 09:00", status: "completed" },
  { id: 2, task: "Fire alarm test", frequency: "Weekly", lastDone: "2024-03-18", status: "completed" },
  { id: 3, task: "Emergency exit inspection", frequency: "Daily", lastDone: "2024-03-20 08:30", status: "completed" },
  { id: 4, task: "Cash handling audit", frequency: "Daily", lastDone: "2024-03-19", status: "pending" },
  { id: 5, task: "Access control review", frequency: "Monthly", lastDone: "2024-02-28", status: "overdue" },
];

const roster = [
  { id: 1, name: "Suresh Kumar", store: "Downtown Store", shift: "Day (8AM-8PM)", phone: "+91 98765 20001", status: "on-duty" },
  { id: 2, name: "Ramesh Yadav", store: "Downtown Store", shift: "Night (8PM-8AM)", phone: "+91 98765 20002", status: "off-duty" },
  { id: 3, name: "Mahesh Patil", store: "Mall Outlet", shift: "Day (8AM-8PM)", phone: "+91 98765 20003", status: "on-duty" },
  { id: 4, name: "Ganesh Reddy", store: "Airport Kiosk", shift: "Day (8AM-8PM)", phone: "+91 98765 20004", status: "on-duty" },
  { id: 5, name: "Dinesh Sharma", store: "Suburban Store", shift: "Night (8PM-8AM)", phone: "+91 98765 20005", status: "on-duty" },
];

const stats = [
  { title: "Security Staff", value: "24", icon: Users, iconColor: "bg-primary/10 text-primary" },
  { title: "On Duty", value: "16", icon: ShieldCheck, iconColor: "bg-success/10 text-success" },
  { title: "Checks Pending", value: "2", icon: Clock, iconColor: "bg-warning/10 text-warning" },
  { title: "Incidents Today", value: "0", icon: AlertTriangle, iconColor: "bg-info/10 text-info" },
];

export default function Security() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">Security</h1>
        <p className="text-muted-foreground">Security roster and compliance checks</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Security Checklist</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Last Done</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {securityChecklist.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox checked={item.status === "completed"} />
                  </TableCell>
                  <TableCell className="font-medium">{item.task}</TableCell>
                  <TableCell>{item.frequency}</TableCell>
                  <TableCell className="text-sm">{item.lastDone}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.status === "completed" ? "default" :
                        item.status === "pending" ? "secondary" : "destructive"
                      }
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Security Roster</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roster.map((guard) => (
                <TableRow key={guard.id}>
                  <TableCell className="font-medium">{guard.name}</TableCell>
                  <TableCell>{guard.store}</TableCell>
                  <TableCell>{guard.shift}</TableCell>
                  <TableCell>
                    <Badge variant={guard.status === "on-duty" ? "default" : "secondary"}>
                      {guard.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
