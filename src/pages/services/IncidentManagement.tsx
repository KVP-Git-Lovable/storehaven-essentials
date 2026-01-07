import { useState, useEffect } from "react";
import { Plus, AlertTriangle, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

const locations = ["Downtown Store", "Mall Outlet", "Airport Kiosk", "Suburban Store", "Highway Express"];

type Incident = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  location: string;
  reported_by: string;
  status: string;
  created_at: string;
};

const stats = [
  { title: "Total Incidents", value: "42", icon: AlertTriangle, iconColor: "bg-primary/10 text-primary" },
  { title: "Open", value: "8", icon: XCircle, iconColor: "bg-destructive/10 text-destructive" },
  { title: "In Progress", value: "12", icon: Clock, iconColor: "bg-warning/10 text-warning" },
  { title: "Resolved", value: "22", icon: CheckCircle, iconColor: "bg-success/10 text-success" },
];

export default function IncidentManagement() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<IncidentFormData>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      location: "",
      reportedBy: "",
    },
  });

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    const { data, error } = await supabase
      .from("incidents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to load incidents", variant: "destructive" });
    } else {
      setIncidents(data || []);
    }
    setLoading(false);
  };

  const onSubmit = async (data: IncidentFormData) => {
    const { error } = await supabase.from("incidents").insert({
      title: data.title,
      description: data.description || null,
      priority: data.priority,
      location: data.location,
      reported_by: data.reportedBy,
      status: "open",
    });

    if (error) {
      toast({ title: "Error", description: "Failed to log incident", variant: "destructive" });
    } else {
      toast({ title: "Incident logged", description: `Incident has been created.` });
      form.reset();
      setOpen(false);
      fetchIncidents();
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
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {locations.map((loc) => (
                              <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                </div>
                <FormField
                  control={form.control}
                  name="reportedBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reported By</FormLabel>
                      <FormControl>
                        <Input placeholder="Your name" {...field} />
                      </FormControl>
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
              <TableHead>Title</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Reported By</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Reported</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incidents.map((incident) => (
              <TableRow key={incident.id}>
                <TableCell className="font-medium">{incident.title}</TableCell>
                <TableCell>{incident.location}</TableCell>
                <TableCell>{incident.reported_by}</TableCell>
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
                <TableCell className="text-sm">{new Date(incident.created_at).toLocaleDateString()}</TableCell>
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
