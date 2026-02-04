import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface SqFtBudget {
  id: string;
  name: string | null;
  min_sqft: number | null;
  max_sqft: number | null;
  price_per_sqft: number;
  effective_from: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  min_sqft: string;
  max_sqft: string;
  price_per_sqft: string;
  effective_from: string;
  status: string;
}

const defaultFormData: FormData = {
  name: "",
  min_sqft: "0",
  max_sqft: "",
  price_per_sqft: "",
  effective_from: "",
  status: "active",
};

export default function SqFtBudgetMaster() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SqFtBudget | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["sqft-budget-master"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sqft_budget_master")
        .select("*")
        .order("min_sqft", { ascending: true });
      if (error) throw error;
      return data as SqFtBudget[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("sqft_budget_master").insert({
        name: data.name || null,
        min_sqft: parseFloat(data.min_sqft) || 0,
        max_sqft: data.max_sqft ? parseFloat(data.max_sqft) : null,
        price_per_sqft: parseFloat(data.price_per_sqft),
        effective_from: data.effective_from || null,
        status: data.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sqft-budget-master"] });
      toast.success("Budget rate created successfully");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error("Failed to create budget rate: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const { error } = await supabase
        .from("sqft_budget_master")
        .update({
          name: data.name || null,
          min_sqft: parseFloat(data.min_sqft) || 0,
          max_sqft: data.max_sqft ? parseFloat(data.max_sqft) : null,
          price_per_sqft: parseFloat(data.price_per_sqft),
          effective_from: data.effective_from || null,
          status: data.status,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sqft-budget-master"] });
      toast.success("Budget rate updated successfully");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error("Failed to update budget rate: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sqft_budget_master")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sqft-budget-master"] });
      toast.success("Budget rate deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete budget rate: " + error.message);
    },
  });

  const handleOpenDialog = (item?: SqFtBudget) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name || "",
        min_sqft: (item.min_sqft || 0).toString(),
        max_sqft: item.max_sqft?.toString() || "",
        price_per_sqft: item.price_per_sqft.toString(),
        effective_from: item.effective_from || "",
        status: item.status,
      });
    } else {
      setEditingItem(null);
      setFormData(defaultFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const price = parseFloat(formData.price_per_sqft);
    if (isNaN(price) || price < 0) {
      toast.error("Please enter a valid price (0 or greater)");
      return;
    }

    const minSqft = parseFloat(formData.min_sqft) || 0;
    const maxSqft = formData.max_sqft ? parseFloat(formData.max_sqft) : null;
    
    if (maxSqft !== null && maxSqft <= minSqft) {
      toast.error("Max Sq Ft must be greater than Min Sq Ft");
      return;
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this budget rate?")) {
      deleteMutation.mutate(id);
    }
  };

  const formatSqFtRange = (min: number | null, max: number | null) => {
    const minVal = min || 0;
    if (max === null || max === undefined) {
      return `${minVal.toLocaleString("en-IN")}+ sq ft`;
    }
    return `${minVal.toLocaleString("en-IN")} - ${max.toLocaleString("en-IN")} sq ft`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sq Ft Budget Master</h1>
          <p className="text-muted-foreground">
            Manage price per square foot rates by store size ranges
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rate
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Budget Name</TableHead>
              <TableHead>Sq Ft Range</TableHead>
              <TableHead>Price per Sq Ft</TableHead>
              <TableHead>Effective From</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : budgets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No budget rates configured. Add one to get started.
                </TableCell>
              </TableRow>
            ) : (
              budgets.map((budget) => (
                <TableRow key={budget.id}>
                  <TableCell>{budget.name || "-"}</TableCell>
                  <TableCell className="font-medium">
                    {formatSqFtRange(budget.min_sqft, budget.max_sqft)}
                  </TableCell>
                  <TableCell className="font-medium">
                    ₹{budget.price_per_sqft.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    {budget.effective_from
                      ? format(new Date(budget.effective_from), "dd MMM yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={budget.status === "active" ? "default" : "secondary"}
                    >
                      {budget.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(budget.created_at), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(budget)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(budget.id)}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Budget Rate" : "Add Budget Rate"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Budget Name (Optional)</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Small Store Rate, Large Store Rate"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_sqft">Min Sq Ft *</Label>
                <Input
                  id="min_sqft"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.min_sqft}
                  onChange={(e) =>
                    setFormData({ ...formData, min_sqft: e.target.value })
                  }
                  placeholder="0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_sqft">Max Sq Ft</Label>
                <Input
                  id="max_sqft"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.max_sqft}
                  onChange={(e) =>
                    setFormData({ ...formData, max_sqft: e.target.value })
                  }
                  placeholder="Unlimited"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for unlimited (e.g., 5000+)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_per_sqft">Price per Sq Ft (₹) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="price_per_sqft"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_per_sqft}
                  onChange={(e) =>
                    setFormData({ ...formData, price_per_sqft: e.target.value })
                  }
                  className="pl-7"
                  placeholder="0.00"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  per sq ft
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="effective_from">Effective From (Optional)</Label>
              <Input
                id="effective_from"
                type="date"
                value={formData.effective_from}
                onChange={(e) =>
                  setFormData({ ...formData, effective_from: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
