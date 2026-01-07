import { useState } from "react";
import { Plus, Search, Users, UserCheck, UserX } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { employeeSchema, type EmployeeFormData } from "@/lib/schemas";

const stores = ["Downtown Store", "Mall Outlet", "Airport Kiosk", "Suburban Store", "Highway Express"];
const roles = ["Store Manager", "Assistant Manager", "Sales Associate", "Cashier", "Security", "Housekeeping"];

const initialEmployees = [
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
  const [employees, setEmployees] = useState(initialEmployees);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: "",
      store: "",
      role: "",
      phone: "",
      joinDate: "",
    },
  });

  const onSubmit = (data: EmployeeFormData) => {
    const newEmployee = {
      id: `EMP-${String(employees.length + 1).padStart(3, "0")}`,
      name: data.name,
      store: data.store,
      role: data.role,
      phone: data.phone,
      joinDate: data.joinDate,
      status: "active",
    };
    setEmployees([...employees, newEmployee]);
    form.reset();
    setOpen(false);
    toast({
      title: "Employee added",
      description: `${data.name} has been added successfully.`,
    });
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.store.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-muted-foreground">Manage store staff</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="store"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select store" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {stores.map((store) => (
                              <SelectItem key={store} value={store}>{store}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role} value={role}>{role}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 98765 43210" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="joinDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Join Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Employee</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
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
            {filteredEmployees.map((emp) => (
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
