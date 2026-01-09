import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Search, RotateCcw, Truck, CheckCircle, Package, Printer, Trash2, X } from "lucide-react";
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

const rtvItemSchema = z.object({
  item_id: z.string().min(1, "Item is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  unit_cost: z.coerce.number().min(0),
  reason: z.string().min(1, "Reason is required"),
  batch_number: z.string().optional(),
});

const rtvSchema = z.object({
  vendor_id: z.string().min(1, "Vendor is required"),
  source_type: z.enum(["store", "warehouse"]),
  store_id: z.string().optional(),
  warehouse_id: z.string().optional(),
  reason: z.string().min(1, "Overall reason is required"),
  notes: z.string().optional(),
  created_by: z.string().min(1, "Your name is required"),
  items: z.array(rtvItemSchema).min(1, "At least one item is required"),
});

type RTVFormData = z.infer<typeof rtvSchema>;

interface Vendor {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
}

interface Store {
  id: string;
  name: string;
  address: string;
}

interface Warehouse {
  id: string;
  name: string;
  address: string | null;
}

interface InventoryItem {
  id: string;
  name: string;
  unit_cost: number;
  sku: string | null;
}

interface RTV {
  id: string;
  rtv_number: string;
  vendor_id: string | null;
  store_id: string | null;
  warehouse_id: string | null;
  reason: string;
  status: string;
  total_value: number;
  created_by: string;
  approved_by: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  created_at: string;
  notes: string | null;
  vendors?: { name: string; contact_person: string; phone: string; email: string } | null;
  stores?: { name: string; address: string } | null;
  warehouses?: { name: string; address: string | null } | null;
}

const REASON_OPTIONS = [
  "Damaged goods",
  "Expired products",
  "Defective items",
  "Wrong delivery",
  "Excess stock",
  "Quality issues",
  "Recall",
  "Other",
];

export default function ReturnToVendor() {
  const [rtvs, setRtvs] = useState<RTV[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRtv, setSelectedRtv] = useState<RTV | null>(null);
  const [isLabelDialogOpen, setIsLabelDialogOpen] = useState(false);

  const form = useForm<RTVFormData>({
    resolver: zodResolver(rtvSchema),
    defaultValues: {
      vendor_id: "",
      source_type: "store",
      store_id: "",
      warehouse_id: "",
      reason: "",
      notes: "",
      created_by: "",
      items: [{ item_id: "", quantity: 1, unit_cost: 0, reason: "", batch_number: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const sourceType = form.watch("source_type");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rtvRes, vendorRes, storeRes, warehouseRes, itemRes] = await Promise.all([
        supabase
          .from("rtv")
          .select("*, vendors(name, contact_person, phone, email), stores(name, address), warehouses(name, address)")
          .order("created_at", { ascending: false }),
        supabase.from("vendors").select("id, name, contact_person, phone, email").eq("status", "active"),
        supabase.from("stores").select("id, name, address").eq("status", "active"),
        supabase.from("warehouses").select("id, name, address").eq("status", "active"),
        supabase.from("inventory_items").select("id, name, unit_cost, sku").eq("status", "active"),
      ]);

      if (rtvRes.error) throw rtvRes.error;
      if (vendorRes.error) throw vendorRes.error;
      if (storeRes.error) throw storeRes.error;
      if (warehouseRes.error) throw warehouseRes.error;
      if (itemRes.error) throw itemRes.error;

      setRtvs(rtvRes.data || []);
      setVendors(vendorRes.data || []);
      setStores(storeRes.data || []);
      setWarehouses(warehouseRes.data || []);
      setItems(itemRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const generateRtvNumber = () => {
    const date = new Date();
    const prefix = "RTV";
    const timestamp = date.getFullYear().toString().slice(-2) +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  };

  const onSubmit = async (data: RTVFormData) => {
    const totalValue = data.items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
    const rtvNumber = generateRtvNumber();

    try {
      // Create RTV header
      const { data: rtvData, error: rtvError } = await supabase
        .from("rtv")
        .insert([{
          rtv_number: rtvNumber,
          vendor_id: data.vendor_id,
          store_id: data.source_type === "store" ? data.store_id : null,
          warehouse_id: data.source_type === "warehouse" ? data.warehouse_id : null,
          reason: data.reason,
          notes: data.notes || null,
          created_by: data.created_by,
          total_value: totalValue,
          status: "pending",
        }])
        .select()
        .single();

      if (rtvError) throw rtvError;

      // Create RTV items
      const rtvItems = data.items.map(item => ({
        rtv_id: rtvData.id,
        item_id: item.item_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        reason: item.reason,
        batch_number: item.batch_number || null,
      }));

      const { error: itemsError } = await supabase.from("rtv_items").insert(rtvItems);
      if (itemsError) throw itemsError;

      toast.success("RTV created successfully");
      form.reset();
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error creating RTV:", error);
      toast.error("Failed to create RTV");
    }
  };

  const approveRtv = async (id: string) => {
    try {
      const { error } = await supabase
        .from("rtv")
        .update({
          status: "approved",
          approved_by: "Admin",
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("RTV approved");
      fetchData();
    } catch (error) {
      console.error("Error approving RTV:", error);
      toast.error("Failed to approve RTV");
    }
  };

  const shipRtv = async (id: string) => {
    try {
      const { error } = await supabase
        .from("rtv")
        .update({
          status: "shipped",
          shipped_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("RTV marked as shipped");
      fetchData();
    } catch (error) {
      console.error("Error updating RTV:", error);
      toast.error("Failed to update RTV");
    }
  };

  const completeRtv = async (id: string) => {
    try {
      const { error } = await supabase
        .from("rtv")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("RTV completed");
      fetchData();
    } catch (error) {
      console.error("Error completing RTV:", error);
      toast.error("Failed to complete RTV");
    }
  };

  const openShippingLabel = (rtv: RTV) => {
    setSelectedRtv(rtv);
    setIsLabelDialogOpen(true);
  };

  const printLabel = () => {
    window.print();
  };

  const handleItemChange = (index: number, itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      form.setValue(`items.${index}.unit_cost`, item.unit_cost);
    }
  };

  const filteredRtvs = rtvs.filter(rtv =>
    rtv.rtv_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rtv.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500 text-white";
      case "approved": return "bg-blue-500 text-white";
      case "shipped": return "bg-purple-500 text-white";
      case "completed": return "bg-green-500 text-white";
      case "rejected": return "bg-red-500 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const pendingCount = rtvs.filter(r => r.status === "pending").length;
  const approvedCount = rtvs.filter(r => r.status === "approved").length;
  const shippedCount = rtvs.filter(r => r.status === "shipped").length;
  const totalValue = rtvs.reduce((sum, r) => sum + r.total_value, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Return to Vendor</h1>
          <p className="text-muted-foreground">Manage returns of damaged, defective, or excess stock</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create RTV
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Return to Vendor</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vendor_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {vendors.map(vendor => (
                              <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="source_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Return From</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="store">Store</SelectItem>
                            <SelectItem value="warehouse">Warehouse</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {sourceType === "store" && (
                  <FormField
                    control={form.control}
                    name="store_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                )}

                {sourceType === "warehouse" && (
                  <FormField
                    control={form.control}
                    name="warehouse_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warehouse</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select warehouse" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {warehouses.map(wh => (
                              <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Overall Reason</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {REASON_OPTIONS.map(reason => (
                              <SelectItem key={reason} value={reason}>{reason}</SelectItem>
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
                        <FormLabel>Created By</FormLabel>
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
                        <Textarea placeholder="Additional details..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium">Items to Return</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ item_id: "", quantity: 1, unit_cost: 0, reason: "", batch_number: "" })}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Item
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <Card key={field.id} className="p-3">
                        <div className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-4">
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
                              name={`items.${index}.quantity`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Qty</FormLabel>
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
                                    <Input type="number" className="h-9" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="col-span-3">
                            <FormField
                              control={form.control}
                              name={`items.${index}.reason`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Reason</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Reason" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {REASON_OPTIONS.map(reason => (
                                        <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
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

                <Button type="submit" className="w-full">Create RTV</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total RTVs</CardTitle>
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rtvs.length}</div>
            <p className="text-xs text-muted-foreground">₹{totalValue.toLocaleString()} total value</p>
          </CardContent>
        </Card>
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
            <CardTitle className="text-sm font-medium">Ready to Ship</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
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
            <div className="text-2xl font-bold text-purple-600">{shippedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search RTVs..."
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
                <TableHead>RTV Number</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredRtvs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No RTVs found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRtvs.map((rtv) => (
                  <TableRow key={rtv.id}>
                    <TableCell className="font-mono font-medium">{rtv.rtv_number}</TableCell>
                    <TableCell>{rtv.vendors?.name || '-'}</TableCell>
                    <TableCell>
                      {rtv.stores?.name || rtv.warehouses?.name || '-'}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">{rtv.reason}</TableCell>
                    <TableCell className="text-right font-medium">₹{rtv.total_value.toLocaleString()}</TableCell>
                    <TableCell>{rtv.created_by}</TableCell>
                    <TableCell>{format(new Date(rtv.created_at), 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(rtv.status)}>
                        {rtv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {rtv.status === 'pending' && (
                          <Button size="sm" variant="outline" onClick={() => approveRtv(rtv.id)}>
                            Approve
                          </Button>
                        )}
                        {rtv.status === 'approved' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openShippingLabel(rtv)}>
                              <Printer className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => shipRtv(rtv.id)}>
                              Ship
                            </Button>
                          </>
                        )}
                        {rtv.status === 'shipped' && (
                          <Button size="sm" variant="outline" onClick={() => completeRtv(rtv.id)}>
                            Complete
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

      {/* Shipping Label Dialog */}
      <Dialog open={isLabelDialogOpen} onOpenChange={setIsLabelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Return Shipping Label
            </DialogTitle>
          </DialogHeader>
          
          {selectedRtv && (
            <div className="space-y-4">
              <Card className="border-2 border-dashed print:border-solid">
                <CardContent className="p-6 space-y-4">
                  <div className="text-center border-b pb-4">
                    <h2 className="text-2xl font-bold">RETURN TO VENDOR</h2>
                    <p className="text-lg font-mono mt-2">{selectedRtv.rtv_number}</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-medium">Ship To (Vendor)</p>
                      <p className="font-bold text-lg">{selectedRtv.vendors?.name}</p>
                      <p className="text-sm">{selectedRtv.vendors?.contact_person}</p>
                      <p className="text-sm">{selectedRtv.vendors?.phone}</p>
                      <p className="text-sm">{selectedRtv.vendors?.email}</p>
                    </div>

                    <Separator />

                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-medium">Return From</p>
                      <p className="font-medium">
                        {selectedRtv.stores?.name || selectedRtv.warehouses?.name}
                      </p>
                      <p className="text-sm">
                        {selectedRtv.stores?.address || selectedRtv.warehouses?.address}
                      </p>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Reason</p>
                        <p className="font-medium">{selectedRtv.reason}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Value</p>
                        <p className="font-medium">₹{selectedRtv.total_value.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-xs text-muted-foreground uppercase">Date</p>
                      <p className="font-medium">{format(new Date(selectedRtv.created_at), 'dd MMM yyyy')}</p>
                    </div>
                  </div>

                  <div className="text-center pt-4 border-t">
                    <div className="inline-block bg-muted px-4 py-2 rounded">
                      <p className="text-xs text-muted-foreground">Barcode Placeholder</p>
                      <p className="font-mono text-lg font-bold">{selectedRtv.rtv_number}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2 print:hidden">
                <Button variant="outline" className="flex-1" onClick={() => setIsLabelDialogOpen(false)}>
                  <X className="h-4 w-4 mr-2" /> Close
                </Button>
                <Button className="flex-1" onClick={printLabel}>
                  <Printer className="h-4 w-4 mr-2" /> Print Label
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
