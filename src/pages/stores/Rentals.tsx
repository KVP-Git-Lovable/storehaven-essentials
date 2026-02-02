import { useState, useEffect } from "react";
import { Plus, Building2, Calendar, IndianRupee, AlertCircle, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RentalPaymentsTable } from "@/components/rentals/RentalPaymentsTable";
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
import { supabase } from "@/integrations/supabase/client";

type Rental = {
  id: string;
  store: string;
  landlord: string;
  rent: number;
  start_date: string;
  end_date: string;
  status: string;
};

type Store = {
  id: string;
  name: string;
};

const stats = [
  { title: "Total Monthly Rent", value: "₹7.85L", icon: IndianRupee, iconColor: "bg-primary/10 text-primary" },
  { title: "Active Leases", value: "4", icon: Building2, iconColor: "bg-success/10 text-success" },
  { title: "Renewals Due", value: "1", icon: AlertCircle, iconColor: "bg-warning/10 text-warning" },
  { title: "Avg Lease Term", value: "3 Years", icon: Calendar, iconColor: "bg-info/10 text-info" },
];

export default function Rentals() {
  const [leases, setLeases] = useState<Rental[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [rentalsResult, storesResult] = await Promise.all([
      supabase.from("rentals").select("*").order("created_at", { ascending: false }),
      supabase.from("stores").select("id, name").order("name", { ascending: true })
    ]);

    if (rentalsResult.error) {
      toast({ title: "Error", description: "Failed to load rentals", variant: "destructive" });
    } else {
      setLeases(rentalsResult.data || []);
    }

    if (storesResult.error) {
      toast({ title: "Error", description: "Failed to load stores", variant: "destructive" });
    } else {
      setStores(storesResult.data || []);
    }
    
    setLoading(false);
  };

  const generateMonthlyPayments = async (rentalId: string, rent: number, startDate: string, endDate: string) => {
    const payments = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Set to first of each month
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    
    while (current <= end) {
      const monthYear = new Date(current);
      const dueDate = new Date(current.getFullYear(), current.getMonth(), 5); // Due on 5th of each month
      
      payments.push({
        rental_id: rentalId,
        month_year: monthYear.toISOString().split('T')[0],
        amount: rent,
        due_date: dueDate.toISOString().split('T')[0],
        status: dueDate < new Date() ? 'overdue' : 'unpaid',
      });
      
      current.setMonth(current.getMonth() + 1);
    }
    
    if (payments.length > 0) {
      await supabase.from("rental_payments").insert(payments);
    }
  };

  const onSubmit = async (data: RentalFormData) => {
    const { data: rental, error } = await supabase.from("rentals").insert({
      store: data.store,
      landlord: data.landlord,
      rent: data.rent,
      start_date: data.startDate,
      end_date: data.endDate,
      status: "active",
    }).select().single();

    if (error) {
      toast({ title: "Error", description: "Failed to add lease", variant: "destructive" });
    } else {
      // Generate monthly payment entries
      await generateMonthlyPayments(rental.id, data.rent, data.startDate, data.endDate);
      
      toast({ title: "Lease added", description: `Lease for ${data.store} has been recorded with ${Math.ceil((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30))} monthly payments.` });
      form.reset();
      setOpen(false);
      fetchData();
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
                          {stores.map((store) => (
                            <SelectItem key={store.id} value={store.name}>{store.name}</SelectItem>
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

      <RentalPaymentsTable leases={leases} />
    </div>
  );
}
