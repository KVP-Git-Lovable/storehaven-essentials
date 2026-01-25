import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Loader2, Edit, Trash2, ExternalLink } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  categories?: { name: string } | null;
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

export default function AssetMasterDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assetMaster, setAssetMaster] = useState<AssetMaster | null>(null);
  const [associatedVendors, setAssociatedVendors] = useState<AssociatedVendor[]>([]);
  const [associatedAssets, setAssociatedAssets] = useState<AssociatedAsset[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<AssociatedVendor | null>(null);
  const [deleteVendorId, setDeleteVendorId] = useState<string | null>(null);
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
    const [assetMasterRes, vendorsRes, assocVendorsRes, assocAssetsRes] = await Promise.all([
      supabase
        .from("asset_masters")
        .select("*, categories(name)")
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
    setLoading(false);
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/assets/master")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{assetMaster.name}</h1>
          <p className="text-muted-foreground">Asset Master Details</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Asset Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Category</p>
              <p className="font-medium">{assetMaster.categories?.name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Criticality</p>
              <Badge
                variant={
                  assetMaster.criticality === "high"
                    ? "destructive"
                    : assetMaster.criticality === "medium"
                    ? "default"
                    : "secondary"
                }
                className="mt-1"
              >
                {assetMaster.criticality}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Investment Size</p>
              <p className="font-medium capitalize">{assetMaster.investment_size}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={assetMaster.status === "active" ? "default" : "secondary"} className="mt-1">
                {assetMaster.status}
              </Badge>
            </div>
          </div>
          {assetMaster.description && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="mt-1">{assetMaster.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="vendors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vendors">Associated Vendors ({associatedVendors.length})</TabsTrigger>
          <TabsTrigger value="stores">Associated Stores ({associatedAssets.length})</TabsTrigger>
        </TabsList>

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
    </div>
  );
}
