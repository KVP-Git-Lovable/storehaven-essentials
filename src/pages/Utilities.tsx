import { useState, useEffect } from "react";
import { Plus, Gauge, Zap, Droplets, Fuel, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { utilityReadingSchema, type UtilityReadingFormData } from "@/lib/schemas";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const storesList = ["Downtown Store", "Mall Outlet", "Airport Kiosk", "Suburban Store", "Highway Express"];
const utilityTypes = ["Power", "Water", "Generator"];

const chartData = [
  { month: "Jan", power: 4200, water: 850, generator: 120 },
  { month: "Feb", power: 3800, water: 920, generator: 95 },
  { month: "Mar", power: 4500, water: 780, generator: 150 },
  { month: "Apr", power: 5200, water: 1100, generator: 180 },
  { month: "May", power: 5800, water: 1250, generator: 220 },
  { month: "Jun", power: 6100, water: 1400, generator: 280 },
];

type UtilityReading = {
  id: string;
  store: string;
  utility_type: string;
  meter_reading: number;
  reading_date: string;
};

const stats = [
  { title: "Total Power (kWh)", value: "5,800", change: "+12% from last month", changeType: "negative" as const, icon: Zap, iconColor: "bg-warning/10 text-warning" },
  { title: "Water (KL)", value: "205", change: "-5% from last month", changeType: "positive" as const, icon: Droplets, iconColor: "bg-info/10 text-info" },
  { title: "Generator (Hours)", value: "62", change: "+8% from last month", changeType: "negative" as const, icon: Fuel, iconColor: "bg-destructive/10 text-destructive" },
  { title: "Monthly Cost", value: "₹2.8L", change: "+4% from last month", changeType: "negative" as const, icon: Gauge, iconColor: "bg-primary/10 text-primary" },
];

export default function Utilities() {
  const [readings, setReadings] = useState<UtilityReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<UtilityReadingFormData>({
    resolver: zodResolver(utilityReadingSchema),
    defaultValues: {
      store: "",
      utilityType: "",
      meterReading: 0,
      readingDate: "",
    },
  });

  useEffect(() => {
    fetchReadings();
  }, []);

  const fetchReadings = async () => {
    const { data, error } = await supabase
      .from("utilities")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to load readings", variant: "destructive" });
    } else {
      setReadings(data || []);
    }
    setLoading(false);
  };

  const onSubmit = async (data: UtilityReadingFormData) => {
    const { error } = await supabase.from("utilities").insert({
      store: data.store,
      utility_type: data.utilityType,
      meter_reading: data.meterReading,
      reading_date: data.readingDate,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to save reading", variant: "destructive" });
    } else {
      toast({ title: "Reading recorded", description: `Utility reading for ${data.store} has been saved.` });
      form.reset();
      setOpen(false);
      fetchReadings();
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
          <h1 className="text-2xl font-semibold">Utilities Monitoring</h1>
          <p className="text-muted-foreground">Track power, water, and generator consumption</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Reading
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Record Utility Reading</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                            {storesList.map((store) => (
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
                    name="utilityType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Utility Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {utilityTypes.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
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
                    name="meterReading"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meter Reading</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Enter reading" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="readingDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
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
                  <Button type="submit">Save Reading</Button>
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

      <div className="stat-card">
        <h3 className="font-semibold mb-4">Consumption Trends</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="power" stroke="hsl(var(--warning))" strokeWidth={2} name="Power (kWh)" />
              <Line type="monotone" dataKey="water" stroke="hsl(var(--info))" strokeWidth={2} name="Water (KL)" />
              <Line type="monotone" dataKey="generator" stroke="hsl(var(--destructive))" strokeWidth={2} name="Generator (hrs)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Latest Readings</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store</TableHead>
              <TableHead>Utility Type</TableHead>
              <TableHead>Reading</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {readings.map((reading) => (
              <TableRow key={reading.id}>
                <TableCell className="font-medium">{reading.store}</TableCell>
                <TableCell>{reading.utility_type}</TableCell>
                <TableCell>{Number(reading.meter_reading).toLocaleString()}</TableCell>
                <TableCell>{new Date(reading.reading_date).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
