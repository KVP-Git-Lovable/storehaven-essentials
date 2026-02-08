import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Loader2, Edit, Trash2, ExternalLink, Upload, FileText, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AssetMasterFormDialog } from "@/components/assets/AssetMasterFormDialog";

const vendorAssocSchema = z.object({
  vendor_id: z.string().min(1, "Vendor is required"),
  category: z.string().max(100, "Category must be less than 100 characters").optional(),
  vendor_type: z.string().max(50, "Vendor type must be less than 50 characters").optional(),
  notes: z.string().max(500, "Notes must be less than 500 characters").optional(),
});

type VendorAssocFormData = z.infer<typeof vendorAssocSchema>;

type AssetMaster = {
  id: string;
  name: string;
  category_id: string | null;
  criticality: string;
  investment_size: string;
  description: string | null;
  status: string;
  brand?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  sku?: string | null;
  upc_barcode?: string | null;
  hsn_code?: string | null;
  unit_of_measure?: string | null;
  standard_price?: number | null;
  currency?: string | null;
  weight_kg?: number | null;
  dimensions_cm?: string | null;
  power_consumption_watts?: number | null;
  voltage_requirement?: string | null;
  temperature_range?: string | null;
  capacity?: string | null;
  refrigerant_type?: string | null;
  energy_rating?: string | null;
  warranty_months?: number | null;
  expected_lifespan_years?: number | null;
  maintenance_frequency?: string | null;
  certification_required?: boolean | null;
  certifications?: string[] | null;
  safety_requirements?: string | null;
  installation_requirements?: string | null;
  spare_parts_available?: boolean | null;
  lead_time_days?: number | null;
  min_order_quantity?: number | null;
  is_returnable?: boolean | null;
  disposal_instructions?: string | null;
  environment_impact?: string | null;
  image_url?: string | null;
  datasheet_url?: string | null;
  manual_url?: string | null;
  categories?: { id: string; name: string; type: string } | null;
};

type Category = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
};

type AssociatedVendor = {
  id: string;
  vendor_id: string;
  category: string | null;
  vendor_type: string | null;
  notes: string | null;
  vendors: { id: string; name: string; category: string; vendor_type: string } | null;
};

type AssociatedAsset = {
  id: string;
  asset_number: string | null;
  name: string;
  condition: string;
  location: string;
  value: number;
  store_id: string | null;
  stores?: { name: string } | null;
};

type Vendor = {
  id: string;
  name: string;
  category: string;
  vendor_type: string;
};

// Helper component for displaying field values
function DetailField({ label, value, type = "text" }: { label: string; value: React.ReactNode; type?: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium mt-0.5">
        {value !== null && value !== undefined && value !== "" ? (
          type === "url" && typeof value === "string" ? (
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
              View <ExternalLink className="h-3 w-3" />
            </a>
          ) : type === "boolean" ? (
            <Badge variant={value ? "default" : "secondary"}>{value ? "Yes" : "No"}</Badge>
          ) : type === "currency" ? (
            `₹${Number(value).toLocaleString()}`
          ) : (
            value
          )
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </p>
    </div>
  );
}

export default function AssetMasterDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assetMaster, setAssetMaster] = useState<AssetMaster | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [associatedVendors, setAssociatedVendors] = useState<AssociatedVendor[]>([]);
  const [associatedAssets, setAssociatedAssets] = useState<AssociatedAsset[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [customFieldValues, setCustomFieldValues] = useState<{field_label: string; value: string; field_type: string}[]>([]);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<AssociatedVendor | null>(null);
  const [deleteVendorId, setDeleteVendorId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteAssetOpen, setDeleteAssetOpen] = useState(false);
  const [brochureDialogOpen, setBrochureDialogOpen] = useState(false);
  const [brochureUploading, setBrochureUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const vendorForm = useForm<VendorAssocFormData>({
    resolver: zodResolver(vendorAssocSchema),
    defaultValues: {
      vendor_id: "",
      category: "",
      vendor_type: "",
      notes: "",
    },
  });

  const selectedVendorId = vendorForm.watch("vendor_id");

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  useEffect(() => {
    if (selectedVendorId && !editingVendor) {
      const vendor = vendors.find((v) => v.id === selectedVendorId);
      if (vendor) {
        vendorForm.setValue("category", vendor.category);
        vendorForm.setValue("vendor_type", vendor.vendor_type);
      }
    }
  }, [selectedVendorId, vendors, editingVendor]);

  const fetchData = async () => {
    const [assetMasterRes, vendorsRes, assocVendorsRes, assocAssetsRes, categoriesRes] = await Promise.all([
      supabase
        .from("asset_masters")
        .select("*, categories(id, name, type)")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("vendors").select("id, name, category, vendor_type").order("name"),
      supabase
        .from("asset_master_vendors")
        .select("*, vendors(id, name, category, vendor_type)")
        .eq("asset_master_id", id),
      supabase
        .from("assets")
        .select("id, asset_number, name, condition, location, value, store_id, stores(name)")
        .eq("asset_master_id", id),
      supabase
        .from("categories")
        .select("id, name, type, parent_id")
        .eq("status", "active"),
    ]);

    if (assetMasterRes.error || !assetMasterRes.data) {
      toast({ title: "Error", description: "Asset master not found", variant: "destructive" });
      navigate("/assets/master");
      return;
    }

    setAssetMaster(assetMasterRes.data);
    setVendors(vendorsRes.data || []);
    setAssociatedVendors(assocVendorsRes.data || []);
    setAssociatedAssets(assocAssetsRes.data || []);
    setAllCategories(categoriesRes.data || []);
    
    // Load custom field values
    if (assetMasterRes.data?.category_id) {
      const { data: customData } = await supabase
        .from("asset_master_custom_values")
        .select("value, field_id, asset_definition_fields(field_label, field_type)")
        .eq("asset_master_id", id as string);
      
      if (customData) {
        setCustomFieldValues(
          customData.map((row: any) => ({
            field_label: row.asset_definition_fields?.field_label || "Unknown",
            value: row.value || "-",
            field_type: row.asset_definition_fields?.field_type || "text",
          }))
        );
      }
    }
    
    setLoading(false);
  };

  // Build category path from leaf to root
  const getCategoryPath = (categoryId: string | null): Category[] => {
    if (!categoryId) return [];
    const path: Category[] = [];
    let current = allCategories.find((c) => c.id === categoryId);
    while (current) {
      path.unshift(current);
      current = allCategories.find((c) => c.id === current?.parent_id);
    }
    return path;
  };

  const onVendorSubmit = async (data: VendorAssocFormData) => {
    if (editingVendor) {
      const { error } = await supabase
        .from("asset_master_vendors")
        .update({
          vendor_id: data.vendor_id,
          category: data.category || null,
          vendor_type: data.vendor_type || null,
          notes: data.notes || null,
        })
        .eq("id", editingVendor.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update vendor association", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Vendor association updated" });
        handleCloseVendorDialog();
        fetchData();
      }
    } else {
      const { error } = await supabase.from("asset_master_vendors").insert({
        asset_master_id: id,
        vendor_id: data.vendor_id,
        category: data.category || null,
        vendor_type: data.vendor_type || null,
        notes: data.notes || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Error", description: "This vendor is already associated", variant: "destructive" });
        } else {
          toast({ title: "Error", description: "Failed to add vendor", variant: "destructive" });
        }
      } else {
        toast({ title: "Success", description: "Vendor added" });
        handleCloseVendorDialog();
        fetchData();
      }
    }
  };

  const handleCloseVendorDialog = () => {
    setVendorDialogOpen(false);
    setEditingVendor(null);
    vendorForm.reset();
  };

  const handleEditVendor = (assoc: AssociatedVendor) => {
    setEditingVendor(assoc);
    vendorForm.reset({
      vendor_id: assoc.vendor_id,
      category: assoc.category || "",
      vendor_type: assoc.vendor_type || "",
      notes: assoc.notes || "",
    });
    setVendorDialogOpen(true);
  };

  const handleDeleteVendor = async () => {
    if (!deleteVendorId) return;

    const { error } = await supabase.from("asset_master_vendors").delete().eq("id", deleteVendorId);

    if (error) {
      toast({ title: "Error", description: "Failed to remove vendor", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Vendor removed" });
      fetchData();
    }
    setDeleteVendorId(null);
  };

  const handleDeleteAssetMaster = async () => {
    if (!id) return;

    const { error } = await supabase.from("asset_masters").delete().eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete asset master", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Asset master deleted" });
      navigate("/assets/master");
    }
    setDeleteAssetOpen(false);
  };

  const handleBrochureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBrochureUploading(true);
    setBrochureDialogOpen(false);

    try {
      // For now, we'll show a message that AI parsing is coming soon
      // In a full implementation, this would use AI to parse the brochure
      toast({
        title: "Feature Coming Soon",
        description: "AI-powered brochure parsing will be available soon. For now, please fill the form manually.",
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to process brochure", variant: "destructive" });
    } finally {
      setBrochureUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assetMaster) {
    return null;
  }

  const categoryPath = getCategoryPath(assetMaster.category_id);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/assets/master")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{assetMaster.name}</h1>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground">Asset Master Details</p>
              {assetMaster.categories && (
                <Badge variant="outline">{assetMaster.categories.name}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setBrochureDialogOpen(true)}>
            <Upload className="h-4 w-4" />
            Upload Brochure
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setEditDialogOpen(true)}>
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive" className="gap-2" onClick={() => setDeleteAssetOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Main content tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Asset Details</TabsTrigger>
          <TabsTrigger value="custom-fields">Custom Fields ({customFieldValues.length})</TabsTrigger>
          <TabsTrigger value="vendors">Associated Vendors ({associatedVendors.length})</TabsTrigger>
          <TabsTrigger value="stores">Associated Stores ({associatedAssets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <DetailField label="Asset Name" value={assetMaster.name} />
                <DetailField label="Brand" value={assetMaster.brand} />
                <DetailField label="Model" value={assetMaster.model} />
                <DetailField label="Manufacturer" value={assetMaster.manufacturer} />
                <div className="col-span-2 md:col-span-4">
                  <p className="text-sm text-muted-foreground">Category Path</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {categoryPath.length > 0 ? (
                      categoryPath.map((cat, idx) => (
                        <span key={cat.id} className="flex items-center gap-2">
                          {idx > 0 && <span className="text-muted-foreground">/</span>}
                          <Badge variant="outline">{cat.name}</Badge>
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                </div>
                <div className="col-span-2 md:col-span-4">
                  <DetailField label="Description" value={assetMaster.description} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Identifiers & Classification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Identifiers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <DetailField label="SKU" value={assetMaster.sku} />
                  <DetailField label="UPC/Barcode" value={assetMaster.upc_barcode} />
                  <DetailField label="HSN Code" value={assetMaster.hsn_code} />
                  <DetailField label="Status" value={
                    <Badge variant={assetMaster.status === "active" ? "default" : "secondary"}>
                      {assetMaster.status}
                    </Badge>
                  } />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Classification & Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <DetailField label="Criticality" value={
                    <Badge variant={assetMaster.criticality === "high" ? "destructive" : assetMaster.criticality === "medium" ? "default" : "secondary"}>
                      {assetMaster.criticality}
                    </Badge>
                  } />
                  <DetailField label="Investment Size" value={assetMaster.investment_size} />
                  <DetailField label="Standard Price" value={assetMaster.standard_price} type="currency" />
                  <DetailField label="Unit of Measure" value={assetMaster.unit_of_measure} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Technical Specifications */}
          <Card>
            <CardHeader>
              <CardTitle>Technical Specifications</CardTitle>
              <CardDescription>Power, temperature, and physical specifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <DetailField label="Power Consumption" value={assetMaster.power_consumption_watts ? `${assetMaster.power_consumption_watts}W` : null} />
                <DetailField label="Voltage Requirement" value={assetMaster.voltage_requirement} />
                <DetailField label="Temperature Range" value={assetMaster.temperature_range} />
                <DetailField label="Capacity" value={assetMaster.capacity} />
                <DetailField label="Refrigerant Type" value={assetMaster.refrigerant_type} />
                <DetailField label="Energy Rating" value={assetMaster.energy_rating} />
                <DetailField label="Weight" value={assetMaster.weight_kg ? `${assetMaster.weight_kg} kg` : null} />
                <DetailField label="Dimensions (cm)" value={assetMaster.dimensions_cm} />
              </div>
            </CardContent>
          </Card>

          {/* Lifecycle & Procurement */}
          <Card>
            <CardHeader>
              <CardTitle>Lifecycle & Procurement</CardTitle>
              <CardDescription>Warranty, lifespan, and ordering information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <DetailField label="Warranty Period" value={assetMaster.warranty_months ? `${assetMaster.warranty_months} months` : null} />
                <DetailField label="Expected Lifespan" value={assetMaster.expected_lifespan_years ? `${assetMaster.expected_lifespan_years} years` : null} />
                <DetailField label="Maintenance Frequency" value={assetMaster.maintenance_frequency} />
                <DetailField label="Lead Time" value={assetMaster.lead_time_days ? `${assetMaster.lead_time_days} days` : null} />
                <DetailField label="Min Order Quantity" value={assetMaster.min_order_quantity} />
                <DetailField label="Spare Parts Available" value={assetMaster.spare_parts_available} type="boolean" />
                <DetailField label="Is Returnable" value={assetMaster.is_returnable} type="boolean" />
                <DetailField label="Environment Impact" value={assetMaster.environment_impact} />
              </div>
            </CardContent>
          </Card>

          {/* Compliance & Safety */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance & Safety</CardTitle>
              <CardDescription>Certification and safety requirements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <DetailField label="Certification Required" value={assetMaster.certification_required} type="boolean" />
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">Certifications</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {assetMaster.certifications && assetMaster.certifications.length > 0 ? (
                        assetMaster.certifications.map((cert, idx) => (
                          <Badge key={idx} variant="outline">{cert}</Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <DetailField label="Safety Requirements" value={assetMaster.safety_requirements} />
                  <DetailField label="Installation Requirements" value={assetMaster.installation_requirements} />
                  <DetailField label="Disposal Instructions" value={assetMaster.disposal_instructions} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Documents & Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DetailField label="Product Image" value={assetMaster.image_url} type="url" />
                <DetailField label="Datasheet" value={assetMaster.datasheet_url} type="url" />
                <DetailField label="User Manual" value={assetMaster.manual_url} type="url" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom-fields">
          <Card>
            <CardHeader>
              <CardTitle>Custom Fields</CardTitle>
              <CardDescription>Fields defined via the Asset Definition Master for this category</CardDescription>
            </CardHeader>
            <CardContent>
              {customFieldValues.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">No custom fields configured for this category.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {customFieldValues.map((cf, idx) => (
                    <DetailField
                      key={idx}
                      label={cf.field_label}
                      value={cf.field_type === "boolean" ? (cf.value === "true" ? "Yes" : "No") : cf.value}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendors">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Associated Vendors</CardTitle>
                <CardDescription>Vendors linked to this asset type</CardDescription>
              </div>
              <Dialog open={vendorDialogOpen} onOpenChange={(isOpen) => {
                if (!isOpen) handleCloseVendorDialog();
                else setVendorDialogOpen(true);
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Vendor
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>{editingVendor ? "Edit Vendor Association" : "Add Associated Vendor"}</DialogTitle>
                  </DialogHeader>
                  <Form {...vendorForm}>
                    <form onSubmit={vendorForm.handleSubmit(onVendorSubmit)} className="space-y-4">
                      <FormField
                        control={vendorForm.control}
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
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={vendorForm.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <FormControl>
                                <Input placeholder="Vendor category" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={vendorForm.control}
                          name="vendor_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Vendor Type</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. OEM, Supplier" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={vendorForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Additional notes..."
                                className="resize-none"
                                rows={3}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={handleCloseVendorDialog}>
                          Cancel
                        </Button>
                        <Button type="submit">{editingVendor ? "Update" : "Add"} Vendor</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Vendor Type</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {associatedVendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No vendors associated
                      </TableCell>
                    </TableRow>
                  ) : (
                    associatedVendors.map((assoc) => (
                      <TableRow key={assoc.id}>
                        <TableCell className="font-medium">{assoc.vendors?.name || "-"}</TableCell>
                        <TableCell>{assoc.category || assoc.vendors?.category || "-"}</TableCell>
                        <TableCell>{assoc.vendor_type || assoc.vendors?.vendor_type || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{assoc.notes || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditVendor(assoc)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteVendorId(assoc.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stores">
          <Card>
            <CardHeader>
              <CardTitle>Associated Stores</CardTitle>
              <CardDescription>Assets of this type deployed to stores</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset #</TableHead>
                    <TableHead>Asset Name</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {associatedAssets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No assets linked to this master
                      </TableCell>
                    </TableRow>
                  ) : (
                    associatedAssets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-mono text-sm">
                          <Button
                            variant="link"
                            className="p-0 h-auto font-mono"
                            onClick={() => navigate(`/assets/inventory/${asset.id}`)}
                          >
                            {asset.asset_number || "-"}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{asset.name}</TableCell>
                        <TableCell>{asset.stores?.name || "-"}</TableCell>
                        <TableCell>{asset.location}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{asset.condition}</Badge>
                        </TableCell>
                        <TableCell>₹{asset.value.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => navigate(`/assets/inventory/${asset.id}`)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Asset Master Dialog */}
      <AssetMasterFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editingAsset={assetMaster}
        onSuccess={fetchData}
      />

      {/* Delete Asset Master Confirmation */}
      <AlertDialog open={deleteAssetOpen} onOpenChange={setDeleteAssetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset Master?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete "{assetMaster.name}" and all associated vendor links.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAssetMaster} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Vendor Association Confirmation */}
      <AlertDialog open={!!deleteVendorId} onOpenChange={() => setDeleteVendorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Vendor Association?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the vendor from this asset master.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVendor} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Brochure Upload Dialog */}
      <Dialog open={brochureDialogOpen} onOpenChange={setBrochureDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Upload Technical Brochure
            </DialogTitle>
            <DialogDescription>
              Upload a PDF brochure or datasheet to auto-populate asset fields using AI extraction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop your brochure here, or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleBrochureUpload}
                className="hidden"
                id="brochure-upload"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={brochureUploading}
              >
                {brochureUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Select File
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Supported formats: PDF, DOC, DOCX (Max 10MB)
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
