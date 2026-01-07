import { Calendar, UserCheck, UserX, Clock } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const attendance = [
  { id: 1, employee: "Rahul Sharma", store: "Downtown Store", date: "2024-03-20", checkIn: "09:00", checkOut: "18:15", status: "present" },
  { id: 2, employee: "Priya Patel", store: "Mall Outlet", date: "2024-03-20", checkIn: "08:45", checkOut: "17:30", status: "present" },
  { id: 3, employee: "Amit Kumar", store: "Downtown Store", date: "2024-03-20", checkIn: "09:30", checkOut: "-", status: "late" },
  { id: 4, employee: "Sneha Reddy", store: "Airport Kiosk", date: "2024-03-20", checkIn: "-", checkOut: "-", status: "leave" },
  { id: 5, employee: "Vikram Singh", store: "Suburban Store", date: "2024-03-20", checkIn: "-", checkOut: "-", status: "absent" },
];

const leaveRequests = [
  { id: 1, employee: "Sneha Reddy", type: "Sick Leave", from: "2024-03-20", to: "2024-03-22", days: 3, status: "approved" },
  { id: 2, employee: "Amit Kumar", type: "Casual Leave", from: "2024-03-25", to: "2024-03-25", days: 1, status: "pending" },
  { id: 3, employee: "Priya Patel", type: "Annual Leave", from: "2024-04-01", to: "2024-04-05", days: 5, status: "pending" },
];

const stats = [
  { title: "Present Today", value: "142", icon: UserCheck, iconColor: "bg-success/10 text-success" },
  { title: "On Leave", value: "8", icon: Calendar, iconColor: "bg-info/10 text-info" },
  { title: "Late Arrivals", value: "3", icon: Clock, iconColor: "bg-warning/10 text-warning" },
  { title: "Absent", value: "3", icon: UserX, iconColor: "bg-destructive/10 text-destructive" },
];

export default function Attendance() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">Attendance & Leave</h1>
        <p className="text-muted-foreground">Track employee attendance and manage leave requests</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Today's Attendance</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.employee}</TableCell>
                  <TableCell>{record.store}</TableCell>
                  <TableCell>{record.checkIn}</TableCell>
                  <TableCell>{record.checkOut}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        record.status === "present" ? "default" :
                        record.status === "late" ? "secondary" :
                        record.status === "leave" ? "outline" : "destructive"
                      }
                    >
                      {record.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Leave Requests</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaveRequests.map((leave) => (
                <TableRow key={leave.id}>
                  <TableCell className="font-medium">{leave.employee}</TableCell>
                  <TableCell>{leave.type}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(leave.from).toLocaleDateString()} - {new Date(leave.to).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{leave.days}</TableCell>
                  <TableCell>
                    <Badge variant={leave.status === "approved" ? "default" : "secondary"}>
                      {leave.status}
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
