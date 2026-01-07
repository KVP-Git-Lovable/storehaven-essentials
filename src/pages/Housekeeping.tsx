import { ClipboardList, CheckCircle, Clock, AlertTriangle } from "lucide-react";
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

const checklist = [
  { id: 1, task: "Floor mopping", frequency: "Daily", store: "Downtown Store", lastDone: "2024-03-20 08:00", status: "completed" },
  { id: 2, task: "Restroom cleaning", frequency: "3x Daily", store: "Downtown Store", lastDone: "2024-03-20 12:00", status: "completed" },
  { id: 3, task: "Window cleaning", frequency: "Weekly", store: "Mall Outlet", lastDone: "2024-03-18", status: "pending" },
  { id: 4, task: "AC filter cleaning", frequency: "Monthly", store: "Airport Kiosk", lastDone: "2024-03-01", status: "overdue" },
  { id: 5, task: "Deep cleaning", frequency: "Quarterly", store: "Suburban Store", lastDone: "2024-01-15", status: "pending" },
];

const roster = [
  { id: 1, name: "Raju", store: "Downtown Store", shift: "Morning (6AM-2PM)", date: "2024-03-20", status: "on-duty" },
  { id: 2, name: "Sunita", store: "Downtown Store", shift: "Evening (2PM-10PM)", date: "2024-03-20", status: "on-duty" },
  { id: 3, name: "Mohan", store: "Mall Outlet", shift: "Morning (6AM-2PM)", date: "2024-03-20", status: "on-duty" },
  { id: 4, name: "Lakshmi", store: "Airport Kiosk", shift: "Night (10PM-6AM)", date: "2024-03-20", status: "on-duty" },
];

const stats = [
  { title: "Total Tasks", value: "48", icon: ClipboardList, iconColor: "bg-primary/10 text-primary" },
  { title: "Completed Today", value: "32", icon: CheckCircle, iconColor: "bg-success/10 text-success" },
  { title: "Pending", value: "12", icon: Clock, iconColor: "bg-warning/10 text-warning" },
  { title: "Overdue", value: "4", icon: AlertTriangle, iconColor: "bg-destructive/10 text-destructive" },
];

export default function Housekeeping() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">Housekeeping</h1>
        <p className="text-muted-foreground">Manage cleaning schedules and rosters</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Cleaning Checklist</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checklist.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox checked={item.status === "completed"} />
                  </TableCell>
                  <TableCell className="font-medium">{item.task}</TableCell>
                  <TableCell>{item.frequency}</TableCell>
                  <TableCell>{item.store}</TableCell>
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
            <h3 className="font-semibold">Today's Roster</h3>
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
              {roster.map((person) => (
                <TableRow key={person.id}>
                  <TableCell className="font-medium">{person.name}</TableCell>
                  <TableCell>{person.store}</TableCell>
                  <TableCell>{person.shift}</TableCell>
                  <TableCell>
                    <Badge variant="default">{person.status}</Badge>
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
