import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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

interface LineItem {
  id: string;
  grn_id: string;
  inventory_item_id: string | null;
  item_name: string;
  expected_quantity: number;
  received_quantity: number;
  accepted_quantity: number;
  rejected_quantity: number;
  rejection_reason: string | null;
  qa_status: string;
  notes: string | null;
}

interface InventoryItem {
  id: string;
  name: string;
}

interface Props {
  grnId: string;
  grnStatus: string;
  storeId: string;
  onItemsChanged?: () => void;
}

export function GRNLineItemsSection({ grnId, grnStatus, storeId, onItemsChanged }: Props) {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingItem, setAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({
    inventory_item_id: "",
    item_name: "",
    expected_quantity: 0,
    received_quantity: 0,
  });

  const isEditable = ["pending", "qa_in_progress"].includes(grnStatus);

  useEffect(() => {
    fetchData();
  }, [grnId]);

  const fetchData = async () => {
    try {
      const { data: lineData, error: lineError } = await supabase
        .from("grn_line_items")
        .select("*")
        .eq("grn_id", grnId);
      
      if (lineError) throw lineError;
      setLineItems((lineData || []) as unknown as LineItem[]);

      // Fetch inventory items for linking - use separate query to avoid deep type
      const invQuery = supabase.from("inventory_items" as any).select("id, name").eq("store_id", storeId);
      const { data: invData, error: invError } = await (invQuery as any);
      
      if (invError) throw invError;
      setInventoryItems((invData || []) as InventoryItem[]);
    } catch (error) {
      console.error("Error fetching line items:", error);
    } finally {
      setLoading(false);
    }
  };

  const addLineItem = async () => {
    try {
      const itemName = newItem.item_name || 
        inventoryItems.find(i => i.id === newItem.inventory_item_id)?.name || 
        "Unknown Item";

      const { error } = await supabase.from("grn_line_items").insert([{
        grn_id: grnId,
        inventory_item_id: newItem.inventory_item_id || null,
        item_name: itemName,
        expected_quantity: newItem.expected_quantity,
        received_quantity: newItem.received_quantity,
      }]);

      if (error) throw error;
      toast.success("Line item added");
      setNewItem({ inventory_item_id: "", item_name: "", expected_quantity: 0, received_quantity: 0 });
      setAddingItem(false);
      fetchData();
      onItemsChanged?.();
    } catch (error) {
      console.error("Error adding line item:", error);
      toast.error("Failed to add line item");
    }
  };

  const updateLineItemQA = async (
    itemId: string,
    accepted: number,
    rejected: number,
    reason: string,
    status: string
  ) => {
    try {
      const { error } = await supabase
        .from("grn_line_items")
        .update({
          accepted_quantity: accepted,
          rejected_quantity: rejected,
          rejection_reason: reason || null,
          qa_status: status,
        })
        .eq("id", itemId);

      if (error) throw error;
      fetchData();
      onItemsChanged?.();
    } catch (error) {
      console.error("Error updating line item:", error);
      toast.error("Failed to update line item");
    }
  };

  const deleteLineItem = async (itemId: string) => {
    try {
      const { error } = await supabase.from("grn_line_items").delete().eq("id", itemId);
      if (error) throw error;
      toast.success("Line item removed");
      fetchData();
      onItemsChanged?.();
    } catch (error) {
      toast.error("Failed to remove line item");
    }
  };

  const getQAStatusColor = (status: string) => {
    switch (status) {
      case "passed": return "bg-green-500 text-white";
      case "failed": return "bg-red-500 text-white";
      case "partial": return "bg-yellow-500 text-white";
      case "on_hold": return "bg-orange-500 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading line items...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-lg">Line Items</h3>
        {isEditable && (
          <Button size="sm" variant="outline" onClick={() => setAddingItem(!addingItem)}>
            <Plus className="mr-1 h-4 w-4" /> Add Item
          </Button>
        )}
      </div>

      {addingItem && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Inventory Item (optional)</label>
              <Select
                value={newItem.inventory_item_id}
                onValueChange={(v) => {
                  const item = inventoryItems.find(i => i.id === v);
                  setNewItem(prev => ({
                    ...prev,
                    inventory_item_id: v,
                    item_name: item?.name || prev.item_name,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {inventoryItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Item Name</label>
              <Input
                value={newItem.item_name}
                onChange={(e) => setNewItem(prev => ({ ...prev, item_name: e.target.value }))}
                placeholder="Item name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Expected Qty</label>
              <Input
                type="number"
                min={0}
                value={newItem.expected_quantity}
                onChange={(e) => setNewItem(prev => ({ ...prev, expected_quantity: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Received Qty</label>
              <Input
                type="number"
                min={0}
                value={newItem.received_quantity}
                onChange={(e) => setNewItem(prev => ({ ...prev, received_quantity: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addLineItem}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setAddingItem(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-center">Expected</TableHead>
            <TableHead className="text-center">Received</TableHead>
            <TableHead className="text-center">Accepted</TableHead>
            <TableHead className="text-center">Rejected</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>QA Status</TableHead>
            {isEditable && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={isEditable ? 8 : 7} className="text-center text-muted-foreground py-6">
                No line items added yet.
              </TableCell>
            </TableRow>
          ) : (
            lineItems.map((item) => (
              <LineItemRow
                key={item.id}
                item={item}
                editable={isEditable}
                onUpdate={updateLineItemQA}
                onDelete={deleteLineItem}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function LineItemRow({
  item,
  editable,
  onUpdate,
  onDelete,
}: {
  item: LineItem;
  editable: boolean;
  onUpdate: (id: string, accepted: number, rejected: number, reason: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const [accepted, setAccepted] = useState(item.accepted_quantity);
  const [rejected, setRejected] = useState(item.rejected_quantity);
  const [reason, setReason] = useState(item.rejection_reason || "");
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    let status = "pending";
    if (accepted === item.received_quantity && rejected === 0) status = "passed";
    else if (accepted === 0 && rejected > 0) status = "failed";
    else if (accepted > 0 && rejected > 0) status = "partial";

    onUpdate(item.id, accepted, rejected, reason, status);
    setEditing(false);
  };

  const getQAStatusColor = (status: string) => {
    switch (status) {
      case "passed": return "bg-green-500 text-white";
      case "failed": return "bg-red-500 text-white";
      case "partial": return "bg-yellow-500 text-white";
      case "on_hold": return "bg-orange-500 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{item.item_name}</TableCell>
      <TableCell className="text-center">{item.expected_quantity}</TableCell>
      <TableCell className="text-center">{item.received_quantity}</TableCell>
      <TableCell className="text-center">
        {editing ? (
          <Input
            type="number"
            min={0}
            max={item.received_quantity}
            value={accepted}
            onChange={(e) => setAccepted(parseInt(e.target.value) || 0)}
            className="w-20 mx-auto"
          />
        ) : (
          item.accepted_quantity
        )}
      </TableCell>
      <TableCell className="text-center">
        {editing ? (
          <Input
            type="number"
            min={0}
            max={item.received_quantity}
            value={rejected}
            onChange={(e) => setRejected(parseInt(e.target.value) || 0)}
            className="w-20 mx-auto"
          />
        ) : (
          item.rejected_quantity
        )}
      </TableCell>
      <TableCell>
        {editing ? (
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection"
            className="w-40"
          />
        ) : (
          item.rejection_reason || "-"
        )}
      </TableCell>
      <TableCell>
        <Badge className={getQAStatusColor(item.qa_status)}>
          {item.qa_status.replace("_", " ")}
        </Badge>
      </TableCell>
      {editable && (
        <TableCell>
          <div className="flex gap-1">
            {editing ? (
              <>
                <Button size="sm" variant="outline" onClick={handleSave}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>QA</Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(item.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
