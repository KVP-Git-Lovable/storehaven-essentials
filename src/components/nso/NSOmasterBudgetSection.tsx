import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, DollarSign, Wallet } from "lucide-react";

interface NSOmasterBudgetSectionProps {
  masterId: string;
}

interface MasterBudgetItem {
  id: string;
  master_id: string;
  name: string;
  category: string;
  planned_amount: number;
  notes: string | null;
  sort_order: number;
}

const CATEGORY_OPTIONS = [
  { value: "construction", label: "Construction" },
  { value: "equipment", label: "Equipment" },
  { value: "furniture", label: "Furniture" },
  { value: "signage", label: "Signage" },
  { value: "it_systems", label: "IT Systems" },
  { value: "utilities", label: "Utilities" },
  { value: "licensing", label: "Licensing & Permits" },
  { value: "marketing", label: "Marketing" },
  { value: "rent", label: "Rent" },
  { value: "labour", label: "Labour" },
  { value: "raw_materials", label: "Raw Materials" },
  { value: "other", label: "Other" },
];

export function NSOmasterBudgetSection({ masterId }: NSOmasterBudgetSectionProps) {
  const queryClient = useQueryClient();
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterBudgetItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MasterBudgetItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "other",
    planned_amount: "",
    notes: "",
  });

  // Fetch budget items for this master
  const { data: budgetItems = [], isLoading } = useQuery({
    queryKey: ["nso-master-budget-items", masterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nso_master_budget_items")
        .select("*")
        .eq("master_id", masterId)
        .order("sort_order");
      if (error) throw error;
      return data as MasterBudgetItem[];
    },
  });

  // Calculate total
  const totalEstimated = budgetItems.reduce((sum, item) => sum + (Number(item.planned_amount) || 0), 0);

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const maxSortOrder = budgetItems.length > 0 ? Math.max(...budgetItems.map((i) => i.sort_order)) : 0;
      const { error } = await supabase.from("nso_master_budget_items").insert({
        master_id: masterId,
        name: data.name,
        category: data.category,
        planned_amount: parseFloat(data.planned_amount) || 0,
        notes: data.notes || null,
        sort_order: maxSortOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-master-budget-items", masterId] });
      toast.success("Budget item added");
      closeDialog();
    },
    onError: () => toast.error("Failed to add budget item"),
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("nso_master_budget_items")
        .update({
          name: data.name,
          category: data.category,
          planned_amount: parseFloat(data.planned_amount) || 0,
          notes: data.notes || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-master-budget-items", masterId] });
      toast.success("Budget item updated");
      closeDialog();
    },
    onError: () => toast.error("Failed to update budget item"),
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nso_master_budget_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-master-budget-items", masterId] });
      toast.success("Budget item deleted");
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: () => toast.error("Failed to delete budget item"),
  });

  const closeDialog = () => {
    setItemDialogOpen(false);
    setEditingItem(null);
    setFormData({ name: "", category: "other", planned_amount: "", notes: "" });
  };

  const openEditDialog = (item: MasterBudgetItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category || "other",
      planned_amount: item.planned_amount?.toString() || "",
      notes: item.notes || "",
    });
    setItemDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Item name is required");
      return;
    }
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      addItemMutation.mutate(formData);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
          <CardContent><Skeleton className="h-8 w-32" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Estimated Budget
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalEstimated)}</p>
            <p className="text-xs text-muted-foreground mt-1">Sum of all planned items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Items
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{budgetItems.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Budget line items configured</p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Items Table */}
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Budget Line Items</h3>
          <Button size="sm" onClick={() => setItemDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>

        {budgetItems.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No budget items yet</p>
            <p className="text-sm">Add items to define the estimated budget for this template</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Estimated Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgetItems.map((item) => {
                const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === item.category)?.label || item.category;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{categoryLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.planned_amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {item.notes || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setItemToDelete(item);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Total Row */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell />
                <TableCell className="text-right">{formatCurrency(totalEstimated)}</TableCell>
                <TableCell />
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add/Edit Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Budget Item" : "Add Budget Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Store Signage Installation"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Estimated Amount (₹)</Label>
                <Input
                  type="number"
                  value={formData.planned_amount}
                  onChange={(e) => setFormData((f) => ({ ...f, planned_amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit}>
              {editingItem ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => itemToDelete && deleteItemMutation.mutate(itemToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
