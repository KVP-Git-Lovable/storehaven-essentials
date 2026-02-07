import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Package, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface NSOStoreAssetsSectionProps {
  checklistId: string;
  onAssetChange?: () => void;
}

interface StoreAsset {
  id: string;
  checklist_id: string;
  asset_master_id: string;
  quantity: number;
  notes: string | null;
  sort_order: number;
  is_custom: boolean;
  status: string;
  vendor_id: string | null;
  asset_masters?: {
    id: string;
    name: string;
    standard_price: number | null;
    criticality: string;
    categories?: { name: string } | null;
  };
}

interface AssetMaster {
  id: string;
  name: string;
  standard_price: number | null;
  criticality: string;
  category_id: string | null;
  categories?: { name: string } | null;
}

interface Vendor {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", color: "bg-muted text-muted-foreground" },
  { value: "available", label: "Available", color: "bg-yellow-100 text-yellow-800" },
  { value: "ordered", label: "Ordered", color: "bg-blue-100 text-blue-800" },
  { value: "delivered", label: "Delivered", color: "bg-purple-100 text-purple-800" },
  { value: "deployed", label: "Deployed", color: "bg-green-100 text-green-800" },
];

export function NSOStoreAssetsSection({
  checklistId,
  onAssetChange,
}: NSOStoreAssetsSectionProps) {
  const queryClient = useQueryClient();
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editingQuantity, setEditingQuantity] = useState<number>(1);
  const [newAsset, setNewAsset] = useState({
    asset_master_id: "",
    quantity: 1,
    vendor_id: "",
  });

  // Fetch store assets
  const { data: storeAssets = [], isLoading } = useQuery({
    queryKey: ["nso-store-assets", checklistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nso_store_assets")
        .select(`
          *,
          asset_masters(
            id,
            name,
            standard_price,
            criticality,
            categories(name)
          )
        `)
        .eq("checklist_id", checklistId)
        .order("sort_order");
      if (error) throw error;
      return data as StoreAsset[];
    },
  });

  // Fetch available asset masters for the dropdown
  const { data: assetMasters = [] } = useQuery({
    queryKey: ["asset-masters-for-nso"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_masters")
        .select(`
          id,
          name,
          standard_price,
          criticality,
          category_id,
          categories(name)
        `)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as AssetMaster[];
    },
  });

  // Fetch vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id, name").order("name");
      if (error) throw error;
      return data as Vendor[];
    },
  });

  // Add asset mutation
  const addAssetMutation = useMutation({
    mutationFn: async (data: typeof newAsset) => {
      const maxOrder = storeAssets.length > 0
        ? Math.max(...storeAssets.map((a) => a.sort_order)) + 1
        : 0;
      const { error } = await supabase.from("nso_store_assets").insert({
        checklist_id: checklistId,
        asset_master_id: data.asset_master_id,
        quantity: data.quantity,
        sort_order: maxOrder,
        is_custom: true,
        status: "pending",
        vendor_id: data.vendor_id && data.vendor_id !== "none" ? data.vendor_id : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-assets", checklistId] });
      queryClient.invalidateQueries({ queryKey: ["nso-store-assets-with-values", checklistId] });
      toast.success("Asset added");
      setNewAsset({ asset_master_id: "", quantity: 1, vendor_id: "" });
      setIsAddingAsset(false);
      onAssetChange?.();
    },
    onError: () => toast.error("Failed to add asset"),
  });

  // Update asset mutation
  const updateAssetMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<StoreAsset> }) => {
      const { error } = await supabase
        .from("nso_store_assets")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-assets", checklistId] });
      queryClient.invalidateQueries({ queryKey: ["nso-store-assets-with-values", checklistId] });
      setEditingAssetId(null);
      onAssetChange?.();
    },
    onError: () => toast.error("Failed to update asset"),
  });

  // Delete asset mutation
  const deleteAssetMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("nso_store_assets")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-assets", checklistId] });
      queryClient.invalidateQueries({ queryKey: ["nso-store-assets-with-values", checklistId] });
      toast.success("Asset removed");
      onAssetChange?.();
    },
    onError: () => toast.error("Failed to remove asset"),
  });

  // Calculate total cost
  const totalAssetCost = storeAssets.reduce((sum, asset) => {
    const price = asset.asset_masters?.standard_price || 0;
    return sum + price * asset.quantity;
  }, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleEditQuantity = (asset: StoreAsset) => {
    setEditingAssetId(asset.id);
    setEditingQuantity(asset.quantity);
  };

  const handleSaveQuantity = (id: string) => {
    updateAssetMutation.mutate({ id, updates: { quantity: editingQuantity } });
  };

  const handleStatusChange = (id: string, status: string) => {
    updateAssetMutation.mutate({ id, updates: { status } });
  };

  // Get already added asset IDs for filtering the dropdown
  const existingAssetIds = new Set(storeAssets.map((a) => a.asset_master_id));
  const availableAssetMasters = assetMasters.filter((am) => !existingAssetIds.has(am.id));

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Required Assets</h3>
          <Badge variant="secondary" className="ml-2">
            {storeAssets.length} item{storeAssets.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        {!isAddingAsset && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddingAsset(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
          </Button>
        )}
      </div>

      {/* Add Asset Form */}
      {isAddingAsset && (
        <Card className="border-dashed">
          <CardContent className="pt-4">
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">Asset</Label>
                <SearchableSelect
                  options={availableAssetMasters.map((am) => ({
                    value: am.id,
                    label: am.name,
                    subtitle: am.categories?.name || "Uncategorized",
                  }))}
                  value={newAsset.asset_master_id}
                  onValueChange={(v) =>
                    setNewAsset((prev) => ({ ...prev, asset_master_id: v }))
                  }
                  placeholder="Select asset..."
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <Label className="text-xs">Vendor</Label>
                <SearchableSelect
                  options={vendors.map((v) => ({ value: v.id, label: v.name }))}
                  value={newAsset.vendor_id}
                  onValueChange={(v) =>
                    setNewAsset((prev) => ({ ...prev, vendor_id: v }))
                  }
                  placeholder="Select vendor..."
                  allowNone
                  noneLabel="No Vendor"
                />
              </div>
              <div className="w-24">
                <Label className="text-xs">Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={newAsset.quantity}
                  onChange={(e) =>
                    setNewAsset((prev) => ({
                      ...prev,
                      quantity: parseInt(e.target.value) || 1,
                    }))
                  }
                />
              </div>
              <Button
                size="sm"
                onClick={() => addAssetMutation.mutate(newAsset)}
                disabled={!newAsset.asset_master_id || addAssetMutation.isPending}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAddingAsset(false);
                  setNewAsset({ asset_master_id: "", quantity: 1, vendor_id: "" });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assets Table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading assets...
        </div>
      ) : storeAssets.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No required assets yet</p>
            <p className="text-sm mt-1">
              Add assets that are needed for this store opening
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-center w-24">Qty</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storeAssets.map((asset) => {
                  const price = asset.asset_masters?.standard_price || 0;
                  const total = price * asset.quantity;
                  const isEditing = editingAssetId === asset.id;

                  return (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {asset.asset_masters?.name || "Unknown Asset"}
                          </span>
                          {asset.is_custom && (
                            <Badge variant="outline" className="w-fit text-xs mt-1">
                              Custom
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {asset.asset_masters?.categories?.name || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <SearchableSelect
                          options={vendors.map((v) => ({ value: v.id, label: v.name }))}
                          value={asset.vendor_id || "none"}
                          onValueChange={(v) =>
                            updateAssetMutation.mutate({
                              id: asset.id,
                              updates: { vendor_id: v === "none" ? null : v },
                            })
                          }
                          placeholder="Select vendor"
                          allowNone
                          noneLabel="No Vendor"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(price)}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-center">
                            <Input
                              type="number"
                              min={1}
                              value={editingQuantity}
                              onChange={(e) =>
                                setEditingQuantity(parseInt(e.target.value) || 1)
                              }
                              className="w-16 h-8 text-center"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleSaveQuantity(asset.id)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setEditingAssetId(null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 justify-center">
                            <span>{asset.quantity}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-50 hover:opacity-100"
                              onClick={() => handleEditQuantity(asset)}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(total)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={asset.status}
                          onValueChange={(v) => handleStatusChange(asset.id, v)}
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteAssetMutation.mutate(asset.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* Total Row */}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={5}>Total Asset Cost</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(totalAssetCost)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Assets
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-3">
            <p className="text-2xl font-bold">{storeAssets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Quantity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-3">
            <p className="text-2xl font-bold">
              {storeAssets.reduce((sum, a) => sum + a.quantity, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-3">
            <p className="text-2xl font-bold">{formatCurrency(totalAssetCost)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Delivery Status Summary */}
      {storeAssets.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {STATUS_OPTIONS.map((status) => {
            const count = storeAssets.filter((a) => a.status === status.value).length;
            return (
              <Badge
                key={status.value}
                variant="outline"
                className={cn("text-xs", status.color)}
              >
                {status.label}: {count}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
