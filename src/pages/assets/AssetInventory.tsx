import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Package, CheckCircle, AlertTriangle, XCircle, Loader2, Eye, Pencil } from "lucide-react";
import { useStoreAccess } from "@/hooks/useStoreAccess";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
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
  standard_price: number | null;
  warranty_months: number | null;
  default_vendor_id: string | null;
  default_oem_id: string | null;
  default_asset_status: string | null;
  default_service_engagement: string | null;
  warranty_start_date: string | null;
  warranty_end_date: string | null;
  default_purchase_date: string | null;
};

type Store = {
  id: string;
  name: string;
  address: string | null;
};


const conditionOptions = [
  { value: "under_warranty", label: "Under Warranty" },
  { value: "under_amc", label: "Under AMC" },
  { value: "need_based_support", label: "Need Based Support" },
  { value: "no_service_support", label: "No Service Support" },
];

const assetStatusOptions = [
  { value: "requisition_raised", label: "Requisition Raised" },
  { value: "procurement_planned", label: "Procurement Planned" },
  { value: "po_issued", label: "PO Issued" },
  { value: "product_received", label: "Product Received" },
  { value: "shipped_to_store", label: "Shipped to Store" },
  { value: "installation_fixed", label: "Installation Fixed" },
  { value: "installed", label: "Installed" },
  { value: "working", label: "Working" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "drop", label: "Drop" },
  { value: "orphaned", label: "Orphaned (No Master)" },
];

export default function AssetInventory() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [showOrphaned, setShowOrphaned] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [assetMasters, setAssetMasters] = useState<AssetMasterOption[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const { toast } = useToast();
  const { accessibleStoreIds, isAdmin, loading: accessLoading } = useStoreAccess();

  const form = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      assetMasterId: "",
      storeId: "",
      location: "",
      condition: "under_warranty",
      assetStatus: "requisition_raised",
      purchaseDate: "",
      value: 0,
      vendorId: "",
      oemId: "",
      warrantyStartDate: "",
      warrantyEndDate: "",
    },
  });

  useEffect(() => {
    if (!accessLoading) {
      fetchData();
    }
  }, [accessLoading, accessibleStoreIds]);

  const fetchData = async () => {
    const storeIds = Array.from(accessibleStoreIds);
    
    // Build assets query with store filter
    let assetsQuery = supabase
      .from("assets")
      .select("*, asset_masters(id, name, category_id, categories(name)), stores(id, name)")
      .order("created_at", { ascending: false });
    
    // Apply store filter for non-admins
    if (!isAdmin && storeIds.length > 0) {
      assetsQuery = assetsQuery.in("store_id", storeIds);
    }
    
    const [assetsRes, vendorsRes, assetMastersRes, storesRes] = await Promise.all([
      assetsQuery,
      supabase.from("vendors").select("id, name, vendor_type").order("name"),
      supabase
        .from("asset_masters")
        .select("id, name, category_id, categories(name), standard_price, warranty_months, default_vendor_id, default_oem_id, default_asset_status, default_service_engagement, warranty_start_date, warranty_end_date, default_purchase_date")
        .eq("status", "active")
        .order("name"),
      supabase.from("stores").select("id, name, address").eq("status", "active").order("name"),
    ]);

    if (assetsRes.error) {
      toast({ title: "Error", description: "Failed to load assets", variant: "destructive" });
    } else {
      setAssets(assetsRes.data || []);
    }

    setVendors(vendorsRes.data || []);
    setAssetMasters(assetMastersRes.data || []);
    // Filter stores for non-admins
    const allStores = storesRes.data || [];
    setStores(isAdmin ? allStores : allStores.filter(s => accessibleStoreIds.has(s.id)));
    
    setLoading(false);
  };

  // Show all vendors for OEM selection since Asset Master can assign any vendor as OEM
  const oemVendors = vendors;

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    form.reset({
      assetMasterId: asset.asset_master_id || "",
      storeId: asset.store_id || "",
      location: asset.location || "",
      condition: asset.condition || "under_warranty",
      assetStatus: asset.asset_status || "requisition_raised",
      purchaseDate: asset.purchase_date || "",
      value: asset.value || 0,
      vendorId: asset.vendor_id || "",
      oemId: asset.oem_id || "",
      warrantyStartDate: asset.warranty_start_date || "",
      warrantyEndDate: asset.warranty_end_date || "",
    });
    setOpen(true);
  };

  const handleDialogClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEditingAsset(null);
      form.reset();
    }
  };

  const onSubmit = async (data: AssetFormData) => {
    const selectedAssetMaster = assetMasters.find((am) => am.id === data.assetMasterId);

    if (editingAsset) {
      // Update existing asset
      const { error } = await supabase
        .from("assets")
        .update({
          name: selectedAssetMaster?.name || editingAsset.name,
          category: selectedAssetMaster?.categories?.name || editingAsset.category,
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
        })
        .eq("id", editingAsset.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update asset", variant: "destructive" });
      } else {
        // Track status change if applicable
        if (data.assetStatus !== editingAsset.asset_status) {
          await supabase.from("asset_status_history").insert({
            asset_id: editingAsset.id,
            status: data.assetStatus,
            changed_by: "System",
          });
        }
        
        toast({ title: "Asset updated", description: "Asset has been updated successfully." });
        form.reset();
        setEditingAsset(null);
        setOpen(false);
        fetchData();
      }
    } else {
      // Insert new asset
      const { data: insertedAsset, error } = await supabase.from("assets").insert({
        name: selectedAssetMaster?.name || "",
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
    }
  };

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // Filter by orphaned status
      if (!showOrphaned && asset.asset_status === "orphaned") {
        return false;
      }
      if (showOrphaned && asset.asset_status !== "orphaned") {
        return false;
      }
      
      // Search filter
      const matchesSearch = 
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (asset.asset_number && asset.asset_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (asset.stores?.name && asset.stores.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      return matchesSearch;
    });
  }, [assets, searchQuery, showOrphaned]);

  // Compute stats from actual asset data
  const stats = useMemo(() => {
    const totalAssets = assets.length;
    const underWarranty = assets.filter((a) => a.condition === "under_warranty").length;
    const underAMC = assets.filter((a) => a.condition === "under_amc").length;
    const nonOperational = assets.filter(
      (a) => a.asset_status === "withdrawn" || a.asset_status === "drop"
    ).length;

    return [
      { title: "Total Assets", value: totalAssets.toLocaleString(), icon: Package, iconColor: "bg-primary/10 text-primary" },
      { title: "Under Warranty", value: underWarranty.toLocaleString(), icon: CheckCircle, iconColor: "bg-success/10 text-success" },
      { title: "Under AMC", value: underAMC.toLocaleString(), icon: AlertTriangle, iconColor: "bg-warning/10 text-warning" },
      { title: "Non-Operational", value: nonOperational.toLocaleString(), icon: XCircle, iconColor: "bg-destructive/10 text-destructive" },
    ];
  }, [assets]);

  const getVendorName = (vendorId: string | null) => {
    if (!vendorId) return "-";
    const vendor = vendors.find((v) => v.id === vendorId);
    return vendor?.name || "-";
  };

  if (loading || accessLoading) {
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
        <Dialog open={open} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAsset ? "Edit Asset" : "Add New Asset"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="assetMasterId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Name (Master)</FormLabel>
                      <SearchableSelect
                        options={assetMasters.map((am) => ({
                          value: am.id,
                          label: am.name,
                          subtitle: am.categories?.name,
                        }))}
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Auto-populate fields from selected Asset Master
                          const selectedMaster = assetMasters.find((am) => am.id === value);
                          if (selectedMaster) {
                            // Set default value from standard_price
                            if (selectedMaster.standard_price !== null) {
                              form.setValue("value", selectedMaster.standard_price);
                            }
                            // Set default vendor
                            if (selectedMaster.default_vendor_id) {
                              form.setValue("vendorId", selectedMaster.default_vendor_id);
                            }
                            // Set default OEM
                            if (selectedMaster.default_oem_id) {
                              form.setValue("oemId", selectedMaster.default_oem_id);
                            }
                            // Set default asset status
                            if (selectedMaster.default_asset_status) {
                              form.setValue("assetStatus", selectedMaster.default_asset_status);
                            }
                            // Set default service engagement (condition)
                            if (selectedMaster.default_service_engagement) {
                              form.setValue("condition", selectedMaster.default_service_engagement);
                            }
                            // Set default purchase date
                            if (selectedMaster.default_purchase_date) {
                              form.setValue("purchaseDate", selectedMaster.default_purchase_date);
                            }
                            // Set warranty dates from master if available
                            if (selectedMaster.warranty_start_date) {
                              form.setValue("warrantyStartDate", selectedMaster.warranty_start_date);
                            }
                            if (selectedMaster.warranty_end_date) {
                              form.setValue("warrantyEndDate", selectedMaster.warranty_end_date);
                            }
                            // If no warranty dates but warranty_months exists, calculate from purchase date
                            if (!selectedMaster.warranty_start_date && !selectedMaster.warranty_end_date && selectedMaster.warranty_months) {
                              const purchaseDate = selectedMaster.default_purchase_date || form.getValues("purchaseDate");
                              if (purchaseDate) {
                                const startDate = new Date(purchaseDate);
                                form.setValue("warrantyStartDate", purchaseDate);
                                const endDate = new Date(startDate);
                                endDate.setMonth(endDate.getMonth() + selectedMaster.warranty_months);
                                form.setValue("warrantyEndDate", endDate.toISOString().split("T")[0]);
                              }
                            }
                          }
                        }}
                        placeholder="Select asset master"
                        searchPlaceholder="Search asset masters..."
                        emptyMessage="No asset masters found."
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="storeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store</FormLabel>
                        <SearchableSelect
                          options={stores.map((store) => ({
                            value: store.id,
                            label: store.name,
                          }))}
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Auto-populate address from selected store
                            const selectedStore = stores.find((s) => s.id === value);
                            form.setValue("location", selectedStore?.address || "");
                          }}
                          placeholder="Select store"
                          searchPlaceholder="Search stores..."
                          emptyMessage="No stores found."
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input
                        value={stores.find((s) => s.id === form.watch("storeId"))?.address || ""}
                        readOnly
                        disabled
                        placeholder="Select a store to auto-fill address"
                        className="bg-muted"
                      />
                    </FormControl>
                  </FormItem>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vendorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Procured From</FormLabel>
                        <SearchableSelect
                          options={vendors.map((vendor) => ({
                            value: vendor.id,
                            label: vendor.name,
                            subtitle: vendor.vendor_type,
                          }))}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Select vendor"
                          searchPlaceholder="Search vendors..."
                          emptyMessage="No vendors found."
                        />
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
                        <SearchableSelect
                          options={oemVendors.map((vendor) => ({
                            value: vendor.id,
                            label: vendor.name,
                          }))}
                          value={field.value || "none"}
                          onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                          placeholder={oemVendors.length === 0 ? "No OEM vendors" : "Select OEM"}
                          searchPlaceholder="Search OEM vendors..."
                          emptyMessage="No OEM vendors found."
                          disabled={oemVendors.length === 0}
                          allowNone
                          noneLabel="None"
                        />
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
                          <Input 
                            type="date" 
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              // Auto-calculate warranty dates based on Asset Master warranty_months
                              const selectedMasterId = form.getValues("assetMasterId");
                              const selectedMaster = assetMasters.find((am) => am.id === selectedMasterId);
                              if (selectedMaster?.warranty_months && e.target.value) {
                                form.setValue("warrantyStartDate", e.target.value);
                                const endDate = new Date(e.target.value);
                                endDate.setMonth(endDate.getMonth() + selectedMaster.warranty_months);
                                form.setValue("warrantyEndDate", endDate.toISOString().split("T")[0]);
                              }
                            }}
                          />
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
                  <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">{editingAsset ? "Save Changes" : "Add Asset"}</Button>
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
        <Button
          variant={showOrphaned ? "default" : "outline"}
          onClick={() => setShowOrphaned(!showOrphaned)}
          className="gap-2"
        >
          <AlertTriangle className="h-4 w-4" />
          {showOrphaned ? "Show Active Assets" : "Show Orphaned Assets"}
        </Button>
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
                        asset.condition === "under_warranty"
                          ? "default"
                          : asset.condition === "under_amc"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {conditionOptions.find((opt) => opt.value === asset.condition)?.label || asset.condition}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(asset);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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
                    </div>
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
