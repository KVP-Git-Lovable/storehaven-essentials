import { useState, useEffect } from "react";
import { Plus, Search, Loader2, Edit, Trash2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AssetMasterFormDialog } from "@/components/assets/AssetMasterFormDialog";

type Category = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
};

type AssetMaster = {
  id: string;
  name: string;
  category_id: string | null;
  criticality: string;
  investment_size: string;
  description: string | null;
  brand?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  status: string;
  created_at: string;
  categories?: { id: string; name: string; type: string; parent_id: string | null } | null;
};

const criticalityOptions = [
  { value: "high", label: "High", color: "destructive" },
  { value: "medium", label: "Medium", color: "warning" },
  { value: "low", label: "Low", color: "secondary" },
];

export default function AssetMaster() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [assetMasters, setAssetMasters] = useState<AssetMaster[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetMaster | null>(null);
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [assetsRes, categoriesRes] = await Promise.all([
      supabase
        .from("asset_masters")
        .select("*, categories(id, name, type, parent_id)")
        .order("created_at", { ascending: false }),
      supabase
        .from("categories")
        .select("id, name, type, parent_id")
        .eq("status", "active"),
    ]);

    if (assetsRes.error) {
      toast({ title: "Error", description: "Failed to load asset masters", variant: "destructive" });
    } else {
      setAssetMasters(assetsRes.data || []);
    }

    if (!categoriesRes.error) {
      setAllCategories(categoriesRes.data || []);
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

  const handleEdit = (asset: AssetMaster) => {
    setEditingAsset(asset);
    setOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteAssetId) return;

    // First, get the count of affected assets for the confirmation message
    const { data: affectedAssets } = await supabase
      .from("assets")
      .select("id")
      .eq("asset_master_id", deleteAssetId);

    // Mark associated assets as orphaned before deleting
    if (affectedAssets && affectedAssets.length > 0) {
      const { error: updateError } = await supabase
        .from("assets")
        .update({ asset_status: "orphaned" })
        .eq("asset_master_id", deleteAssetId);

      if (updateError) {
        toast({ 
          title: "Error", 
          description: "Failed to handle associated assets", 
          variant: "destructive" 
        });
        return;
      }

      // Record status change history for affected assets
      await supabase.from("asset_status_history").insert(
        affectedAssets.map(a => ({
          asset_id: a.id,
          status: "orphaned",
          changed_by: "System (Asset Master Deleted)"
        }))
      );
    }

    // Then delete the asset master
    const { error } = await supabase.from("asset_masters").delete().eq("id", deleteAssetId);

    if (error) {
      toast({ title: "Error", description: "Failed to delete asset master", variant: "destructive" });
    } else {
      const affectedCount = affectedAssets?.length || 0;
      const message = affectedCount > 0 
        ? `Asset master deleted. ${affectedCount} associated asset(s) marked as orphaned.`
        : "Asset master deleted";
      toast({ title: "Success", description: message });
      fetchData();
    }
    setDeleteAssetId(null);
  };

  const filteredAssets = assetMasters.filter(
    (asset) =>
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.categories?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.model?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCriticalityBadge = (criticality: string) => {
    const opt = criticalityOptions.find((o) => o.value === criticality);
    return (
      <Badge variant={opt?.color as "destructive" | "secondary" | "outline" || "secondary"}>
        {opt?.label || criticality}
      </Badge>
    );
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Asset Master</h1>
          <p className="text-muted-foreground">Define asset types and their properties</p>
        </div>
        <Button className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Asset Master
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, brand, model..."
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
              <TableHead>Asset Name</TableHead>
              <TableHead>Brand / Model</TableHead>
              <TableHead>Category Path</TableHead>
              <TableHead>Criticality</TableHead>
              <TableHead>Investment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No asset masters found
                </TableCell>
              </TableRow>
            ) : (
              filteredAssets.map((asset) => {
                const categoryPath = getCategoryPath(asset.category_id);
                return (
                  <TableRow
                    key={asset.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/assets/master/${asset.id}`)}
                  >
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell>
                      {asset.brand || asset.model ? (
                        <span className="text-sm">
                          {asset.brand && <span>{asset.brand}</span>}
                          {asset.brand && asset.model && <span className="text-muted-foreground"> / </span>}
                          {asset.model && <span className="text-muted-foreground">{asset.model}</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {categoryPath.length > 0 ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          {categoryPath.map((cat, idx) => (
                            <span key={cat.id} className="flex items-center gap-1">
                              {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                              <Badge variant="outline" className="text-xs">
                                {cat.name}
                              </Badge>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getCriticalityBadge(asset.criticality)}</TableCell>
                    <TableCell className="capitalize">{asset.investment_size}</TableCell>
                    <TableCell>
                      <Badge variant={asset.status === "active" ? "default" : "secondary"}>
                        {asset.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(asset);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteAssetId(asset.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AssetMasterFormDialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) setEditingAsset(null);
        }}
        editingAsset={editingAsset}
        onSuccess={fetchData}
      />

      <AlertDialog open={!!deleteAssetId} onOpenChange={() => setDeleteAssetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset Master?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the asset master and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
