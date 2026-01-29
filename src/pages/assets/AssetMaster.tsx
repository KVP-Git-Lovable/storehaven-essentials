import { useState, useEffect } from "react";
import { Plus, Search, Loader2, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { HierarchicalCategorySelector } from "@/components/assets/HierarchicalCategorySelector";

const assetMasterSchema = z.object({
  name: z.string().trim().min(1, "Asset name is required").max(100, "Name must be less than 100 characters"),
  category_id: z.string().min(1, "Category is required"),
  criticality: z.enum(["high", "medium", "low"]),
  investment_size: z.enum(["high", "medium", "low"]),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
});

type AssetMasterFormData = z.infer<typeof assetMasterSchema>;

type AssetMaster = {
  id: string;
  name: string;
  category_id: string | null;
  criticality: string;
  investment_size: string;
  description: string | null;
  status: string;
  created_at: string;
  categories?: { name: string; type: string } | null;
};

const criticalityOptions = [
  { value: "high", label: "High", color: "destructive" },
  { value: "medium", label: "Medium", color: "warning" },
  { value: "low", label: "Low", color: "secondary" },
];

const investmentOptions = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default function AssetMaster() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [assetMasters, setAssetMasters] = useState<AssetMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetMaster | null>(null);
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<AssetMasterFormData>({
    resolver: zodResolver(assetMasterSchema),
    defaultValues: {
      name: "",
      category_id: "",
      criticality: "medium",
      investment_size: "medium",
      description: "",
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("asset_masters")
      .select("*, categories(name, type)")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to load asset masters", variant: "destructive" });
    } else {
      setAssetMasters(data || []);
    }
    setLoading(false);
  };

  const onSubmit = async (data: AssetMasterFormData) => {
    if (editingAsset) {
      const { error } = await supabase
        .from("asset_masters")
        .update({
          name: data.name,
          category_id: data.category_id,
          criticality: data.criticality,
          investment_size: data.investment_size,
          description: data.description || null,
        })
        .eq("id", editingAsset.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update asset master", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Asset master updated" });
        handleCloseDialog();
        fetchData();
      }
    } else {
      const { error } = await supabase.from("asset_masters").insert({
        name: data.name,
        category_id: data.category_id,
        criticality: data.criticality,
        investment_size: data.investment_size,
        description: data.description || null,
      });

      if (error) {
        toast({ title: "Error", description: "Failed to add asset master", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Asset master added" });
        handleCloseDialog();
        fetchData();
      }
    }
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingAsset(null);
    form.reset();
  };

  const handleEdit = (asset: AssetMaster) => {
    setEditingAsset(asset);
    form.reset({
      name: asset.name,
      category_id: asset.category_id || "",
      criticality: asset.criticality as "high" | "medium" | "low",
      investment_size: asset.investment_size as "high" | "medium" | "low",
      description: asset.description || "",
    });
    setOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteAssetId) return;

    const { error } = await supabase.from("asset_masters").delete().eq("id", deleteAssetId);

    if (error) {
      toast({ title: "Error", description: "Failed to delete asset master", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Asset master deleted" });
      fetchData();
    }
    setDeleteAssetId(null);
  };

  const filteredAssets = assetMasters.filter(
    (asset) =>
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.categories?.name?.toLowerCase().includes(searchQuery.toLowerCase())
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Asset Master</h1>
          <p className="text-muted-foreground">Define asset types and their properties</p>
        </div>
        <Dialog open={open} onOpenChange={(isOpen) => {
          if (!isOpen) handleCloseDialog();
          else setOpen(true);
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Asset Master
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingAsset ? "Edit Asset Master" : "Add Asset Master"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Split AC 1.5 Ton" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <HierarchicalCategorySelector
                        value={field.value || null}
                        onChange={(categoryId) => field.onChange(categoryId || "")}
                        initialCategoryType={
                          editingAsset?.categories?.type || undefined
                        }
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="criticality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Criticality</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select criticality" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {criticalityOptions.map((opt) => (
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
                    name="investment_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Investment Size</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select investment size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {investmentOptions.map((opt) => (
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
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter description..."
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
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button type="submit">{editingAsset ? "Update" : "Add"} Asset Master</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search asset masters..."
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
              <TableHead>Category</TableHead>
              <TableHead>Criticality</TableHead>
              <TableHead>Investment Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No asset masters found
                </TableCell>
              </TableRow>
            ) : (
              filteredAssets.map((asset) => (
                <TableRow
                  key={asset.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/assets/master/${asset.id}`)}
                >
                  <TableCell className="font-medium">{asset.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{asset.categories?.name || "-"}</Badge>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
