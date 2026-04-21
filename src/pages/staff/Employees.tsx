import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Users, UserCheck, UserX, Loader2, CalendarPlus, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StatCard } from "@/components/dashboard/StatCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { employeeSchema, type EmployeeFormData } from "@/lib/schemas";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const departments = ["Operations", "Sales", "Security", "Housekeeping", "IT", "Management"];
const positions = ["Store Manager", "Assistant Manager", "Sales Associate", "Cashier", "Security Guard", "Housekeeper"];

type Employee = {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  join_date: string;
  status: string;
  photo_url?: string | null;
  store_id?: string | null;
  manager_id?: string | null;
  stores?: { name: string } | null;
  manager?: { name: string } | null;
};

export default function Employees() {
  const [searchQuery, setSearchQuery] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: stores } = useQuery({
    queryKey: ["stores-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: allEmployees } = useQuery({
    queryKey: ["employees-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, name").eq("status", "active").order("name");
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter(e => e.status === "active").length;
    const onLeave = employees.filter(e => e.status === "on_leave").length;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = employees.filter(e => new Date(e.join_date) >= startOfMonth).length;
    return [
      { title: "Total Employees", value: total.toString(), icon: Users, iconColor: "bg-primary/10 text-primary" },
      { title: "Active Today", value: active.toString(), icon: UserCheck, iconColor: "bg-success/10 text-success" },
      { title: "On Leave", value: onLeave.toString(), icon: UserX, iconColor: "bg-warning/10 text-warning" },
      { title: "New This Month", value: newThisMonth.toString(), icon: CalendarPlus, iconColor: "bg-info/10 text-info" },
    ];
  }, [employees]);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: "", email: "", phone: "", department: "", position: "", joinDate: "",
      storeId: null, managerId: null, experienceYears: null, previousExperience: "", aspiration: "",
    },
  });

  useEffect(() => { fetchEmployees(); }, []);

  const fetchEmployees = async () => {
    const [{ data: employeeRows, error }, { data: storesData }, { data: employeeLookup }] = await Promise.all([
      supabase.from("employees").select("*").order("created_at", { ascending: false }),
      supabase.from("stores").select("id, name"),
      supabase.from("employees").select("id, name"),
    ]);

    if (error) {
      toast({ title: "Error", description: "Failed to load employees", variant: "destructive" });
    } else {
      const storeMap = new Map((storesData || []).map((store) => [store.id, store.name]));
      const managerMap = new Map((employeeLookup || []).map((employee) => [employee.id, employee.name]));

      const mappedEmployees = (employeeRows || []).map((employee) => ({
        ...employee,
        stores: employee.store_id ? { name: storeMap.get(employee.store_id) || "—" } : null,
        manager: employee.manager_id ? { name: managerMap.get(employee.manager_id) || "—" } : null,
      }));

      setEmployees(mappedEmployees as Employee[]);
    }
    setLoading(false);
  };

  const onSubmit = async (data: EmployeeFormData) => {
    const { error } = await supabase.from("employees").insert({
      name: data.name,
      email: data.email,
      phone: data.phone,
      department: data.department,
      position: data.position,
      join_date: data.joinDate,
      store_id: data.storeId || null,
      manager_id: data.managerId || null,
      experience_years: data.experienceYears || null,
      previous_experience: data.previousExperience || null,
      aspiration: data.aspiration || null,
      status: "active",
    });
    if (error) {
      toast({ title: "Error", description: "Failed to add employee", variant: "destructive" });
    } else {
      toast({ title: "Employee added", description: `${data.name} has been added successfully.` });
      form.reset();
      setOpen(false);
      fetchEmployees();
    }
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-muted-foreground">Manage store staff</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Add Employee</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="Enter full name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" placeholder="email@example.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input placeholder="+91 98765 43210" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="storeId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deployed Store</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {stores?.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="managerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reports To</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {allEmployees?.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="department" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="position" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Position</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {positions.map((pos) => (
                            <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="joinDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Join Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="experienceYears" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Experience (Years)</FormLabel>
                      <FormControl><Input type="number" step="0.5" placeholder="e.g. 3" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="previousExperience" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Previous Experience</FormLabel>
                    <FormControl><Textarea placeholder="Brief description of prior roles..." rows={2} {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="aspiration" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Career Aspiration</FormLabel>
                    <FormControl><Textarea placeholder="What does this employee aspire to?" rows={2} {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
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
              <TableHead></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Reports To</TableHead>
              <TableHead>Join Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.map((emp) => (
              <TableRow key={emp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/staff/employees/${emp.id}`)}>
                <TableCell>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={emp.photo_url || ""} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {emp.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="font-medium">{emp.name}</TableCell>
                <TableCell className="text-muted-foreground">{(emp.stores as any)?.name || "—"}</TableCell>
                <TableCell>{emp.department}</TableCell>
                <TableCell>{emp.position}</TableCell>
                <TableCell className="text-muted-foreground">{(emp.manager as any)?.name || "—"}</TableCell>
                <TableCell>{new Date(emp.join_date).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant={emp.status === "active" ? "default" : "secondary"}>{emp.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
