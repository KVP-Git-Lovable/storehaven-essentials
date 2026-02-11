import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useStoreAccess } from "@/hooks/useStoreAccess";
import { Plus, Search, ClipboardList, CheckCircle2, Clock, Truck, Trash2, Pencil, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";

const requisitionSchema = z.object({
  store_id: z.string().min(1, "Store is required"),
  requested_by: z.string().min(1, "Requester is required"),
  priority: z.string().min(1),
  notes: z.string().optional(),
});

type RequisitionFormData = z.infer<typeof requisitionSchema>;

interface Store {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  unit: string;
}

interface RequisitionItemEntry {
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
}

interface Requisition {
  id: string;
  requisition_number: string;
  store_id: string;
  source_warehouse_id: string | null;
  requested_by: string;
  approved_by: string | null;
  status: string;
  priority: string;
  notes: string | null;
  requested_at: string;
  approved_at: string | null;
  stores?: { name: string };
  requisition_items?: {
    id: string;
    quantity_requested: number;
    inventory_items: { name: string; unit: string };
  }[];
}

interface Profile {
  id: string;
  username: string;
  email: string;
}

export default function Requisitions() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const { accessibleStoreIds, isAdmin, loading: accessLoading } = useStoreAccess();
  
  // Items being added to the requisition
  const [selectedItems, setSelectedItems] = useState<RequisitionItemEntry[]>([]);
  // Inline row for adding new item
  const [newRowItemId, setNewRowItemId] = useState("");
  const [newRowQuantity, setNewRowQuantity] = useState(1);
  const [showNewRow, setShowNewRow] = useState(true);
  // Editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState(1);

  const form = useForm<RequisitionFormData>({
    resolver: zodResolver(requisitionSchema),
    defaultValues: {
      store_id: "",
      requested_by: "",
      priority: "normal",
      notes: "",
    },
  });

  useEffect(() => {
    if (!accessLoading) {
      fetchData();
    }
  }, [accessLoading, accessibleStoreIds]);

  const fetchData = async () => {
    try {
      const storeIds = Array.from(accessibleStoreIds);
      
      let reqQuery = supabase
        .from("requisitions")
        .select("*, stores(name), requisition_items(id, quantity_requested, inventory_items(name, unit))")
        .order("created_at", { ascending: false });
      
      if (!isAdmin && storeIds.length > 0) {
        reqQuery = reqQuery.in("store_id", storeIds);
      }
      
      const [reqRes, storeRes, itemsRes, profilesRes] = await Promise.all([
        reqQuery,
        supabase.from("stores").select("id, name").eq("status", "active"),
        supabase.from("inventory_items").select("id, name, sku, category, unit").eq("status", "active"),
        supabase.from("profiles").select("id, username, email"),
      ]);

      if (reqRes.error) throw reqRes.error;
      if (storeRes.error) throw storeRes.error;
      if (itemsRes.error) throw itemsRes.error;

      setRequisitions(reqRes.data || []);
      const allStores = storeRes.data || [];
      setStores(isAdmin ? allStores : allStores.filter(s => accessibleStoreIds.has(s.id)));
      setInventoryItems(itemsRes.data || []);
      setProfiles(profilesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const generateReqNumber = () => {
    const date = new Date();
    const prefix = "REQ";
    const timestamp = date.getFullYear().toString().slice(-2) +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  };

  const addItemToRequisition = () => {
    if (!newRowItemId) {
      toast.error("Please select an item");
      return;
    }
    if (newRowQuantity < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }
    
    const item = inventoryItems.find(i => i.id === newRowItemId);
    if (!item) return;
    
    if (selectedItems.some(si => si.item_id === newRowItemId)) {
      toast.error("Item already added to requisition");
      return;
    }
    
    setSelectedItems(prev => [...prev, {
      item_id: item.id,
      item_name: item.name,
      quantity: newRowQuantity,
      unit: item.unit,
    }]);
    
    setNewRowItemId("");
    setNewRowQuantity(1);
  };

  const removeItemFromRequisition = (itemId: string) => {
    setSelectedItems(prev => prev.filter(i => i.item_id !== itemId));
    if (editingItemId === itemId) setEditingItemId(null);
  };

  const startEditItem = (item: RequisitionItemEntry) => {
    setEditingItemId(item.item_id);
    setEditQuantity(item.quantity);
  };

  const saveEditItem = (itemId: string) => {
    if (editQuantity < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }
    setSelectedItems(prev =>
      prev.map(i => i.item_id === itemId ? { ...i, quantity: editQuantity } : i)
    );
    setEditingItemId(null);
  };

  const cancelEdit = () => {
    setEditingItemId(null);
  };

  const onSubmit = async (data: RequisitionFormData) => {
    if (selectedItems.length === 0) {
      toast.error("Please add at least one item to the requisition");
      return;
    }
    
    try {
      const { data: reqData, error: reqError } = await supabase
        .from("requisitions")
        .insert([{
          requisition_number: generateReqNumber(),
          store_id: data.store_id,
          source_warehouse_id: null,
          requested_by: data.requested_by,
          priority: data.priority,
          notes: data.notes || null,
        }])
        .select()
        .single();
      
      if (reqError) throw reqError;
      
      const itemsToInsert = selectedItems.map(item => ({
        requisition_id: reqData.id,
        item_id: item.item_id,
        quantity_requested: item.quantity,
      }));
      
      const { error: itemsError } = await supabase
        .from("requisition_items")
        .insert(itemsToInsert);
      
      if (itemsError) throw itemsError;
      
      toast.success("Requisition created successfully");
      form.reset();
      setSelectedItems([]);
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error creating requisition:", error);
      toast.error("Failed to create requisition");
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const updates: Record<string, unknown> = { status };
      if (status === "approved") {
        updates.approved_by = "Admin";
        updates.approved_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("requisitions")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
      toast.success(`Requisition ${status}`);
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const filteredRequisitions = requisitions.filter(req => {
    const matchesSearch = req.requisition_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.requested_by.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500 text-white";
      case "approved": return "bg-green-500 text-white";
      case "rejected": return "bg-red-500 text-white";
      case "shipped": return "bg-blue-500 text-white";
      case "delivered": return "bg-primary text-primary-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800";
      case "high": return "bg-orange-100 text-orange-800";
      case "normal": return "bg-gray-100 text-gray-800";
      case "low": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Build options for SearchableSelect
  const profileOptions: SearchableSelectOption[] = profiles.map(p => ({
    value: p.username || p.email || p.id,
    label: p.username || p.email || "Unknown",
    subtitle: p.email || undefined,
  }));

  const storeOptions: SearchableSelectOption[] = stores.map(s => ({
    value: s.id,
    label: s.name,
  }));

  const inventoryItemOptions: SearchableSelectOption[] = inventoryItems
    .filter(item => !selectedItems.some(si => si.item_id === item.id))
    .map(item => ({
      value: item.id,
      label: item.name,
      subtitle: [item.sku, item.category].filter(Boolean).join(" · "),
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Requisitions</h1>
          <p className="text-muted-foreground">Stock requests from stores</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setSelectedItems([]);
            setNewRowItemId("");
            setNewRowQuantity(1);
            setEditingItemId(null);
            setShowNewRow(true);
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Requisition
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Create Stock Requisition</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col gap-0">
                {/* Scrollable form body */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-2">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="store_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Requesting Store</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={storeOptions}
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder="Select store"
                              searchPlaceholder="Search stores..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="requested_by"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Requested By</FormLabel>
                          <FormControl>
                            <SearchableSelect
                              options={profileOptions}
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder="Select user"
                              searchPlaceholder="Search users..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Redesigned Item Selection Section */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Requisition Items</h4>
                      {selectedItems.length > 0 && (
                        <span className="text-xs text-muted-foreground">{selectedItems.length} item(s)</span>
                      )}
                    </div>

                    {/* Existing items list */}
                    {selectedItems.length > 0 && (
                      <div className="border rounded-md divide-y">
                        {selectedItems.map((item) => (
                          <div key={item.item_id} className="flex items-center gap-2 px-3 py-2">
                            {editingItemId === item.item_id ? (
                              <>
                                <div className="flex-1 text-sm font-medium">{item.item_name}</div>
                                <Input
                                  type="number"
                                  className="w-20 h-8 text-sm"
                                  min={1}
                                  value={editQuantity}
                                  onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                                  autoFocus
                                />
                                <span className="text-xs text-muted-foreground w-10">{item.unit}</span>
                                <Button type="button" size="sm" variant="default" className="h-7 px-2 text-xs" onClick={() => saveEditItem(item.item_id)}>
                                  Save
                                </Button>
                                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={cancelEdit}>
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <div className="flex-1 text-sm">{item.item_name}</div>
                                <span className="text-sm font-medium w-20 text-center">{item.quantity} {item.unit}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => startEditItem(item)}
                                >
                                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => removeItemFromRequisition(item.item_id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new item row */}
                    {showNewRow && (
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground mb-1 block">Item</label>
                          <SearchableSelect
                            options={inventoryItemOptions}
                            value={newRowItemId}
                            onValueChange={setNewRowItemId}
                            placeholder="Select item..."
                            searchPlaceholder="Search inventory..."
                            emptyMessage="No items available."
                          />
                        </div>
                        <div className="w-20">
                          <label className="text-xs text-muted-foreground mb-1 block">Qty</label>
                          <Input
                            type="number"
                            min={1}
                            value={newRowQuantity}
                            onChange={(e) => setNewRowQuantity(parseInt(e.target.value) || 1)}
                            className="h-10"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          onClick={addItemToRequisition}
                          title="Add item"
                        >
                          <PlusCircle className="h-5 w-5" />
                        </Button>
                      </div>
                    )}

                    {selectedItems.length === 0 && !newRowItemId && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Select an item and quantity above, then click + to add.
                      </p>
                    )}
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional notes..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Fixed footer */}
                <div className="flex-shrink-0 pt-4 border-t mt-2">
                  <Button type="submit" className="w-full" disabled={selectedItems.length === 0}>
                    Create Requisition ({selectedItems.length} items)
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requisitions</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requisitions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {requisitions.filter(r => r.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {requisitions.filter(r => r.status === 'approved').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {requisitions.filter(r => r.status === 'shipped').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search requisitions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requisition #</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredRequisitions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No requisitions found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequisitions.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono font-medium">{req.requisition_number}</TableCell>
                    <TableCell>{req.stores?.name || '-'}</TableCell>
                    <TableCell>
                      {req.requisition_items && req.requisition_items.length > 0 ? (
                        <div className="text-sm">
                          <span className="font-medium">{req.requisition_items.length} items</span>
                          <div className="text-muted-foreground text-xs max-w-48 truncate">
                            {req.requisition_items.slice(0, 2).map(i => i.inventory_items?.name).join(', ')}
                            {req.requisition_items.length > 2 && '...'}
                          </div>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{req.requested_by}</TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(req.priority)}>
                        {req.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(req.requested_at), 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(req.status)}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {req.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => updateStatus(req.id, 'approved')}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(req.id, 'rejected')}>
                            Reject
                          </Button>
                        </div>
                      )}
                      {req.status === 'approved' && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(req.id, 'shipped')}>
                          Mark Shipped
                        </Button>
                      )}
                      {req.status === 'shipped' && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(req.id, 'delivered')}>
                          Mark Delivered
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
