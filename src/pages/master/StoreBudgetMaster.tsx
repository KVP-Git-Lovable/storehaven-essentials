import { useState } from "react";
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
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  FolderPlus,
  ListPlus,
  Package,
  IndianRupee,
} from "lucide-react";
import { format } from "date-fns";

const storeTypes = ["Flagship", "Standard", "Express", "Outlet", "Kiosk"];
const itemTypes = [
  { value: "expense", label: "General Expense" },
  { value: "rental", label: "Rental" },
  { value: "utility", label: "Utility" },
  { value: "staff", label: "Staff/Payroll" },
  { value: "inventory", label: "Inventory/Raw Materials" },
  { value: "incidental", label: "Incidental" },
];

interface BudgetGroup {
  id: string;
  name: string;
  store_type: string | null;
  description: string | null;
  sort_order: number;
  status: string;
  created_at: string;
}

interface BudgetItem {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  item_type: string;
  default_amount: number;
  inventory_item_id: string | null;
  is_recurring: boolean;
  sort_order: number;
  status: string;
  inventory_items?: { id: string; name: string } | null;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
}

export default function StoreBudgetMaster() {
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState<BudgetGroup | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<BudgetGroup | null>(null);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [groupForm, setGroupForm] = useState({
    name: "",
    store_type: "",
    description: "",
    status: "active",
  });
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    item_type: "expense",
    default_amount: 0,
    inventory_item_id: "",
    is_recurring: true,
  });

  // Fetch budget groups
  const { data: groups = [] } = useQuery({
    queryKey: ["budget-master-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_master_groups")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as BudgetGroup[];
    },
  });

  // Fetch items for selected group
  const { data: items = [] } = useQuery({
    queryKey: ["budget-master-items", selectedGroup?.id],
    queryFn: async () => {
      if (!selectedGroup) return [];
      const { data, error } = await supabase
        .from("budget_master_items")
        .select("*, inventory_items(id, name)")
        .eq("group_id", selectedGroup.id)
        .order("sort_order");
      if (error) throw error;
      return data as BudgetItem[];
    },
    enabled: !!selectedGroup,
  });

  // Fetch inventory items for linking
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory-items-for-budget"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, category")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as InventoryItem[];
    },
  });

  // Group mutations
  const createGroupMutation = useMutation({
    mutationFn: async (data: typeof groupForm) => {
      const maxOrder = groups.length > 0 ? Math.max(...groups.map((g) => g.sort_order)) + 1 : 0;
      const { error } = await supabase.from("budget_master_groups").insert({
        name: data.name,
        store_type: data.store_type || null,
        description: data.description || null,
        status: data.status,
        sort_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-master-groups"] });
      toast.success("Budget group created");
      setGroupDialogOpen(false);
      resetGroupForm();
    },
    onError: () => toast.error("Failed to create budget group"),
  });

  const updateGroupMutation = useMutation({
    mutationFn: async (data: typeof groupForm & { id: string }) => {
      const { error } = await supabase
        .from("budget_master_groups")
        .update({
          name: data.name,
          store_type: data.store_type || null,
          description: data.description || null,
          status: data.status,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-master-groups"] });
      toast.success("Budget group updated");
      setGroupDialogOpen(false);
      resetGroupForm();
    },
    onError: () => toast.error("Failed to update budget group"),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_master_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-master-groups"] });
      toast.success("Budget group deleted");
      if (selectedGroup) setSelectedGroup(null);
    },
    onError: () => toast.error("Failed to delete budget group"),
  });

  // Item mutations
  const createItemMutation = useMutation({
    mutationFn: async (data: typeof itemForm & { group_id: string }) => {
      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
      const { error } = await supabase.from("budget_master_items").insert({
        group_id: data.group_id,
        name: data.name,
        description: data.description || null,
        item_type: data.item_type,
        default_amount: data.default_amount,
        inventory_item_id: data.inventory_item_id || null,
        is_recurring: data.is_recurring,
        sort_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-master-items"] });
      toast.success("Budget item created");
      setItemDialogOpen(false);
      resetItemForm();
    },
    onError: () => toast.error("Failed to create budget item"),
  });

  const updateItemMutation = useMutation({
    mutationFn: async (data: typeof itemForm & { id: string }) => {
      const { error } = await supabase
        .from("budget_master_items")
        .update({
          name: data.name,
          description: data.description || null,
          item_type: data.item_type,
          default_amount: data.default_amount,
          inventory_item_id: data.inventory_item_id || null,
          is_recurring: data.is_recurring,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-master-items"] });
      toast.success("Budget item updated");
      setItemDialogOpen(false);
      resetItemForm();
    },
    onError: () => toast.error("Failed to update budget item"),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_master_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-master-items"] });
      toast.success("Budget item deleted");
    },
    onError: () => toast.error("Failed to delete budget item"),
  });

  const resetGroupForm = () => {
    setGroupForm({ name: "", store_type: "", description: "", status: "active" });
    setEditingGroup(null);
  };

  const resetItemForm = () => {
    setItemForm({
      name: "",
      description: "",
      item_type: "expense",
      default_amount: 0,
      inventory_item_id: "",
      is_recurring: true,
    });
    setEditingItem(null);
  };

  const openEditGroup = (group: BudgetGroup) => {
    setEditingGroup(group);
    setGroupForm({
      name: group.name,
      store_type: group.store_type || "",
      description: group.description || "",
      status: group.status,
    });
    setGroupDialogOpen(true);
  };

  const openEditItem = (item: BudgetItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description || "",
      item_type: item.item_type,
      default_amount: item.default_amount,
      inventory_item_id: item.inventory_item_id || "",
      is_recurring: item.is_recurring,
    });
    setItemDialogOpen(true);
  };

  const handleGroupSubmit = () => {
    if (editingGroup) {
      updateGroupMutation.mutate({ ...groupForm, id: editingGroup.id });
    } else {
      createGroupMutation.mutate(groupForm);
    }
  };

  const handleItemSubmit = () => {
    if (!selectedGroup) return;
    if (editingItem) {
      updateItemMutation.mutate({ ...itemForm, id: editingItem.id });
    } else {
      createItemMutation.mutate({ ...itemForm, group_id: selectedGroup.id });
    }
  };

  const getItemTypeLabel = (type: string) => {
    return itemTypes.find((t) => t.value === type)?.label || type;
  };

  const getItemTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "rental":
        return "default";
      case "utility":
        return "secondary";
      case "staff":
        return "outline";
      case "inventory":
        return "default";
      case "incidental":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Store Budget Master</h1>
          <p className="text-muted-foreground">Define budget line items by store type</p>
        </div>
        <Button onClick={() => { resetGroupForm(); setGroupDialogOpen(true); }}>
          <FolderPlus className="mr-2 h-4 w-4" />
          Add Budget Group
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Groups List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold">Budget Groups</h2>
          {groups.length === 0 ? (
            <div className="border rounded-lg p-8 text-center text-muted-foreground">
              No budget groups yet. Create one to get started.
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {groups.map((group) => (
                <AccordionItem key={group.id} value={group.id} className="border rounded-lg px-4">
                  <AccordionTrigger
                    onClick={() => setSelectedGroup(group)}
                    className="hover:no-underline"
                  >
                    <div className="flex items-center gap-2 text-left">
                      <span className="font-medium">{group.name}</span>
                      {group.store_type && (
                        <Badge variant="outline" className="text-xs">
                          {group.store_type}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pb-2">
                      {group.description && (
                        <p className="text-sm text-muted-foreground">{group.description}</p>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditGroup(group)}>
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() => deleteGroupMutation.mutate(group.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

        {/* Items for Selected Group */}
        <div className="lg:col-span-2 space-y-4">
          {selectedGroup ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{selectedGroup.name} - Line Items</h2>
                  {selectedGroup.store_type && (
                    <p className="text-sm text-muted-foreground">
                      Store Type: {selectedGroup.store_type}
                    </p>
                  )}
                </div>
                <Button onClick={() => { resetItemForm(); setItemDialogOpen(true); }}>
                  <ListPlus className="mr-2 h-4 w-4" />
                  Add Line Item
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="border rounded-lg p-8 text-center text-muted-foreground">
                  No line items yet. Add items to this group.
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Default Amount</TableHead>
                        <TableHead>Linked Inventory</TableHead>
                        <TableHead>Recurring</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.name}</p>
                              {item.description && (
                                <p className="text-xs text-muted-foreground">{item.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getItemTypeBadgeVariant(item.item_type)}>
                              {getItemTypeLabel(item.item_type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <IndianRupee className="h-3 w-3 mr-1" />
                              {item.default_amount.toLocaleString("en-IN")}
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.inventory_items ? (
                              <div className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                <span className="text-sm">{item.inventory_items.name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.is_recurring ? "default" : "secondary"}>
                              {item.is_recurring ? "Yes" : "No"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditItem(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => deleteItemMutation.mutate(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          ) : (
            <div className="border rounded-lg p-12 text-center text-muted-foreground">
              <FolderPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a budget group from the left to view and manage line items</p>
            </div>
          )}
        </div>
      </div>

      {/* Group Dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit Budget Group" : "Create Budget Group"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Group Name *</Label>
              <Input
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="e.g., Operational Expenses"
              />
            </div>
            <div className="space-y-2">
              <Label>Store Type</Label>
              <Select
                value={groupForm.store_type}
                onValueChange={(v) => setGroupForm({ ...groupForm, store_type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All store types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Store Types</SelectItem>
                  {storeTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                placeholder="Optional description..."
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={groupForm.status}
                onValueChange={(v) => setGroupForm({ ...groupForm, status: v })}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGroupSubmit} disabled={!groupForm.name}>
              {editingGroup ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Budget Item" : "Add Budget Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                placeholder="e.g., Monthly Rent"
              />
            </div>
            <div className="space-y-2">
              <Label>Item Type *</Label>
              <Select
                value={itemForm.item_type}
                onValueChange={(v) => setItemForm({ ...itemForm, item_type: v })}
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
              <Label>Default Amount (₹)</Label>
              <Input
                type="number"
                value={itemForm.default_amount}
                onChange={(e) => setItemForm({ ...itemForm, default_amount: Number(e.target.value) })}
                placeholder="0"
              />
            </div>
            {itemForm.item_type === "inventory" && (
              <div className="space-y-2">
                <Label>Link to Inventory Item</Label>
                <Select
                  value={itemForm.inventory_item_id}
                  onValueChange={(v) => setItemForm({ ...itemForm, inventory_item_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select inventory item" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {inventoryItems.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.name} ({inv.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                placeholder="Optional details..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_recurring"
                checked={itemForm.is_recurring}
                onChange={(e) => setItemForm({ ...itemForm, is_recurring: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="is_recurring">Recurring monthly expense</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleItemSubmit} disabled={!itemForm.name}>
              {editingItem ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
