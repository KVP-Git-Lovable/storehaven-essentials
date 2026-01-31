import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft,
  Save,
  Send,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";

interface BudgetItem {
  id: string;
  budget_id: string;
  master_item_id: string | null;
  group_name: string;
  item_name: string;
  item_type: string;
  description: string | null;
  budgeted_amount: number;
  actual_amount: number;
  variance: number;
  ai_predicted_amount: number | null;
  is_custom: boolean;
  sort_order: number;
}

interface StoreBudget {
  id: string;
  store_id: string;
  fiscal_year: number;
  budget_month: number | null;
  budget_type: string;
  total_amount: number;
  status: string;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  stores?: { id: string; name: string };
}

interface ApprovalHistory {
  id: string;
  action: string;
  performed_by: string | null;
  comments: string | null;
  created_at: string;
}

const itemTypes = [
  { value: "expense", label: "General Expense" },
  { value: "rental", label: "Rental" },
  { value: "utility", label: "Utility" },
  { value: "staff", label: "Staff/Payroll" },
  { value: "inventory", label: "Inventory/Raw Materials" },
  { value: "incidental", label: "Incidental" },
];

export default function StoreBudgetDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve");
  const [approvalComments, setApprovalComments] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [newItem, setNewItem] = useState({
    group_name: "",
    item_name: "",
    item_type: "expense",
    description: "",
    budgeted_amount: 0,
  });

  // Fetch budget
  const { data: budget, isLoading: budgetLoading } = useQuery({
    queryKey: ["store-budget", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_budgets")
        .select("*, stores(id, name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as StoreBudget;
    },
    enabled: !!id,
  });

  // Fetch budget items
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["store-budget-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_budget_items")
        .select("*")
        .eq("budget_id", id)
        .order("group_name")
        .order("sort_order");
      if (error) throw error;
      return data as BudgetItem[];
    },
    enabled: !!id,
  });

  // Fetch approval history
  const { data: approvalHistory = [] } = useQuery({
    queryKey: ["budget-approval-history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_approval_history")
        .select("*")
        .eq("budget_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ApprovalHistory[];
    },
    enabled: !!id,
  });

  // Group items by group_name
  const groupedItems = useMemo(() => {
    const groups: Record<string, BudgetItem[]> = {};
    items.forEach((item) => {
      if (!groups[item.group_name]) {
        groups[item.group_name] = [];
      }
      groups[item.group_name].push(item);
    });
    return groups;
  }, [items]);

  // Calculate totals
  const totalBudgeted = items.reduce((sum, item) => sum + item.budgeted_amount, 0);
  const totalActual = items.reduce((sum, item) => sum + item.actual_amount, 0);
  const totalVariance = totalBudgeted - totalActual;

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, amount }: { itemId: string; amount: number }) => {
      const { error } = await supabase
        .from("store_budget_items")
        .update({ budgeted_amount: amount })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-budget-items", id] });
    },
    onError: () => toast.error("Failed to update item"),
  });

  // Add custom item mutation
  const addItemMutation = useMutation({
    mutationFn: async (data: typeof newItem) => {
      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
      const { error } = await supabase.from("store_budget_items").insert({
        budget_id: id,
        group_name: data.group_name,
        item_name: data.item_name,
        item_type: data.item_type,
        description: data.description || null,
        budgeted_amount: data.budgeted_amount,
        is_custom: true,
        sort_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-budget-items", id] });
      toast.success("Custom item added");
      setAddItemDialogOpen(false);
      setNewItem({
        group_name: "",
        item_name: "",
        item_type: "expense",
        description: "",
        budgeted_amount: 0,
      });
    },
    onError: () => toast.error("Failed to add item"),
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("store_budget_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-budget-items", id] });
      toast.success("Item deleted");
    },
    onError: () => toast.error("Failed to delete item"),
  });

  // Save total and update budget
  const saveBudgetMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("store_budgets")
        .update({ total_amount: totalBudgeted })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-budget", id] });
      toast.success("Budget saved");
    },
    onError: () => toast.error("Failed to save budget"),
  });

  // Submit for approval
  const submitForApprovalMutation = useMutation({
    mutationFn: async () => {
      const { error: budgetError } = await supabase
        .from("store_budgets")
        .update({
          status: "pending_approval",
          total_amount: totalBudgeted,
          submitted_by: user?.id,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (budgetError) throw budgetError;

      const { error: historyError } = await supabase.from("budget_approval_history").insert({
        budget_id: id,
        action: "submitted",
        performed_by: user?.id,
        comments: "Budget submitted for approval",
      });
      if (historyError) throw historyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-budget", id] });
      queryClient.invalidateQueries({ queryKey: ["budget-approval-history", id] });
      toast.success("Budget submitted for approval");
    },
    onError: () => toast.error("Failed to submit budget"),
  });

  // Approve/Reject mutation
  const processApprovalMutation = useMutation({
    mutationFn: async ({ action, comments }: { action: "approve" | "reject"; comments: string }) => {
      const updateData: Partial<StoreBudget> = {
        status: action === "approve" ? "approved" : "rejected",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      };
      if (action === "reject") {
        updateData.rejection_reason = comments;
      }

      const { error: budgetError } = await supabase
        .from("store_budgets")
        .update(updateData)
        .eq("id", id);
      if (budgetError) throw budgetError;

      const { error: historyError } = await supabase.from("budget_approval_history").insert({
        budget_id: id,
        action: action === "approve" ? "approved" : "rejected",
        performed_by: user?.id,
        comments,
      });
      if (historyError) throw historyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-budget", id] });
      queryClient.invalidateQueries({ queryKey: ["budget-approval-history", id] });
      toast.success(approvalAction === "approve" ? "Budget approved" : "Budget rejected");
      setApprovalDialogOpen(false);
      setApprovalComments("");
    },
    onError: () => toast.error("Failed to process approval"),
  });

  const handleAmountChange = (itemId: string, value: string) => {
    const amount = parseFloat(value) || 0;
    updateItemMutation.mutate({ itemId, amount });
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) =>
      prev.includes(groupName) ? prev.filter((g) => g !== groupName) : [...prev, groupName]
    );
  };

  const getGroupTotal = (groupItems: BudgetItem[]) => {
    return groupItems.reduce((sum, item) => sum + item.budgeted_amount, 0);
  };

  const getItemTypeLabel = (type: string) => {
    return itemTypes.find((t) => t.value === type)?.label || type;
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

  if (budgetLoading) {
    return <div className="p-8 text-center">Loading budget...</div>;
  }

  if (!budget) {
    return <div className="p-8 text-center">Budget not found</div>;
  }

  const isEditable = budget.status === "draft" || budget.status === "rejected";
  const canSubmit = budget.status === "draft" && totalBudgeted > 0;
  const canApprove = budget.status === "pending_approval";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/stores/budget")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{budget.stores?.name} - Budget</h1>
            <p className="text-muted-foreground">
              FY {budget.fiscal_year}-{budget.fiscal_year + 1} • {getStatusBadge(budget.status)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditable && (
            <>
              <Button variant="outline" onClick={() => setAddItemDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Custom Item
              </Button>
              <Button variant="outline" onClick={() => saveBudgetMutation.mutate()}>
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </>
          )}
          {canSubmit && (
            <Button onClick={() => submitForApprovalMutation.mutate()}>
              <Send className="mr-2 h-4 w-4" />
              Submit for Approval
            </Button>
          )}
          {canApprove && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setApprovalAction("reject");
                  setApprovalDialogOpen(true);
                }}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                onClick={() => {
                  setApprovalAction("approve");
                  setApprovalDialogOpen(true);
                }}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Budgeted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              <IndianRupee className="h-5 w-5" />
              {totalBudgeted.toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              <IndianRupee className="h-5 w-5" />
              {totalActual.toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Variance</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold flex items-center ${
                totalVariance >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {totalVariance >= 0 ? (
                <TrendingUp className="h-5 w-5 mr-1" />
              ) : (
                <TrendingDown className="h-5 w-5 mr-1" />
              )}
              <IndianRupee className="h-5 w-5" />
              {Math.abs(totalVariance).toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Rejection reason if rejected */}
      {budget.status === "rejected" && budget.rejection_reason && (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Rejection Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{budget.rejection_reason}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Budget Items</TabsTrigger>
          <TabsTrigger value="history">Approval History</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4">
          {/* Budget Items by Group */}
          {Object.keys(groupedItems).length === 0 ? (
            <div className="border rounded-lg p-8 text-center text-muted-foreground">
              No budget items. Add items from the Budget Master or add custom items.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedItems).map(([groupName, groupItems]) => (
                <div key={groupName} className="border rounded-lg">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleGroup(groupName)}
                  >
                    <div className="flex items-center gap-2">
                      {expandedGroups.includes(groupName) ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                      <span className="font-semibold">{groupName}</span>
                      <Badge variant="secondary">{groupItems.length} items</Badge>
                    </div>
                    <div className="flex items-center font-medium">
                      <IndianRupee className="h-4 w-4" />
                      {getGroupTotal(groupItems).toLocaleString("en-IN")}
                    </div>
                  </div>

                  {expandedGroups.includes(groupName) && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="w-[150px]">Budgeted (₹)</TableHead>
                          <TableHead className="w-[120px]">Actual (₹)</TableHead>
                          <TableHead className="w-[120px]">Variance (₹)</TableHead>
                          {isEditable && <TableHead className="w-[80px]">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{item.item_name}</span>
                                  {item.is_custom && (
                                    <Badge variant="outline" className="text-xs">
                                      Custom
                                    </Badge>
                                  )}
                                  {item.ai_predicted_amount && (
                                    <Sparkles className="h-3 w-3 text-primary" />
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground">{item.description}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{getItemTypeLabel(item.item_type)}</Badge>
                            </TableCell>
                            <TableCell>
                              {isEditable ? (
                                <Input
                                  type="number"
                                  value={item.budgeted_amount}
                                  onChange={(e) => handleAmountChange(item.id, e.target.value)}
                                  className="w-full"
                                />
                              ) : (
                                <span>{item.budgeted_amount.toLocaleString("en-IN")}</span>
                              )}
                            </TableCell>
                            <TableCell>{item.actual_amount.toLocaleString("en-IN")}</TableCell>
                            <TableCell>
                              <span
                                className={item.variance >= 0 ? "text-green-600" : "text-red-600"}
                              >
                                {item.variance >= 0 ? "+" : ""}
                                {item.variance.toLocaleString("en-IN")}
                              </span>
                            </TableCell>
                            {isEditable && (
                              <TableCell>
                                {item.is_custom && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={() => deleteItemMutation.mutate(item.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {approvalHistory.length === 0 ? (
            <div className="border rounded-lg p-8 text-center text-muted-foreground">
              No approval history yet.
            </div>
          ) : (
            <div className="space-y-4">
              {approvalHistory.map((history) => (
                <div key={history.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          history.action === "approved"
                            ? "default"
                            : history.action === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {history.action.charAt(0).toUpperCase() + history.action.slice(1)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(history.created_at), "dd MMM yyyy, hh:mm a")}
                      </span>
                    </div>
                  </div>
                  {history.comments && <p className="mt-2 text-sm">{history.comments}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Custom Item Dialog */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Budget Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Group Name *</Label>
              <Input
                value={newItem.group_name}
                onChange={(e) => setNewItem({ ...newItem, group_name: e.target.value })}
                placeholder="e.g., Marketing Expenses"
              />
            </div>
            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input
                value={newItem.item_name}
                onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                placeholder="e.g., Digital Ads"
              />
            </div>
            <div className="space-y-2">
              <Label>Item Type</Label>
              <Select
                value={newItem.item_type}
                onValueChange={(v) => setNewItem({ ...newItem, item_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {itemTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Budgeted Amount (₹)</Label>
              <Input
                type="number"
                value={newItem.budgeted_amount}
                onChange={(e) =>
                  setNewItem({ ...newItem, budgeted_amount: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Optional details..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addItemMutation.mutate(newItem)}
              disabled={!newItem.group_name || !newItem.item_name}
            >
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === "approve" ? "Approve Budget" : "Reject Budget"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Comments {approvalAction === "reject" && "*"}</Label>
              <Textarea
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                placeholder={
                  approvalAction === "reject"
                    ? "Please provide reason for rejection..."
                    : "Optional comments..."
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={approvalAction === "reject" ? "destructive" : "default"}
              onClick={() =>
                processApprovalMutation.mutate({
                  action: approvalAction,
                  comments: approvalComments,
                })
              }
              disabled={approvalAction === "reject" && !approvalComments}
            >
              {approvalAction === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
