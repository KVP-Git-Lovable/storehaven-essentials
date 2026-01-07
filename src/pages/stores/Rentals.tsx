import { useState } from "react";
import { Plus, Building2, Calendar, IndianRupee, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
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
import { rentalSchema, type RentalFormData } from "@/lib/schemas";

const storesList = ["Downtown Store", "Mall Outlet", "Airport Kiosk", "Suburban Store", "Highway Express", "New Location"];

const initialLeases = [
  { id: 1, store: "Downtown Store", landlord: "ABC Realty", rent: 150000, startDate: "2023-01-01", endDate: "2025-12-31", status: "active" },
  { id: 2, store: "Mall Outlet", landlord: "Phoenix Ltd", rent: 250000, startDate: "2022-06-15", endDate: "2025-06-14", status: "renewal-due" },
  { id: 3, store: "Airport Kiosk", landlord: "AAI Commercial", rent: 180000, startDate: "2024-01-01", endDate: "2026-12-31", status: "active" },
  { id: 4, store: "Suburban Store", landlord: "Green Valley Prop", rent: 85000, startDate: "2023-03-01", endDate: "2026-02-28", status: "active" },
  { id: 5, store: "Highway Express", landlord: "NH Properties", rent: 120000, startDate: "2023-07-01", endDate: "2024-06-30", status: "expired" },
];

const stats = [
  { title: "Total Monthly Rent", value: "₹7.85L", icon: IndianRupee, iconColor: "bg-primary/10 text-primary" },
  { title: "Active Leases", value: "4", icon: Building2, iconColor: "bg-success/10 text-success" },
  { title: "Renewals Due", value: "1", icon: AlertCircle, iconColor: "bg-warning/10 text-warning" },
  { title: "Avg Lease Term", value: "3 Years", icon: Calendar, iconColor: "bg-info/10 text-info" },
];

export default function Rentals() {
  const [leases, setLeases] = useState(initialLeases);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<RentalFormData>({
    resolver: zodResolver(rentalSchema),
    defaultValues: {
      store: "",
      landlord: "",
      rent: 0,
      startDate: "",
      endDate: "",
    },
  });

  const onSubmit = (data: RentalFormData) => {
    const newLease = {
      id: leases.length + 1,
      store: data.store,
      landlord: data.landlord,
      rent: data.rent,
      startDate: data.startDate,
      endDate: data.endDate,
      status: "active",
    };
    setLeases([...leases, newLease]);
    form.reset();
    setOpen(false);
    toast({
      title: "Lease added",
      description: `Lease for ${data.store} has been recorded.`,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Rentals & Leases</h1>
          <p className="text-muted-foreground">Manage store rental agreements and lease contracts</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Lease
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Lease</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  name="landlord"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Landlord Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter landlord name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Rent (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Enter rent amount" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
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
                  <Button type="submit">Add Lease</Button>
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
              <TableHead>Store</TableHead>
              <TableHead>Landlord</TableHead>
              <TableHead>Monthly Rent</TableHead>
              <TableHead>Lease Period</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leases.map((lease) => (
              <TableRow key={lease.id}>
                <TableCell className="font-medium">{lease.store}</TableCell>
                <TableCell>{lease.landlord}</TableCell>
                <TableCell>₹{lease.rent.toLocaleString()}</TableCell>
                <TableCell>
                  {new Date(lease.startDate).toLocaleDateString()} - {new Date(lease.endDate).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      lease.status === "active" ? "default" :
                      lease.status === "renewal-due" ? "secondary" : "destructive"
                    }
                  >
                    {lease.status}
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
