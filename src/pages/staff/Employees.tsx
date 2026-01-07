import { useState } from "react";
import { Plus, Search, Users, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const employees = [
  { id: "EMP-001", name: "Rahul Sharma", store: "Downtown Store", role: "Store Manager", phone: "+91 98765 10001", joinDate: "2022-03-15", status: "active" },
  { id: "EMP-002", name: "Priya Patel", store: "Mall Outlet", role: "Store Manager", phone: "+91 98765 10002", joinDate: "2021-06-20", status: "active" },
  { id: "EMP-003", name: "Amit Kumar", store: "Downtown Store", role: "Sales Associate", phone: "+91 98765 10003", joinDate: "2023-01-10", status: "active" },
  { id: "EMP-004", name: "Sneha Reddy", store: "Airport Kiosk", role: "Cashier", phone: "+91 98765 10004", joinDate: "2023-08-05", status: "on-leave" },
  { id: "EMP-005", name: "Vikram Singh", store: "Suburban Store", role: "Security", phone: "+91 98765 10005", joinDate: "2022-11-12", status: "active" },
];

const stats = [
  { title: "Total Employees", value: "156", icon: Users, iconColor: "bg-primary/10 text-primary" },
  { title: "Active Today", value: "142", icon: UserCheck, iconColor: "bg-success/10 text-success" },
  { title: "On Leave", value: "8", icon: UserX, iconColor: "bg-warning/10 text-warning" },
  { title: "New This Month", value: "5", icon: Users, iconColor: "bg-info/10 text-info" },
];

export default function Employees() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-muted-foreground">Manage store staff</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Employee
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Join Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) => (
              <TableRow key={emp.id}>
                <TableCell className="font-mono text-sm">{emp.id}</TableCell>
                <TableCell className="font-medium">{emp.name}</TableCell>
                <TableCell>{emp.store}</TableCell>
                <TableCell>{emp.role}</TableCell>
                <TableCell>{emp.phone}</TableCell>
                <TableCell>{new Date(emp.joinDate).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant={emp.status === "active" ? "default" : "secondary"}>
                    {emp.status}
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
