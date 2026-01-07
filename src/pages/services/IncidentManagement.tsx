import { useState } from "react";
import { Plus, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { incidentSchema, type IncidentFormData } from "@/lib/schemas";

const stores = ["Downtown Store", "Mall Outlet", "Airport Kiosk", "Suburban Store", "Highway Express"];
const assets = ["Split AC 1.5T", "POS Terminal", "CCTV Camera", "Generator 10KVA", "Display Fridge", "Fire Alarm"];

const initialIncidents = [
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
  const [incidents, setIncidents] = useState(initialIncidents);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<IncidentFormData>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      title: "",
      store: "",
      asset: "",
      priority: "medium",
      description: "",
    },
  });

  const onSubmit = (data: IncidentFormData) => {
    const newIncident = {
      id: `INC-${String(incidents.length + 1).padStart(3, "0")}`,
      title: data.title,
      store: data.store,
      asset: data.asset,
      priority: data.priority,
      reportedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      status: "open" as const,
    };
    setIncidents([newIncident, ...incidents]);
    form.reset();
    setOpen(false);
    toast({
      title: "Incident logged",
      description: `Incident ${newIncident.id} has been created.`,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Incident Management</h1>
          <p className="text-muted-foreground">Track and resolve asset-related issues</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Log Incident
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Log New Incident</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Brief description of the issue" {...field} />
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
                </div>
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional details about the issue..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Log Incident</Button>
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
