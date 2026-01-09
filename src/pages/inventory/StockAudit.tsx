import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Search, ClipboardCheck, AlertTriangle, CheckCircle, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  FormDescription,
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

const adjustmentSchema = z.object({
  store_id: z.string().min(1, "Store is required"),
  item_id: z.string().min(1, "Item is required"),
  reason_code_id: z.string().min(1, "Reason code is required"),
  system_quantity: z.coerce.number().min(0),
  physical_quantity: z.coerce.number().min(0),
  unit_cost: z.coerce.number().min(0),
  notes: z.string().optional(),
  created_by: z.string().min(1, "Your name is required"),
});

type AdjustmentFormData = z.infer<typeof adjustmentSchema>;

interface Store {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  name: string;
  unit_cost: number;
}

interface ReasonCode {
  id: string;
  code: string;
  name: string;
  category: string;
  accounting_impact: string;
  requires_approval: boolean;
}

interface StockAdjustment {
  id: string;
  adjustment_number: string;
  store_id: string;
  item_id: string;
  reason_code_id: string;
  system_quantity: number;
  physical_quantity: number;
  variance: number;
  unit_cost: number;
  total_value: number;
  status: string;
  notes: string | null;
  created_by: string;
  approved_by: string | null;
  created_at: string;
  stores?: { name: string };
  inventory_items?: { name: string };
  reason_codes?: { code: string; name: string };
}

export default function StockAudit() {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [reasonCodes, setReasonCodes] = useState<ReasonCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [blindMode, setBlindMode] = useState(true);

  const form = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      store_id: "",
      item_id: "",
      reason_code_id: "",
      system_quantity: 0,
      physical_quantity: 0,
      unit_cost: 0,
      notes: "",
      created_by: "",
    },
  });

  const selectedItem = items.find(i => i.id === form.watch("item_id"));

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedItem) {
      form.setValue("unit_cost", selectedItem.unit_cost);
    }
  }, [selectedItem, form]);

  const fetchData = async () => {
    try {
      const [adjRes, storeRes, itemRes, reasonRes] = await Promise.all([
        supabase
          .from("stock_adjustments")
          .select("*, stores(name), inventory_items(name), reason_codes(code, name)")
          .order("created_at", { ascending: false }),
        supabase.from("stores").select("id, name").eq("status", "active"),
        supabase.from("inventory_items").select("id, name, unit_cost").eq("status", "active"),
        supabase.from("reason_codes").select("*").eq("status", "active"),
      ]);

      if (adjRes.error) throw adjRes.error;
      if (storeRes.error) throw storeRes.error;
      if (itemRes.error) throw itemRes.error;
      if (reasonRes.error) throw reasonRes.error;

      setAdjustments(adjRes.data || []);
      setStores(storeRes.data || []);
      setItems(itemRes.data || []);
      setReasonCodes(reasonRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const generateAdjNumber = () => {
    const date = new Date();
    const prefix = "ADJ";
    const timestamp = date.getFullYear().toString().slice(-2) +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  };

  const onSubmit = async (data: AdjustmentFormData) => {
    const variance = data.physical_quantity - data.system_quantity;
    const totalValue = Math.abs(variance) * data.unit_cost;
    const selectedReason = reasonCodes.find(r => r.id === data.reason_code_id);
    
    try {
      const { error } = await supabase.from("stock_adjustments").insert([{
        adjustment_number: generateAdjNumber(),
        store_id: data.store_id,
        warehouse_id: null,
        adjustment_type: "audit",
        item_id: data.item_id,
        reason_code_id: data.reason_code_id,
        system_quantity: data.system_quantity,
        physical_quantity: data.physical_quantity,
        variance,
        unit_cost: data.unit_cost,
        total_value: totalValue,
        status: selectedReason?.requires_approval ? "pending" : "approved",
        notes: data.notes || null,
        created_by: data.created_by,
        approved_by: selectedReason?.requires_approval ? null : "Auto-Approved",
      }]);
      if (error) throw error;
      toast.success("Stock adjustment recorded");
      form.reset();
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error creating adjustment:", error);
      toast.error("Failed to create adjustment");
    }
  };

  const approveAdjustment = async (id: string) => {
    try {
      const { error } = await supabase
        .from("stock_adjustments")
        .update({
          status: "approved",
          approved_by: "Admin",
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Adjustment approved");
      fetchData();
    } catch (error) {
      console.error("Error approving adjustment:", error);
      toast.error("Failed to approve adjustment");
    }
  };

  const filteredAdjustments = adjustments.filter(adj =>
    adj.adjustment_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    adj.created_by.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalShrinkage = adjustments
    .filter(a => a.status === 'approved' && a.variance < 0)
    .reduce((sum, a) => sum + a.total_value, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Stock Audit & Adjustments</h1>
          <p className="text-muted-foreground">Blind stock counts and variance tracking</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Record Adjustment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Stock Count / Adjustment</DialogTitle>
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
                            <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
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
                    name="physical_quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Physical Count</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Enter count" {...field} />
                        </FormControl>
                        <FormDescription>Actual count from floor</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="system_quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>System Quantity</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            disabled={blindMode}
                            className={blindMode ? "bg-muted" : ""}
                          />
                        </FormControl>
                        <FormDescription>
                          {blindMode ? "Hidden for blind count" : "From system"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="reason_code_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason Code</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {reasonCodes.map(rc => (
                            <SelectItem key={rc.id} value={rc.id}>
                              [{rc.code}] {rc.name}
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
                  name="created_by"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Counted By</FormLabel>
                      <FormControl>
                        <Input placeholder="Your name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional details..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">Submit Adjustment</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Adjustments</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adjustments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {adjustments.filter(a => a.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {adjustments.filter(a => a.status === 'approved').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shrinkage</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ₹{totalShrinkage.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search adjustments..."
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
                <TableHead>Adjustment #</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>System Qty</TableHead>
                <TableHead>Physical Qty</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Value Impact</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredAdjustments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No adjustments found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAdjustments.map((adj) => (
                  <TableRow key={adj.id}>
                    <TableCell className="font-mono font-medium">{adj.adjustment_number}</TableCell>
                    <TableCell>{adj.stores?.name || '-'}</TableCell>
                    <TableCell>{adj.inventory_items?.name || '-'}</TableCell>
                    <TableCell>{adj.system_quantity}</TableCell>
                    <TableCell>{adj.physical_quantity}</TableCell>
                    <TableCell>
                      <span className={adj.variance < 0 ? "text-red-600" : adj.variance > 0 ? "text-green-600" : ""}>
                        {adj.variance > 0 ? '+' : ''}{adj.variance}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={adj.variance < 0 ? "text-red-600" : "text-green-600"}>
                        ₹{adj.total_value.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {adj.reason_codes?.code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={adj.status === 'approved' ? 'default' : 'secondary'}>
                        {adj.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {adj.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => approveAdjustment(adj.id)}>
                          Approve
                        </Button>
                      )}
                    </TableCell>
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
