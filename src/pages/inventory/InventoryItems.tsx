import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Search, Package, Barcode, AlertTriangle, Camera, CalendarIcon, Eye, Edit, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
  FormDescription,
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
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const itemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  unit: z.string().min(1, "Unit is required"),
  unit_cost: z.coerce.number().min(0, "Must be positive"),
  selling_price: z.coerce.number().min(0, "Must be positive"),
  min_stock: z.coerce.number().min(0),
  max_stock: z.coerce.number().min(0).optional(),
  expiry_tracking: z.boolean().optional(),
  status: z.string().min(1),
  asset_master_id: z.string().optional(),
  vendor_id: z.string().optional(),
  rate_validity_type: z.enum(["date", "days", "none"]),
  rate_validity_date: z.date().optional().nullable(),
  rate_validity_days: z.coerce.number().min(1).optional().nullable(),
});

type ItemFormData = z.infer<typeof itemSchema>;

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string;
  unit: string;
  unit_cost: number;
  selling_price: number;
  min_stock: number;
  max_stock: number | null;
  expiry_tracking: boolean;
  status: string;
  created_at: string;
  asset_master_id: string | null;
  vendor_id: string | null;
  rate_validity_date: string | null;
  rate_validity_days: number | null;
}

interface AssetMaster {
  id: string;
  name: string;
  category_id: string | null;
}

interface Vendor {
  id: string;
  name: string;
  category: string;
}

export default function InventoryItems() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [assetMasters, setAssetMasters] = useState<AssetMaster[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const defaultFormValues = {
    name: "",
    sku: "",
    barcode: "",
    category: "",
    unit: "pcs",
    unit_cost: 0,
    selling_price: 0,
    min_stock: 5,
    max_stock: 100,
    expiry_tracking: false,
    status: "active",
    asset_master_id: "",
    vendor_id: "",
    rate_validity_type: "none" as const,
    rate_validity_date: null,
    rate_validity_days: null,
  };

  const form = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: defaultFormValues,
  });

  const rateValidityType = form.watch("rate_validity_type");

  useEffect(() => {
    fetchItems();
    fetchAssetMasters();
    fetchVendors();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error fetching items:", error);
      toast.error("Failed to fetch inventory items");
    } finally {
      setLoading(false);
    }
  };

  const fetchAssetMasters = async () => {
    try {
      const { data, error } = await supabase
        .from("asset_masters")
        .select("id, name, category_id")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      setAssetMasters(data || []);
    } catch (error) {
      console.error("Error fetching asset masters:", error);
    }
  };

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, category")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error("Error fetching vendors:", error);
    }
  };

  const onSubmit = async (data: ItemFormData) => {
    try {
      const payload = {
        name: data.name,
        sku: data.sku || null,
        barcode: data.barcode || null,
        category: data.category,
        unit: data.unit,
        unit_cost: data.unit_cost,
        selling_price: data.selling_price,
        min_stock: data.min_stock,
        max_stock: data.max_stock || null,
        expiry_tracking: data.expiry_tracking || false,
        status: data.status,
        asset_master_id: data.asset_master_id || null,
        vendor_id: data.vendor_id || null,
        rate_validity_date: data.rate_validity_type === "date" && data.rate_validity_date 
          ? format(data.rate_validity_date, "yyyy-MM-dd") 
          : null,
        rate_validity_days: data.rate_validity_type === "days" ? data.rate_validity_days : null,
      };

      if (editingItem) {
        const { error } = await supabase.from("inventory_items").update(payload).eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Item updated successfully");
      } else {
        const { error } = await supabase.from("inventory_items").insert([payload]);
        if (error) throw error;
        toast.success("Item added successfully");
      }
      
      form.reset(defaultFormValues);
      setIsDialogOpen(false);
      setEditingItem(null);
      fetchItems();
    } catch (error: any) {
      console.error("Error saving item:", error);
      if (error.code === '23505') {
        toast.error("SKU or Barcode already exists");
      } else {
        toast.error("Failed to save item");
      }
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    form.reset({
      name: item.name,
      sku: item.sku || "",
      barcode: item.barcode || "",
      category: item.category,
      unit: item.unit,
      unit_cost: item.unit_cost,
      selling_price: item.selling_price,
      min_stock: item.min_stock,
      max_stock: item.max_stock || 100,
      expiry_tracking: item.expiry_tracking,
      status: item.status,
      asset_master_id: item.asset_master_id || "",
      vendor_id: item.vendor_id || "",
      rate_validity_type: item.rate_validity_date ? "date" : item.rate_validity_days ? "days" : "none",
      rate_validity_date: item.rate_validity_date ? new Date(item.rate_validity_date) : null,
      rate_validity_days: item.rate_validity_days,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
      toast.success("Item deleted successfully");
      fetchItems();
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Failed to delete item");
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = ["Electronics", "Consumables", "Fixtures", "Displays", "Office Supplies", "Cleaning", "Packaging"];
  const units = ["pcs", "kg", "ltr", "box", "pack", "set", "meter", "roll"];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory Items</h1>
          <p className="text-muted-foreground">Master list of all inventory items with barcode support</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingItem(null);
            form.reset(defaultFormValues);
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Inventory Item" : "Add Inventory Item"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Product name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU</FormLabel>
                        <FormControl>
                          <Input placeholder="SKU-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="barcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Barcode/UPC</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input placeholder="8901234567890" {...field} />
                            <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {units.map(unit => (
                              <SelectItem key={unit} value={unit}>{unit}</SelectItem>
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
                    name="unit_cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Cost (₹)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="selling_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Selling Price (₹)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="min_stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Stock Level</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="max_stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Stock Level</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Asset Master Lookup */}
                <FormField
                  control={form.control}
                  name="asset_master_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Master (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Link to asset master..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">-- None --</SelectItem>
                          {assetMasters.map(am => (
                            <SelectItem key={am.id} value={am.id}>{am.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Link this item to an asset master for spares tracking</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Vendor Lookup */}
                <FormField
                  control={form.control}
                  name="vendor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vendor..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">-- None --</SelectItem>
                          {vendors.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Rate Validity */}
                <div className="space-y-3 rounded-lg border p-3">
                  <FormField
                    control={form.control}
                    name="rate_validity_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rate Validity</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No Validity Tracking</SelectItem>
                            <SelectItem value="date">Valid Until Date</SelectItem>
                            <SelectItem value="days">Valid for Days</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {rateValidityType === "date" && (
                    <FormField
                      control={form.control}
                      name="rate_validity_date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Valid Until</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? format(field.value, "PPP") : "Pick a date"}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value || undefined}
                                onSelect={field.onChange}
                                disabled={(date) => date < new Date()}
                                initialFocus
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {rateValidityType === "days" && (
                    <FormField
                      control={form.control}
                      name="rate_validity_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Validity Period (Days)</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} placeholder="e.g., 30" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="expiry_tracking"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel>Expiry Tracking</FormLabel>
                        <p className="text-sm text-muted-foreground">Enable for perishable items</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="discontinued">Discontinued</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">Add Item</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Barcode</CardTitle>
            <Barcode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {items.filter(i => i.barcode).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiry Tracked</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {items.filter(i => i.expiry_tracking).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {items.filter(i => i.status === 'active').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, SKU, or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={() => setScanMode(!scanMode)}>
          <Camera className="mr-2 h-4 w-4" />
          {scanMode ? "Stop Scan" : "Scan Barcode"}
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>SKU / Barcode</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Selling Price</TableHead>
                <TableHead>Stock Levels</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No items found. Add your first inventory item.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow 
                    key={item.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setViewItem(item)}
                  >
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground">{item.unit}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{item.sku || '-'}</div>
                      {item.barcode && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Barcode className="h-3 w-3" /> {item.barcode}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell>₹{item.unit_cost.toLocaleString()}</TableCell>
                    <TableCell>₹{item.selling_price.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="text-sm">Min: {item.min_stock}</div>
                      <div className="text-xs text-muted-foreground">Max: {item.max_stock || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewItem(item)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Item?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{item.name}". This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(item.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Item Sheet */}
      <Sheet open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Item Details</SheetTitle>
          </SheetHeader>
          {viewItem && (
            <div className="space-y-6 py-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold">{viewItem.name}</h3>
                  <Badge variant={viewItem.status === 'active' ? 'default' : 'secondary'} className="mt-2">
                    {viewItem.status}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setViewItem(null); handleEdit(viewItem); }}>
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">SKU</p>
                  <p className="font-medium">{viewItem.sku || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Barcode</p>
                  <p className="font-medium font-mono">{viewItem.barcode || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium">{viewItem.category}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Unit</p>
                  <p className="font-medium">{viewItem.unit}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Pricing</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Unit Cost</p>
                    <p className="text-lg font-semibold">₹{viewItem.unit_cost.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Selling Price</p>
                    <p className="text-lg font-semibold">₹{viewItem.selling_price.toLocaleString()}</p>
                  </div>
                </div>
                {viewItem.selling_price > 0 && viewItem.unit_cost > 0 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Margin: {(((viewItem.selling_price - viewItem.unit_cost) / viewItem.unit_cost) * 100).toFixed(1)}%
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Stock Levels</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Minimum Stock</p>
                    <p className="font-medium">{viewItem.min_stock} {viewItem.unit}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Maximum Stock</p>
                    <p className="font-medium">{viewItem.max_stock || 'Not set'} {viewItem.max_stock ? viewItem.unit : ''}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Tracking</h4>
                <div className="flex items-center gap-2">
                  <Badge variant={viewItem.expiry_tracking ? 'default' : 'secondary'}>
                    {viewItem.expiry_tracking ? 'Expiry Tracked' : 'No Expiry Tracking'}
                  </Badge>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  Created on {format(new Date(viewItem.created_at), 'PPP')}
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
