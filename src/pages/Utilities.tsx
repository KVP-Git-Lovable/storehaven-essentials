import { useState } from "react";
import { Plus, Gauge, Zap, Droplets, Fuel } from "lucide-react";
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const storesList = ["Downtown Store", "Mall Outlet", "Airport Kiosk", "Suburban Store", "Highway Express"];

const chartData = [
  { month: "Jan", power: 4200, water: 850, generator: 120 },
  { month: "Feb", power: 3800, water: 920, generator: 95 },
  { month: "Mar", power: 4500, water: 780, generator: 150 },
  { month: "Apr", power: 5200, water: 1100, generator: 180 },
  { month: "May", power: 5800, water: 1250, generator: 220 },
  { month: "Jun", power: 6100, water: 1400, generator: 280 },
];

const initialReadings = [
  { id: 1, store: "Downtown Store", date: "2024-03-20", power: 1250, water: 45, generator: 12 },
  { id: 2, store: "Mall Outlet", date: "2024-03-20", power: 1820, water: 62, generator: 8 },
  { id: 3, store: "Airport Kiosk", date: "2024-03-20", power: 680, water: 28, generator: 5 },
  { id: 4, store: "Suburban Store", date: "2024-03-20", power: 1100, water: 38, generator: 15 },
  { id: 5, store: "Highway Express", date: "2024-03-20", power: 950, water: 32, generator: 22 },
];

const stats = [
  { title: "Total Power (kWh)", value: "5,800", change: "+12% from last month", changeType: "negative" as const, icon: Zap, iconColor: "bg-warning/10 text-warning" },
  { title: "Water (KL)", value: "205", change: "-5% from last month", changeType: "positive" as const, icon: Droplets, iconColor: "bg-info/10 text-info" },
  { title: "Generator (Hours)", value: "62", change: "+8% from last month", changeType: "negative" as const, icon: Fuel, iconColor: "bg-destructive/10 text-destructive" },
  { title: "Monthly Cost", value: "₹2.8L", change: "+4% from last month", changeType: "negative" as const, icon: Gauge, iconColor: "bg-primary/10 text-primary" },
];

export default function Utilities() {
  const [readings, setReadings] = useState(initialReadings);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<UtilityReadingFormData>({
    resolver: zodResolver(utilityReadingSchema),
    defaultValues: {
      store: "",
      date: "",
      power: 0,
      water: 0,
      generator: 0,
    },
  });

  const onSubmit = (data: UtilityReadingFormData) => {
    const newReading = {
      id: readings.length + 1,
      store: data.store,
      date: data.date,
      power: data.power,
      water: data.water,
      generator: data.generator,
    };
    setReadings([newReading, ...readings]);
    form.reset();
    setOpen(false);
    toast({
      title: "Reading recorded",
      description: `Utility reading for ${data.store} has been saved.`,
    });
  };

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
                    name="date"
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
                <FormField
                  control={form.control}
                  name="power"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Power (kWh)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Enter power reading" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="water"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Water (KL)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Enter water reading" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="generator"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Generator (Hours)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Enter generator hours" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              <TableHead>Date</TableHead>
              <TableHead>Power (kWh)</TableHead>
              <TableHead>Water (KL)</TableHead>
              <TableHead>Generator (hrs)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {readings.map((reading) => (
              <TableRow key={reading.id}>
                <TableCell className="font-medium">{reading.store}</TableCell>
                <TableCell>{new Date(reading.date).toLocaleDateString()}</TableCell>
                <TableCell>{reading.power.toLocaleString()}</TableCell>
                <TableCell>{reading.water}</TableCell>
                <TableCell>{reading.generator}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
