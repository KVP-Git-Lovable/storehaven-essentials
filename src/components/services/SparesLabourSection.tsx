import { useState, useEffect } from "react";
import { Plus, Trash2, Package, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SpareItem = {
  id: string;
  inventory_item_id: string | null;
  asset_master_id: string | null;
  spare_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  is_covered_by_contract: boolean;
  is_billable: boolean;
  notes: string | null;
};

type LabourItem = {
  id: string;
  description: string;
  total_cost: number;
  is_covered_by_contract: boolean;
  is_billable: boolean;
  notes: string | null;
};

type AssetMasterSpare = {
  id: string;
  name: string;
};

type InventoryItem = {
  id: string;
  name: string;
  unit_cost: number;
  asset_master_id: string | null;
};

type ContractCoverage = {
  spares_covered: boolean;
  labour_covered: boolean;
};

interface SparesLabourSectionProps {
  entityType: "ticket" | "maintenance";
  entityId: string;
  contractCoverage: ContractCoverage | null;
  readOnly?: boolean;
}

export function SparesLabourSection({
  entityType,
  entityId,
  contractCoverage,
  readOnly = false,
}: SparesLabourSectionProps) {
  const [spares, setSpares] = useState<SpareItem[]>([]);
  const [labour, setLabour] = useState<LabourItem[]>([]);
  const [assetMasterSpares, setAssetMasterSpares] = useState<AssetMasterSpare[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New spare form state
  const [selectedAssetMasterId, setSelectedAssetMasterId] = useState<string>("");
  const [spareQuantity, setSpareQuantity] = useState(1);
  const [spareUnitCost, setSpareUnitCost] = useState(0);

  // New labour form state
  const [labourCost, setLabourCost] = useState(0);

  useEffect(() => {
    fetchData();
  }, [entityId, entityType]);

  const fetchData = async () => {
    setLoading(true);

    let sparesData: SpareItem[] = [];
    let labourData: LabourItem[] = [];

    // Fetch spares and labour based on entity type
    if (entityType === "ticket") {
      const [sparesRes, labourRes] = await Promise.all([
        supabase
          .from("service_ticket_spares")
          .select("*")
          .eq("ticket_id", entityId)
          .order("created_at"),
        supabase
          .from("service_ticket_labour")
          .select("*")
          .eq("ticket_id", entityId)
          .order("created_at"),
      ]);
      sparesData = (sparesRes.data as SpareItem[]) || [];
      labourData = (labourRes.data as LabourItem[]) || [];
    } else {
      const [sparesRes, labourRes] = await Promise.all([
        supabase
          .from("maintenance_task_spares")
          .select("*")
          .eq("task_id", entityId)
          .order("created_at"),
        supabase
          .from("maintenance_task_labour")
          .select("*")
          .eq("task_id", entityId)
          .order("created_at"),
      ]);
      sparesData = (sparesRes.data as SpareItem[]) || [];
      labourData = (labourRes.data as LabourItem[]) || [];
    }

    // Fetch asset masters for dropdown
    const { data: assetMastersData } = await supabase
      .from("asset_masters")
      .select("id, name")
      .eq("status", "active")
      .order("name");

    // Fetch inventory items that are spares (linked to asset_master)
    const { data: inventoryData } = await supabase
      .from("inventory_items")
      .select("id, name, unit_cost, asset_master_id")
      .eq("status", "active")
      .not("asset_master_id", "is", null)
      .order("name");

    setSpares(sparesData);
    setLabour(labourData);
    setAssetMasterSpares(assetMastersData || []);
    setInventoryItems(inventoryData || []);
    setLoading(false);
  };

  const handleAddSpare = async () => {
    if (!selectedAssetMasterId) {
      toast.error("Please select a spare item");
      return;
    }

    const selectedMaster = assetMasterSpares.find((m) => m.id === selectedAssetMasterId);
    if (!selectedMaster) return;

    // Check if there's an inventory item for this asset master with a rate
    const inventoryItem = inventoryItems.find((i) => i.asset_master_id === selectedAssetMasterId);
    const finalCost = spareUnitCost > 0 ? spareUnitCost : inventoryItem?.unit_cost || 0;

    const isCoveredByContract = contractCoverage?.spares_covered || false;

    let error;
    if (entityType === "ticket") {
      const { error: err } = await supabase.from("service_ticket_spares").insert({
        ticket_id: entityId,
        asset_master_id: selectedAssetMasterId,
        inventory_item_id: inventoryItem?.id || null,
        spare_name: selectedMaster.name,
        quantity: spareQuantity,
        unit_cost: finalCost,
        is_covered_by_contract: isCoveredByContract,
        is_billable: !isCoveredByContract,
      });
      error = err;
    } else {
      const { error: err } = await supabase.from("maintenance_task_spares").insert({
        task_id: entityId,
        asset_master_id: selectedAssetMasterId,
        inventory_item_id: inventoryItem?.id || null,
        spare_name: selectedMaster.name,
        quantity: spareQuantity,
        unit_cost: finalCost,
        is_covered_by_contract: isCoveredByContract,
        is_billable: !isCoveredByContract,
      });
      error = err;
    }

    if (error) {
      toast.error("Failed to add spare");
      console.error(error);
    } else {
      toast.success("Spare added");
      setSelectedAssetMasterId("");
      setSpareQuantity(1);
      setSpareUnitCost(0);
      fetchData();
    }
  };

  const handleDeleteSpare = async (id: string) => {
    let error;
    if (entityType === "ticket") {
      const { error: err } = await supabase.from("service_ticket_spares").delete().eq("id", id);
      error = err;
    } else {
      const { error: err } = await supabase.from("maintenance_task_spares").delete().eq("id", id);
      error = err;
    }

    if (error) {
      toast.error("Failed to delete spare");
    } else {
      toast.success("Spare removed");
      fetchData();
    }
  };

  const handleAddLabour = async () => {
    if (labourCost <= 0) {
      toast.error("Please enter a labour cost");
      return;
    }

    const isCoveredByContract = contractCoverage?.labour_covered || false;

    let error;
    if (entityType === "ticket") {
      const { error: err } = await supabase.from("service_ticket_labour").insert({
        ticket_id: entityId,
        description: "Labour",
        total_cost: labourCost,
        is_covered_by_contract: isCoveredByContract,
        is_billable: !isCoveredByContract,
      });
      error = err;
    } else {
      const { error: err } = await supabase.from("maintenance_task_labour").insert({
        task_id: entityId,
        description: "Labour",
        total_cost: labourCost,
        is_covered_by_contract: isCoveredByContract,
        is_billable: !isCoveredByContract,
      });
      error = err;
    }

    if (error) {
      toast.error("Failed to add labour cost");
      console.error(error);
    } else {
      toast.success("Labour cost added");
      setLabourCost(0);
      fetchData();
    }
  };

  const handleDeleteLabour = async (id: string) => {
    let error;
    if (entityType === "ticket") {
      const { error: err } = await supabase.from("service_ticket_labour").delete().eq("id", id);
      error = err;
    } else {
      const { error: err } = await supabase.from("maintenance_task_labour").delete().eq("id", id);
      error = err;
    }

    if (error) {
      toast.error("Failed to delete labour cost");
    } else {
      toast.success("Labour cost removed");
      fetchData();
    }
  };

  // Calculate totals
  const sparesTotal = spares.reduce((sum, s) => sum + s.total_cost, 0);
  const sparesBillable = spares.filter((s) => s.is_billable).reduce((sum, s) => sum + s.total_cost, 0);
  const labourTotal = labour.reduce((sum, l) => sum + l.total_cost, 0);
  const labourBillable = labour.filter((l) => l.is_billable).reduce((sum, l) => sum + l.total_cost, 0);

  // When asset master is selected, check for inventory rate
  const handleAssetMasterSelect = (masterId: string) => {
    setSelectedAssetMasterId(masterId);
    const inventoryItem = inventoryItems.find((i) => i.asset_master_id === masterId);
    if (inventoryItem?.unit_cost) {
      setSpareUnitCost(inventoryItem.unit_cost);
    } else {
      setSpareUnitCost(0);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Spares Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Spares Used
            {contractCoverage?.spares_covered && (
              <Badge variant="secondary" className="text-xs">Covered by Contract</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {spares.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Spare</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  {!readOnly && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {spares.map((spare) => (
                  <TableRow key={spare.id}>
                    <TableCell className="font-medium">{spare.spare_name}</TableCell>
                    <TableCell className="text-right">{spare.quantity}</TableCell>
                    <TableCell className="text-right">₹{spare.unit_cost.toFixed(2)}</TableCell>
                    <TableCell className="text-right">₹{spare.total_cost.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={spare.is_billable ? "default" : "outline"}>
                        {spare.is_billable ? "Billable" : "Covered"}
                      </Badge>
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDeleteSpare(spare.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!readOnly && (
            <div className="flex items-end gap-2 pt-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Spare Item</label>
                <Select value={selectedAssetMasterId} onValueChange={handleAssetMasterSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select spare..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assetMasterSpares.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-20">
                <label className="text-xs text-muted-foreground mb-1 block">Qty</label>
                <Input
                  type="number"
                  min={1}
                  value={spareQuantity}
                  onChange={(e) => setSpareQuantity(Number(e.target.value))}
                />
              </div>
              <div className="w-28">
                <label className="text-xs text-muted-foreground mb-1 block">Rate (₹)</label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={spareUnitCost}
                  onChange={(e) => setSpareUnitCost(Number(e.target.value))}
                />
              </div>
              <Button size="sm" onClick={handleAddSpare}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          {spares.length > 0 && (
            <div className="flex justify-end gap-4 text-sm pt-2 border-t">
              <span className="text-muted-foreground">Total: ₹{sparesTotal.toFixed(2)}</span>
              <span className="font-medium">Billable: ₹{sparesBillable.toFixed(2)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Labour Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Labour Cost
            {contractCoverage?.labour_covered && (
              <Badge variant="secondary" className="text-xs">Covered by Contract</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {labour.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Status</TableHead>
                  {!readOnly && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {labour.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.description}</TableCell>
                    <TableCell className="text-right">₹{item.total_cost.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={item.is_billable ? "default" : "outline"}>
                        {item.is_billable ? "Billable" : "Covered"}
                      </Badge>
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDeleteLabour(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!readOnly && (
            <div className="flex items-end gap-2 pt-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Labour Cost (₹)</label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="Enter labour cost"
                  value={labourCost || ""}
                  onChange={(e) => setLabourCost(Number(e.target.value))}
                />
              </div>
              <Button size="sm" onClick={handleAddLabour}>
                <Plus className="h-4 w-4 mr-1" />
                Add Labour
              </Button>
            </div>
          )}

          {labour.length > 0 && (
            <div className="flex justify-end gap-4 text-sm pt-2 border-t">
              <span className="text-muted-foreground">Total: ₹{labourTotal.toFixed(2)}</span>
              <span className="font-medium">Billable: ₹{labourBillable.toFixed(2)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grand Total */}
      {(spares.length > 0 || labour.length > 0) && (
        <div className="flex justify-end gap-6 text-sm font-medium p-3 bg-muted/50 rounded-lg">
          <span>
            Grand Total: ₹{(sparesTotal + labourTotal).toFixed(2)}
          </span>
          <span className="text-primary">
            Total Billable: ₹{(sparesBillable + labourBillable).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
