import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Package, CheckCircle, AlertTriangle, XCircle, Loader2, Eye } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { assetSchema, type AssetFormData } from "@/lib/schemas";
import { supabase } from "@/integrations/supabase/client";

type Asset = {
  id: string;
  name: string;
  asset_number: string | null;
  category: string;
  category_id: string | null;
  location: string;
  condition: string;
  asset_status: string;
  purchase_date: string;
  value: number;
  vendor_id: string | null;
  oem_id: string | null;
  warranty_start_date: string | null;
  warranty_end_date: string | null;
  asset_master_id: string | null;
  store_id: string | null;
  asset_masters?: { id: string; name: string; category_id: string | null; categories?: { name: string } | null } | null;
  stores?: { id: string; name: string } | null;
};

type StatusHistory = {
  id: string;
  asset_id: string;
  status: string;
  changed_at: string;
  changed_by: string;
};

type Vendor = {
  id: string;
  name: string;
  vendor_type: string;
};

type AssetMasterOption = {
  id: string;
  name: string;
  category_id: string | null;
  categories?: { name: string } | null;
};

type Store = {
  id: string;
  name: string;
};

type Location = {
  id: string;
  name: string;
};

const conditionOptions = [
  { value: "under-warranty", label: "Under Warranty" },
  { value: "under-amc", label: "Under AMC" },
  { value: "need-based-support", label: "Need Based Support" },
  { value: "no-service-support", label: "No Service Support" },
];

const assetStatusOptions = [
  { value: "requisition-raised", label: "Requisition Raised" },
  { value: "procurement-planned", label: "Procurement Planned" },
  { value: "po-issued", label: "PO Issued" },
  { value: "product-received", label: "Product Received" },
  { value: "shipped-to-store", label: "Shipped to Store" },
  { value: "installation-fixed", label: "Installation Fixed" },
  { value: "installed", label: "Installed" },
  { value: "working", label: "Working" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "drop", label: "Drop" },
];

const stats = [
  { title: "Total Assets", value: "1,247", icon: Package, iconColor: "bg-primary/10 text-primary" },
  { title: "Under Warranty", value: "856", icon: CheckCircle, iconColor: "bg-success/10 text-success" },
  { title: "Under AMC", value: "374", icon: AlertTriangle, iconColor: "bg-warning/10 text-warning" },
  { title: "Non-Operational", value: "17", icon: XCircle, iconColor: "bg-destructive/10 text-destructive" },
];

export default function AssetInventory() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [assetMasters, setAssetMasters] = useState<AssetMasterOption[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      assetMasterId: "",
      assetNumber: "",
      storeId: "",
      location: "",
      condition: "under-warranty",
      assetStatus: "requisition-raised",
      purchaseDate: "",
      value: 0,
      vendorId: "",
      oemId: "",
      warrantyStartDate: "",
      warrantyEndDate: "",
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [assetsRes, vendorsRes, assetMastersRes, storesRes, locationsRes] = await Promise.all([
      supabase
        .from("assets")
        .select("*, asset_masters(id, name, category_id, categories(name)), stores(id, name)")
        .order("created_at", { ascending: false }),
      supabase.from("vendors").select("id, name, vendor_type").order("name"),
      supabase
        .from("asset_masters")
        .select("id, name, category_id, categories(name)")
        .eq("status", "active")
        .order("name"),
      supabase.from("stores").select("id, name").eq("status", "active").order("name"),
      supabase.from("locations").select("id, name").eq("status", "active").order("name"),
    ]);

    if (assetsRes.error) {
      toast({ title: "Error", description: "Failed to load assets", variant: "destructive" });
    } else {
      setAssets(assetsRes.data || []);
    }

    setVendors(vendorsRes.data || []);
    setAssetMasters(assetMastersRes.data || []);
    setStores(storesRes.data || []);
    setLocations(locationsRes.data || []);
    setLoading(false);
  };

  const oemVendors = vendors.filter((v) => v.vendor_type === "oem");

  const onSubmit = async (data: AssetFormData) => {
    const selectedAssetMaster = assetMasters.find((am) => am.id === data.assetMasterId);

    const { data: insertedAsset, error } = await supabase.from("assets").insert({
      name: selectedAssetMaster?.name || "",
      asset_number: data.assetNumber,
      category: selectedAssetMaster?.categories?.name || "",
      category_id: selectedAssetMaster?.category_id || null,
      asset_master_id: data.assetMasterId,
      store_id: data.storeId,
      location: data.location,
      condition: data.condition,
      asset_status: data.assetStatus,
      purchase_date: data.purchaseDate,
      value: data.value,
      vendor_id: data.vendorId,
      oem_id: data.oemId || null,
      warranty_start_date: data.warrantyStartDate || null,
      warranty_end_date: data.warrantyEndDate || null,
    }).select().single();

    if (error) {
      toast({ title: "Error", description: "Failed to add asset", variant: "destructive" });
    } else {
      // Insert initial status history record
      await supabase.from("asset_status_history").insert({
        asset_id: insertedAsset.id,
        status: data.assetStatus,
        changed_by: "System",
      });
      
      toast({ title: "Asset added", description: `Asset has been registered.` });
      form.reset();
      setOpen(false);
      fetchData();
    }
  };

  const filteredAssets = assets.filter(
    (asset) =>
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (asset.asset_number && asset.asset_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (asset.stores?.name && asset.stores.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getVendorName = (vendorId: string | null) => {
    if (!vendorId) return "-";
    const vendor = vendors.find((v) => v.id === vendorId);
    return vendor?.name || "-";
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
          <h1 className="text-2xl font-semibold">Asset Register</h1>
          <p className="text-muted-foreground">Track all assets across stores</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Asset</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="assetNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset #</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. AST-00001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="assetMasterId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset Name (Master)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select asset master" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {assetMasters.map((am) => (
                              <SelectItem key={am.id} value={am.id}>
                                {am.name}
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
                    name="storeId"
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
                            {stores.map((store) => (
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
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {locations.map((loc) => (
                              <SelectItem key={loc.id} value={loc.name}>
                                {loc.name}
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
                    name="vendorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Procured From</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {vendors.map((vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name}
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
                    name="oemId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OEM Name</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                          value={field.value || "none"}
                          disabled={oemVendors.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={oemVendors.length === 0 ? "No OEM vendors" : "Select OEM"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {oemVendors.map((vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name}
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
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Value (₹)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Enter value" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="warrantyStartDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warranty Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="warrantyEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warranty End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Engagement</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select service engagement" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {conditionOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
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
                    name="assetStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {assetStatusOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Asset</Button>
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

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset #</TableHead>
              <TableHead>Asset Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Service Engagement</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No assets found
                </TableCell>
              </TableRow>
            ) : (
              filteredAssets.map((asset) => (
                <TableRow
                  key={asset.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/assets/inventory/${asset.id}`)}
                >
                  <TableCell className="font-mono text-sm">{asset.asset_number || "-"}</TableCell>
                  <TableCell className="font-medium">{asset.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{asset.category}</Badge>
                  </TableCell>
                  <TableCell>{asset.stores?.name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {assetStatusOptions.find((opt) => opt.value === asset.asset_status)?.label || asset.asset_status || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell>{asset.location}</TableCell>
                  <TableCell>₹{asset.value.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        asset.condition === "under-warranty"
                          ? "default"
                          : asset.condition === "under-amc"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {conditionOptions.find((opt) => opt.value === asset.condition)?.label || asset.condition}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/assets/inventory/${asset.id}`);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
