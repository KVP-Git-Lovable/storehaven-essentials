import { useState, useEffect } from "react";
import { Plus, Loader2, Gauge } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type MeterMaster = {
  id: string;
  name: string;
  reading_parameter_count: number;
  reading_parameters: string[];
  details_to_capture: string;
};

type UtilityReading = {
  id: string;
  store: string;
  meter_master_id: string;
  asset_id: string | null;
  reading_date: string;
  readings: Record<string, number>;
  created_by: string;
  created_at: string;
  meter_master?: MeterMaster;
};

type Asset = {
  id: string;
  name: string;
  asset_number: string | null;
};

type StoreUtilitiesTabProps = {
  storeId: string;
  storeName: string;
  deployedAssetIds: string[];
};

export function StoreUtilitiesTab({ storeId, storeName, deployedAssetIds }: StoreUtilitiesTabProps) {
  const [readings, setReadings] = useState<UtilityReading[]>([]);
  const [meterMasters, setMeterMasters] = useState<MeterMaster[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    meter_master_id: "",
    asset_id: "",
    reading_date: format(new Date(), "yyyy-MM-dd"),
    readings: {} as Record<string, number>,
  });
  const [selectedMeterMaster, setSelectedMeterMaster] = useState<MeterMaster | null>(null);

  useEffect(() => {
    fetchData();
  }, [storeId]);

  const fetchData = async () => {
    setLoading(true);
    const [readingsRes, mastersRes, assetsRes] = await Promise.all([
      supabase.from("utility_readings").select("*").eq("store", storeName).order("reading_date", { ascending: false }),
      supabase.from("meter_masters").select("*").order("name"),
      supabase.from("assets").select("id, name, asset_number").in("id", deployedAssetIds.length > 0 ? deployedAssetIds : ["none"]).order("name"),
    ]);

    const mastersMap = new Map((mastersRes.data || []).map(m => [m.id, m]));
    const enrichedReadings = (readingsRes.data || []).map(r => ({
      ...r,
      readings: r.readings as Record<string, number>,
      meter_master: mastersMap.get(r.meter_master_id),
    }));
    setReadings(enrichedReadings);
    setMeterMasters(mastersRes.data || []);
    setAssets(assetsRes.data || []);
    setLoading(false);
  };

  const handleMeterMasterChange = (id: string) => {
    const master = meterMasters.find(m => m.id === id);
    setSelectedMeterMaster(master || null);
    setFormData(prev => ({ ...prev, meter_master_id: id, readings: {} }));
  };

  const getReadingFields = (master: MeterMaster | null) => {
    if (!master) return [];
    const fields: { key: string; label: string }[] = [];
    master.reading_parameters.forEach((param) => {
      if (master.details_to_capture === "Start") {
        fields.push({ key: `${param}_start`, label: `${param} Day Start Reading` });
      } else if (master.details_to_capture === "End") {
        fields.push({ key: `${param}_end`, label: `${param} Day End Reading` });
      } else if (master.details_to_capture === "Both") {
        fields.push({ key: `${param}_start`, label: `${param} Day Start Reading` });
        fields.push({ key: `${param}_end`, label: `${param} Day End Reading` });
      }
    });
    return fields;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.meter_master_id || !formData.reading_date) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("utility_readings").insert({
      store: storeName,
      meter_master_id: formData.meter_master_id,
      asset_id: formData.asset_id || null,
      reading_date: formData.reading_date,
      readings: formData.readings,
      created_by: "Current User",
      last_modified_by: "Current User",
    });

    if (error) {
      toast({ title: "Error", description: "Failed to save reading", variant: "destructive" });
    } else {
      toast({ title: "Reading recorded" });
      resetForm();
      setOpen(false);
      fetchData();
    }
  };

  const resetForm = () => {
    setFormData({
      meter_master_id: "",
      asset_id: "",
      reading_date: format(new Date(), "yyyy-MM-dd"),
      readings: {},
    });
    setSelectedMeterMaster(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Utility Readings</h2>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Reading</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Utility Reading</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Utility Type (Meter Master) *</Label>
                  <Select value={formData.meter_master_id} onValueChange={handleMeterMasterChange}>
                    <SelectTrigger><SelectValue placeholder="Select meter type" /></SelectTrigger>
                    <SelectContent>
                      {meterMasters.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reading Date *</Label>
                  <Input type="date" value={formData.reading_date} max={format(new Date(), "yyyy-MM-dd")}
                    onChange={(e) => setFormData(prev => ({ ...prev, reading_date: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Asset (Optional - for deployed assets)</Label>
                <Select value={formData.asset_id || "_none"} onValueChange={(v) => setFormData(prev => ({ ...prev, asset_id: v === "_none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">General Store Reading</SelectItem>
                    {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.asset_number ? `${a.asset_number} - ` : ""}{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {selectedMeterMaster && (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-medium">Reading Parameters</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {getReadingFields(selectedMeterMaster).map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label>{field.label}</Label>
                        <Input type="number" placeholder="Enter reading"
                          value={formData.readings[field.key] || ""}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            readings: { ...prev.readings, [field.key]: parseFloat(e.target.value) || 0 }
                          }))} />
                      </div>
                    ))}
                  </div>

                  {/* Consumption Preview Section */}
                  {selectedMeterMaster.reading_parameters.includes("KWH") && 
                   selectedMeterMaster.details_to_capture === "Both" && (
                    <div className="space-y-3 pt-4 border-t bg-muted/30 p-4 rounded-lg">
                      <h4 className="font-medium text-sm">Consumption Preview (End - Start)</h4>
                      <div className="grid grid-cols-3 gap-4">
                        {selectedMeterMaster.reading_parameters.map((param) => {
                          const startVal = formData.readings[`${param}_start`] || 0;
                          const endVal = formData.readings[`${param}_end`] || 0;
                          const consumption = endVal - startVal;
                          return (
                            <div key={param} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{param} Consumption</Label>
                              <div className="text-lg font-semibold">{consumption.toFixed(2)}</div>
                            </div>
                          );
                        })}
                        
                        {/* Consumed Units = (KWH End - KWH Start) x 7500 */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Consumed Units</Label>
                          <div className="text-lg font-semibold">
                            {(((formData.readings["KWH_end"] || 0) - (formData.readings["KWH_start"] || 0)) * 7500).toFixed(2)}
                          </div>
                        </div>
                        
                        {/* Power Factor = KWH / KVAH */}
                        {selectedMeterMaster.reading_parameters.includes("KVAH") && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Power Factor</Label>
                            <div className="text-lg font-semibold">
                              {(() => {
                                const kwhConsumption = (formData.readings["KWH_end"] || 0) - (formData.readings["KWH_start"] || 0);
                                const kvahConsumption = (formData.readings["KVAH_end"] || 0) - (formData.readings["KVAH_start"] || 0);
                                if (kvahConsumption === 0) return "—";
                                return (kwhConsumption / kvahConsumption).toFixed(3);
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                <Button type="submit">Save Reading</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Meter Type</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Readings</TableHead>
              <TableHead>Recorded By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {readings.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No utility readings recorded</TableCell></TableRow>
            ) : (
              readings.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{format(new Date(r.reading_date), "PP")}</TableCell>
                  <TableCell><Badge variant="outline"><Gauge className="h-3 w-3 mr-1" />{r.meter_master?.name || "-"}</Badge></TableCell>
                  <TableCell>{assets.find(a => a.id === r.asset_id)?.name || "-"}</TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(r.readings).map(([key, val]) => (
                        <Badge key={key} variant="secondary" className="text-xs">{key}: {val}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{r.created_by}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
