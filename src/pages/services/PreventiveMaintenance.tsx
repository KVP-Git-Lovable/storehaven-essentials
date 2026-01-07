import { useState, useEffect } from "react";
import { Plus, Calendar, CheckCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";
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
import { maintenanceSchema, type MaintenanceFormData } from "@/lib/schemas";
import { supabase } from "@/integrations/supabase/client";

const assets = ["Split AC - Downtown", "Generator - Mall", "Fire Extinguisher - All", "CCTV System - Airport", "Refrigerator - Suburban"];
const taskTypes = ["Routine Inspection", "Quarterly Service", "Monthly Check", "Annual Inspection", "Deep Cleaning"];
const vendors = ["CoolTech", "PowerGen", "SafeFirst", "SecureView", "IT Support Pro"];

type MaintenanceTask = {
  id: string;
  asset: string;
  task_type: string;
  frequency: string;
  last_done: string;
  next_due: string;
  assigned_to: string;
  status: string;
};

const stats = [
  { title: "Total Schedules", value: "156", icon: Calendar, iconColor: "bg-primary/10 text-primary" },
  { title: "Completed", value: "128", icon: CheckCircle, iconColor: "bg-success/10 text-success" },
  { title: "Due Soon", value: "18", icon: Clock, iconColor: "bg-warning/10 text-warning" },
  { title: "Overdue", value: "10", icon: AlertTriangle, iconColor: "bg-destructive/10 text-destructive" },
];

export default function PreventiveMaintenance() {
  const [schedules, setSchedules] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<MaintenanceFormData>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: {
      asset: "",
      taskType: "",
      frequency: "monthly",
      assignedTo: "",
      nextDue: "",
    },
  });

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    const { data, error } = await supabase
      .from("maintenance_tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to load schedules", variant: "destructive" });
    } else {
      setSchedules(data || []);
    }
    setLoading(false);
  };

  const onSubmit = async (data: MaintenanceFormData) => {
    const { error } = await supabase.from("maintenance_tasks").insert({
      asset: data.asset,
      task_type: data.taskType,
      frequency: data.frequency,
      last_done: "-",
      next_due: data.nextDue,
      assigned_to: data.assignedTo,
      status: "scheduled",
    });

    if (error) {
      toast({ title: "Error", description: "Failed to add schedule", variant: "destructive" });
    } else {
      toast({ title: "Schedule added", description: `Maintenance schedule for ${data.asset} has been created.` });
      form.reset();
      setOpen(false);
      fetchSchedules();
    }
  };

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
          <h1 className="text-2xl font-semibold">Preventive Maintenance</h1>
          <p className="text-muted-foreground">Schedule and track routine maintenance</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Maintenance Schedule</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="asset"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select asset" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {assets.map((asset) => (
                            <SelectItem key={asset} value={asset}>{asset}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="taskType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Task Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {taskTypes.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="annual">Annual</SelectItem>
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
                    name="assignedTo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned To</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {vendors.map((vendor) => (
                              <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nextDue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Next Due Date</FormLabel>
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
                  <Button type="submit">Add Schedule</Button>
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

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Task Type</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Last Done</TableHead>
              <TableHead>Next Due</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell className="font-medium">{schedule.asset}</TableCell>
                <TableCell>{schedule.task_type}</TableCell>
                <TableCell className="capitalize">{schedule.frequency}</TableCell>
                <TableCell>{schedule.last_done === "-" ? "-" : new Date(schedule.last_done).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(schedule.next_due).toLocaleDateString()}</TableCell>
                <TableCell>{schedule.assigned_to}</TableCell>
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
