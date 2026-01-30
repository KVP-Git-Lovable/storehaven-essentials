import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useStoreAccess } from "@/hooks/useStoreAccess";
import { Plus, Search, ArrowRightLeft, Truck, CheckCircle, Package, Trash2, Send, PackageCheck } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

const transferItemSchema = z.object({
  item_id: z.string().min(1, "Item is required"),
  quantity_requested: z.coerce.number().min(1, "Quantity must be at least 1"),
  unit_cost: z.coerce.number().min(0),
  notes: z.string().optional(),
});

const transferSchema = z.object({
  from_store_id: z.string().min(1, "Source store is required"),
  to_store_id: z.string().min(1, "Destination store is required"),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  requested_by: z.string().min(1, "Your name is required"),
  notes: z.string().optional(),
  items: z.array(transferItemSchema).min(1, "At least one item is required"),
}).refine((data) => data.from_store_id !== data.to_store_id, {
  message: "Source and destination stores must be different",
  path: ["to_store_id"],
});

type TransferFormData = z.infer<typeof transferSchema>;

interface Store {
  id: string;
  name: string;
  address: string;
  manager: string;
}

interface InventoryItem {
  id: string;
  name: string;
  unit_cost: number;
  sku: string | null;
}

interface StoreTransfer {
  id: string;
  transfer_number: string;
  from_store_id: string;
  to_store_id: string;
  status: string;
  priority: string;
  requested_by: string;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  dispatched_at: string | null;
  received_by: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
  from_store?: { name: string; address: string };
  to_store?: { name: string; address: string };
}

export default function StoreTransfers() {
  const [transfers, setTransfers] = useState<StoreTransfer[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { accessibleStoreIds, isAdmin, loading: accessLoading } = useStoreAccess();

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      from_store_id: "",
      to_store_id: "",
      priority: "normal",
      requested_by: "",
      notes: "",
      items: [{ item_id: "", quantity_requested: 1, unit_cost: 0, notes: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    if (!accessLoading) {
      fetchData();
    }
  }, [accessLoading, accessibleStoreIds]);

  const fetchData = async () => {
    try {
      const storeIds = Array.from(accessibleStoreIds);
      
      // Build transfers query with store filter
      let transferQuery = supabase
        .from("store_transfers")
        .select(`
          *,
          from_store:stores!store_transfers_from_store_id_fkey(name, address),
          to_store:stores!store_transfers_to_store_id_fkey(name, address)
        `)
        .order("created_at", { ascending: false });
      
      if (!isAdmin && storeIds.length > 0) {
        // Show transfers where user has access to either source or destination store
        transferQuery = transferQuery.or(`from_store_id.in.(${storeIds.join(',')}),to_store_id.in.(${storeIds.join(',')})`);
      }
      
      const [transferRes, storeRes, itemRes] = await Promise.all([
        transferQuery,
        supabase.from("stores").select("id, name, address, manager").eq("status", "active"),
        supabase.from("inventory_items").select("id, name, unit_cost, sku").eq("status", "active"),
      ]);

      if (transferRes.error) throw transferRes.error;
      if (storeRes.error) throw storeRes.error;
      if (itemRes.error) throw itemRes.error;

      setTransfers(transferRes.data || []);
      // Filter stores for non-admins
      const allStores = storeRes.data || [];
      setStores(isAdmin ? allStores : allStores.filter(s => accessibleStoreIds.has(s.id)));
      setItems(itemRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const generateTransferNumber = () => {
    const date = new Date();
    const prefix = "TRF";
    const timestamp = date.getFullYear().toString().slice(-2) +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  };

  const onSubmit = async (data: TransferFormData) => {
    const transferNumber = generateTransferNumber();

    try {
      // Create transfer header
      const { data: transferData, error: transferError } = await supabase
        .from("store_transfers")
        .insert([{
          transfer_number: transferNumber,
          from_store_id: data.from_store_id,
          to_store_id: data.to_store_id,
          priority: data.priority,
          requested_by: data.requested_by,
          notes: data.notes || null,
          status: "pending",
        }])
        .select()
        .single();

      if (transferError) throw transferError;

      // Create transfer items
      const transferItems = data.items.map(item => ({
        transfer_id: transferData.id,
        item_id: item.item_id,
        quantity_requested: item.quantity_requested,
        unit_cost: item.unit_cost,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase.from("store_transfer_items").insert(transferItems);
      if (itemsError) throw itemsError;

      toast.success("Transfer request created successfully");
      form.reset();
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error creating transfer:", error);
      toast.error("Failed to create transfer request");
    }
  };

  const approveTransfer = async (id: string) => {
    try {
      const { error } = await supabase
        .from("store_transfers")
        .update({
          status: "approved",
          approved_by: "Admin",
          approved_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Transfer approved");
      fetchData();
    } catch (error) {
      console.error("Error approving transfer:", error);
      toast.error("Failed to approve transfer");
    }
  };

  const dispatchTransfer = async (id: string) => {
    try {
      const { error } = await supabase
        .from("store_transfers")
        .update({
          status: "in_transit",
          dispatched_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Transfer dispatched");
      fetchData();
    } catch (error) {
      console.error("Error dispatching transfer:", error);
      toast.error("Failed to dispatch transfer");
    }
  };

  const receiveTransfer = async (id: string) => {
    try {
      const { error } = await supabase
        .from("store_transfers")
        .update({
          status: "received",
          received_by: "Store Manager",
          received_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Transfer received successfully");
      fetchData();
    } catch (error) {
      console.error("Error receiving transfer:", error);
      toast.error("Failed to receive transfer");
    }
  };

  const handleItemChange = (index: number, itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      form.setValue(`items.${index}.unit_cost`, item.unit_cost);
    }
  };

  const filteredTransfers = transfers.filter(transfer =>
    transfer.transfer_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    transfer.from_store?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    transfer.to_store?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500 text-white";
      case "approved": return "bg-blue-500 text-white";
      case "in_transit": return "bg-purple-500 text-white";
      case "received": return "bg-green-500 text-white";
      case "rejected": return "bg-red-500 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 border-red-300";
      case "high": return "bg-orange-100 text-orange-800 border-orange-300";
      case "normal": return "bg-gray-100 text-gray-800 border-gray-300";
      case "low": return "bg-blue-100 text-blue-800 border-blue-300";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const pendingCount = transfers.filter(t => t.status === "pending").length;
  const approvedCount = transfers.filter(t => t.status === "approved").length;
  const inTransitCount = transfers.filter(t => t.status === "in_transit").length;
  const receivedCount = transfers.filter(t => t.status === "received").length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inter-Store Transfers</h1>
          <p className="text-muted-foreground">Request and track stock transfers between stores</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Request Transfer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Request Stock Transfer</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="from_store_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From Store (Source)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select source store" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {stores.map(store => (
                              <SelectItem key={store.id} value={store.id}>
                                {store.name}
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
                    name="to_store_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>To Store (Destination)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select destination store" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {stores.map(store => (
                              <SelectItem key={store.id} value={store.id}>
                                {store.name}
                              </SelectItem>
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
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="requested_by"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Requested By</FormLabel>
                        <FormControl>
                          <Input placeholder="Your name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Reason for transfer, special instructions..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium">Items to Transfer</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ item_id: "", quantity_requested: 1, unit_cost: 0, notes: "" })}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Item
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <Card key={field.id} className="p-3">
                        <div className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-5">
                            <FormField
                              control={form.control}
                              name={`items.${index}.item_id`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Item</FormLabel>
                                  <Select 
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      handleItemChange(index, value);
                                    }} 
                                    value={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select item" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {items.map(item => (
                                        <SelectItem key={item.id} value={item.id}>
                                          {item.name} {item.sku ? `(${item.sku})` : ''}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="col-span-2">
                            <FormField
                              control={form.control}
                              name={`items.${index}.quantity_requested`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Quantity</FormLabel>
                                  <FormControl>
                                    <Input type="number" className="h-9" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="col-span-2">
                            <FormField
                              control={form.control}
                              name={`items.${index}.unit_cost`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Unit Cost</FormLabel>
                                  <FormControl>
                                    <Input type="number" className="h-9" readOnly {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="col-span-2">
                            <FormField
                              control={form.control}
                              name={`items.${index}.notes`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Notes</FormLabel>
                                  <FormControl>
                                    <Input className="h-9" placeholder="Optional" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="col-span-1">
                            {fields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => remove(index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full">Submit Transfer Request</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready to Dispatch</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{approvedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{inTransitCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <PackageCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{receivedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search transfers..."
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
                <TableHead>Transfer #</TableHead>
                <TableHead>From Store</TableHead>
                <TableHead>To Store</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredTransfers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No transfers found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="font-mono font-medium">{transfer.transfer_number}</TableCell>
                    <TableCell>{transfer.from_store?.name || '-'}</TableCell>
                    <TableCell>{transfer.to_store?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getPriorityColor(transfer.priority)}>
                        {transfer.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{transfer.requested_by}</TableCell>
                    <TableCell>{format(new Date(transfer.requested_at), 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(transfer.status)}>
                        {transfer.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {transfer.status === 'pending' && (
                          <Button size="sm" variant="outline" onClick={() => approveTransfer(transfer.id)}>
                            Approve
                          </Button>
                        )}
                        {transfer.status === 'approved' && (
                          <Button size="sm" variant="outline" onClick={() => dispatchTransfer(transfer.id)}>
                            <Truck className="h-3 w-3 mr-1" /> Dispatch
                          </Button>
                        )}
                        {transfer.status === 'in_transit' && (
                          <Button size="sm" variant="outline" onClick={() => receiveTransfer(transfer.id)}>
                            <PackageCheck className="h-3 w-3 mr-1" /> Receive
                          </Button>
                        )}
                      </div>
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
