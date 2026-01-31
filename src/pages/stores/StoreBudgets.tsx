import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FileText,
  TrendingUp,
  IndianRupee,
  Calendar,
  Building2,
  Eye,
  Search,
} from "lucide-react";
import { format } from "date-fns";

interface Store {
  id: string;
  name: string;
}

interface StoreBudget {
  id: string;
  store_id: string;
  fiscal_year: number;
  budget_month: number | null;
  budget_type: string;
  total_amount: number;
  status: string;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  stores?: Store;
}

export default function StoreBudgets() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [form, setForm] = useState({
    store_id: "",
    fiscal_year: new Date().getFullYear(),
    budget_type: "annual",
  });

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  // Fetch stores
  const { data: stores = [] } = useQuery({
    queryKey: ["stores-for-budget"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as Store[];
    },
  });

  // Fetch budgets
  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["store-budgets", filterYear, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("store_budgets")
        .select("*, stores(id, name)")
        .eq("budget_type", "annual")
        .order("created_at", { ascending: false });

      if (filterYear !== "all") {
        query = query.eq("fiscal_year", parseInt(filterYear));
      }
      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as StoreBudget[];
    },
  });

  // Create budget mutation
  const createBudgetMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      // Check if budget already exists
      const { data: existing } = await supabase
        .from("store_budgets")
        .select("id")
        .eq("store_id", data.store_id)
        .eq("fiscal_year", data.fiscal_year)
        .eq("budget_type", "annual")
        .single();

      if (existing) {
        throw new Error("Budget already exists for this store and year");
      }

      const { data: budget, error } = await supabase
        .from("store_budgets")
        .insert({
          store_id: data.store_id,
          fiscal_year: data.fiscal_year,
          budget_type: data.budget_type,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;

      // Fetch budget master items and create budget line items
      const { data: masterGroups } = await supabase
        .from("budget_master_groups")
        .select("id, name")
        .eq("status", "active");

      if (masterGroups && masterGroups.length > 0) {
        for (const group of masterGroups) {
          const { data: masterItems } = await supabase
            .from("budget_master_items")
            .select("*")
            .eq("group_id", group.id)
            .eq("status", "active");

          if (masterItems && masterItems.length > 0) {
            const budgetItems = masterItems.map((item) => ({
              budget_id: budget.id,
              master_item_id: item.id,
              group_name: group.name,
              item_name: item.name,
              item_type: item.item_type,
              description: item.description,
              budgeted_amount: item.default_amount || 0,
              is_custom: false,
              sort_order: item.sort_order,
            }));

            await supabase.from("store_budget_items").insert(budgetItems);
          }
        }
      }

      return budget;
    },
    onSuccess: (budget) => {
      queryClient.invalidateQueries({ queryKey: ["store-budgets"] });
      toast.success("Budget created successfully");
      setDialogOpen(false);
      navigate(`/stores/budget/${budget.id}`);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create budget"),
  });

  const handleSubmit = () => {
    if (!form.store_id) {
      toast.error("Please select a store");
      return;
    }
    createBudgetMutation.mutate(form);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      draft: "secondary",
      pending_approval: "outline",
      approved: "default",
      rejected: "destructive",
    };
    const labels: Record<string, string> = {
      draft: "Draft",
      pending_approval: "Pending Approval",
      approved: "Approved",
      rejected: "Rejected",
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  const filteredBudgets = budgets.filter((b) =>
    b.stores?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const totalBudgets = budgets.length;
  const approvedBudgets = budgets.filter((b) => b.status === "approved").length;
  const pendingBudgets = budgets.filter((b) => b.status === "pending_approval").length;
  const totalBudgetAmount = budgets.reduce((sum, b) => sum + (b.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Store Budgets</h1>
          <p className="text-muted-foreground">Manage annual store budgets and approvals</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/stores/budget/dashboard")}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Budget Dashboard
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Budget
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Budgets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBudgets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{approvedBudgets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendingBudgets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Budget Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              <IndianRupee className="h-5 w-5" />
              {totalBudgetAmount.toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by store name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-[150px]">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                FY {y}-{y + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Budget Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store</TableHead>
              <TableHead>Fiscal Year</TableHead>
              <TableHead>Total Budget</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading budgets...
                </TableCell>
              </TableRow>
            ) : filteredBudgets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No budgets found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredBudgets.map((budget) => (
                <TableRow key={budget.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{budget.stores?.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    FY {budget.fiscal_year}-{budget.fiscal_year + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <IndianRupee className="h-4 w-4" />
                      {(budget.total_amount || 0).toLocaleString("en-IN")}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(budget.status)}</TableCell>
                  <TableCell>{format(new Date(budget.created_at), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/stores/budget/${budget.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Budget Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Store Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Store *</Label>
              <Select value={form.store_id} onValueChange={(v) => setForm({ ...form, store_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fiscal Year *</Label>
              <Select
                value={form.fiscal_year.toString()}
                onValueChange={(v) => setForm({ ...form, fiscal_year: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      FY {y}-{y + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createBudgetMutation.isPending}>
              {createBudgetMutation.isPending ? "Creating..." : "Create Budget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
