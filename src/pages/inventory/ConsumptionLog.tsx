import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Search, Package, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const consumptionSchema = z.object({
  store_id: z.string().min(1, "Store is required"),
  item_id: z.string().min(1, "Item is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  purpose: z.string().min(1, "Purpose is required"),
  logged_by: z.string().min(1, "Your name is required"),
  consumption_date: z.string().min(1, "Date is required"),
});

type ConsumptionFormData = z.infer<typeof consumptionSchema>;

interface Store {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
}

interface ConsumptionLog {
  id: string;
  store_id: string;
  item_id: string;
  quantity: number;
  purpose: string;
  logged_by: string;
  consumption_date: string;
  created_at: string;
  stores?: { name: string };
  inventory_items?: { name: string; unit: string };
}

export default function ConsumptionLog() {
  const [logs, setLogs] = useState<ConsumptionLog[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<ConsumptionFormData>({
    resolver: zodResolver(consumptionSchema),
    defaultValues: {
      store_id: "",
      item_id: "",
      quantity: 1,
      purpose: "",
      logged_by: "",
      consumption_date: format(new Date(), "yyyy-MM-dd"),
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [logRes, storeRes, itemRes] = await Promise.all([
        supabase
          .from("consumption_logs")
          .select("*, stores(name), inventory_items(name, unit)")
          .order("consumption_date", { ascending: false }),
        supabase.from("stores").select("id, name").eq("status", "active"),
        supabase.from("inventory_items").select("id, name, unit").eq("status", "active"),
      ]);

      if (logRes.error) throw logRes.error;
      if (storeRes.error) throw storeRes.error;
      if (itemRes.error) throw itemRes.error;

      setLogs(logRes.data || []);
      setStores(storeRes.data || []);
      setItems(itemRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ConsumptionFormData) => {
    try {
      const { error } = await supabase.from("consumption_logs").insert([{
        store_id: data.store_id,
        item_id: data.item_id,
        quantity: data.quantity,
        purpose: data.purpose,
        logged_by: data.logged_by,
        consumption_date: data.consumption_date,
      }]);
      if (error) throw error;
      toast.success("Consumption logged successfully");
      form.reset({
        store_id: "",
        item_id: "",
        quantity: 1,
        purpose: "",
        logged_by: "",
        consumption_date: format(new Date(), "yyyy-MM-dd"),
      });
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error logging consumption:", error);
      toast.error("Failed to log consumption");
    }
  };

  const filteredLogs = logs.filter(log =>
    log.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.logged_by.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const todayTotal = logs.filter(
    log => log.consumption_date === format(new Date(), "yyyy-MM-dd")
  ).length;

  const purposes = [
    "Store Cleaning",
    "Equipment Maintenance",
    "Display Setup",
    "Office Use",
    "Customer Service",
    "Repairs",
    "Staff Use",
    "Other",
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Daily Consumption Log</h1>
          <p className="text-muted-foreground">Track items used for store operations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Log Consumption
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Log Item Consumption</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="store_id"
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
                          {stores.map(store => (
                            <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="item_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {items.map(item => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} ({item.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purpose</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select purpose" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {purposes.map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="consumption_date"
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
                <FormField
                  control={form.control}
                  name="logged_by"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logged By</FormLabel>
                      <FormControl>
                        <Input placeholder="Your name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">Log Consumption</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Entries</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayTotal}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stores</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stores.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by purpose or staff name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Logged By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No consumption logs found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{format(new Date(log.consumption_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{log.stores?.name || '-'}</TableCell>
                    <TableCell>
                      <div>{log.inventory_items?.name || '-'}</div>
                      <div className="text-xs text-muted-foreground">{log.inventory_items?.unit}</div>
                    </TableCell>
                    <TableCell className="font-medium">{log.quantity}</TableCell>
                    <TableCell>{log.purpose}</TableCell>
                    <TableCell>{log.logged_by}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
