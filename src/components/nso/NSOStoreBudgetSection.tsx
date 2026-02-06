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
import { Plus, Pencil, Trash2, TrendingUp, DollarSign, CheckCircle2, Wallet } from "lucide-react";

interface NSOStoreBudgetSectionProps {
  checklistId: string;
  masterId: string | null;
}

interface BudgetItem {
  id: string;
  checklist_id: string;
  name: string;
  category: string | null;
  planned_amount: number;
  actual_cost: number;
  status: string;
  notes: string | null;
  sort_order: number;
}

interface MasterBudget {
  estimated_budget: number | null;
  budget: number | null;
  actual_budget: number | null;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", color: "bg-muted text-muted-foreground" },
  { value: "approved", label: "Approved", color: "bg-blue-100 text-blue-800" },
  { value: "ordered", label: "Ordered", color: "bg-yellow-100 text-yellow-800" },
  { value: "delivered", label: "Delivered", color: "bg-purple-100 text-purple-800" },
  { value: "deployed", label: "Deployed", color: "bg-green-100 text-green-800" },
];

const CATEGORY_OPTIONS = [
  { value: "construction", label: "Construction" },
  { value: "equipment", label: "Equipment" },
  { value: "furniture", label: "Furniture" },
  { value: "signage", label: "Signage" },
  { value: "it_systems", label: "IT Systems" },
  { value: "utilities", label: "Utilities" },
  { value: "licensing", label: "Licensing & Permits" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Other" },
];

const INCLUDED_IN_ACTUAL_STATUSES = ["delivered", "deployed"];

export function NSOStoreBudgetSection({ checklistId, masterId }: NSOStoreBudgetSectionProps) {
  const queryClient = useQueryClient();
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<BudgetItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "other",
    planned_amount: "",
    actual_cost: "",
    status: "pending",
    notes: "",
  });

  // Fetch master budget for reference
  const { data: masterBudget } = useQuery({
    queryKey: ["nso-master-budget", masterId],
    queryFn: async () => {
      if (!masterId) return null;
      const { data, error } = await supabase
        .from("nso_checklist_masters")
        .select("estimated_budget, budget, actual_budget")
        .eq("id", masterId)
        .single();
      if (error) throw error;
      return data as MasterBudget;
    },
    enabled: !!masterId,
  });

  // Fetch budget items for this checklist
  const { data: budgetItems = [], isLoading } = useQuery({
    queryKey: ["nso-budget-items", checklistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nso_store_budget_items")
        .select("*")
        .eq("checklist_id", checklistId)
        .order("sort_order");
      if (error) throw error;
      return data as BudgetItem[];
    },
  });

  // Calculate totals
  const calculatedBudget = budgetItems.reduce((sum, item) => sum + (Number(item.planned_amount) || 0), 0);
  const calculatedActual = budgetItems
    .filter((item) => INCLUDED_IN_ACTUAL_STATUSES.includes(item.status))
    .reduce((sum, item) => sum + (Number(item.actual_cost) || 0), 0);
  const variance = calculatedBudget - calculatedActual;
  const variancePercent = calculatedBudget > 0 ? ((variance / calculatedBudget) * 100).toFixed(1) : "0";

  // Add budget item mutation
  const addItemMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const maxSortOrder = budgetItems.length > 0 ? Math.max(...budgetItems.map((i) => i.sort_order)) : 0;
      const { error } = await supabase.from("nso_store_budget_items").insert({
        checklist_id: checklistId,
        name: data.name,
        description: data.name, // Required by schema
        category: data.category,
        amount: parseFloat(data.planned_amount) || 0, // Required by schema
        planned_amount: parseFloat(data.planned_amount) || 0,
        actual_cost: parseFloat(data.actual_cost) || 0,
        status: data.status,
        notes: data.notes || null,
        sort_order: maxSortOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-budget-items", checklistId] });
      toast.success("Budget item added");
      closeDialog();
    },
    onError: () => toast.error("Failed to add budget item"),
  });

  // Update budget item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("nso_store_budget_items")
        .update({
          name: data.name,
          category: data.category,
          planned_amount: parseFloat(data.planned_amount) || 0,
          actual_cost: parseFloat(data.actual_cost) || 0,
          status: data.status,
          notes: data.notes || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-budget-items", checklistId] });
      toast.success("Budget item updated");
      closeDialog();
    },
    onError: () => toast.error("Failed to update budget item"),
  });

  // Delete budget item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nso_store_budget_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-budget-items", checklistId] });
      toast.success("Budget item deleted");
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: () => toast.error("Failed to delete budget item"),
  });

  // Inline status update
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("nso_store_budget_items")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-budget-items", checklistId] });
    },
    onError: () => toast.error("Failed to update status"),
  });

  const closeDialog = () => {
    setItemDialogOpen(false);
    setEditingItem(null);
    setFormData({
      name: "",
      category: "other",
      planned_amount: "",
      actual_cost: "",
      status: "pending",
      notes: "",
    });
  };

  const openEditDialog = (item: BudgetItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category || "other",
      planned_amount: item.planned_amount?.toString() || "",
      actual_cost: item.actual_cost?.toString() || "",
      status: item.status,
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

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <Badge className={`${statusOption?.color || "bg-muted"} text-xs`}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
                Estimated Budget
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(masterBudget?.budget || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">From master template</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Planned Budget
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(calculatedBudget)}</p>
            <p className="text-xs text-muted-foreground mt-1">Sum of all planned items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Actual Spent
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(calculatedActual)}</p>
            <p className="text-xs text-muted-foreground mt-1">Delivered/Deployed items only</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Variance
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${variance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(Math.abs(variance))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {variance >= 0 ? "Under budget" : "Over budget"} ({variancePercent}%)
            </p>
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
            <p className="text-sm">Click "Add Item" to start tracking your budget</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Planned</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead>Status</TableHead>
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
                      <span className="text-muted-foreground text-sm">{categoryLabel}</span>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.planned_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.actual_cost)}</TableCell>
                    <TableCell>
                      <Select
                        value={item.status}
                        onValueChange={(value) => updateStatusMutation.mutate({ id: item.id, status: value })}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue>{getStatusBadge(item.status)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(item)}
                        >
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
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Planned Amount (₹)</Label>
                <Input
                  type="number"
                  value={formData.planned_amount}
                  onChange={(e) => setFormData((f) => ({ ...f, planned_amount: e.target.value }))}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Actual Cost (₹)</Label>
                <Input
                  type="number"
                  value={formData.actual_cost}
                  onChange={(e) => setFormData((f) => ({ ...f, actual_cost: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Additional details..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={addItemMutation.isPending || updateItemMutation.isPending}
            >
              {addItemMutation.isPending || updateItemMutation.isPending
                ? "Saving..."
                : editingItem
                ? "Update Item"
                : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToDelete && deleteItemMutation.mutate(itemToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
