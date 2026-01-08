import { useState, useEffect } from "react";
import { Plus, Gauge, Zap, Droplets, Fuel, Loader2, Pencil, Trash2, Save, X } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";

type Store = {
  id: string;
  name: string;
};

type Asset = {
  id: string;
  name: string;
  asset_number: string | null;
};

const chartData = [
  { month: "Jan", power: 4200, water: 850, generator: 120 },
  { month: "Feb", power: 3800, water: 920, generator: 95 },
  { month: "Mar", power: 4500, water: 780, generator: 150 },
  { month: "Apr", power: 5200, water: 1100, generator: 180 },
  { month: "May", power: 5800, water: 1250, generator: 220 },
  { month: "Jun", power: 6100, water: 1400, generator: 280 },
];

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
  last_modified_by: string;
  last_modified_at: string;
  meter_master?: MeterMaster;
};

const stats = [
  { title: "Total Power (kWh)", value: "5,800", change: "+12% from last month", changeType: "negative" as const, icon: Zap, iconColor: "bg-warning/10 text-warning" },
  { title: "Water (KL)", value: "205", change: "-5% from last month", changeType: "positive" as const, icon: Droplets, iconColor: "bg-info/10 text-info" },
  { title: "Generator (Hours)", value: "62", change: "+8% from last month", changeType: "negative" as const, icon: Fuel, iconColor: "bg-destructive/10 text-destructive" },
  { title: "Monthly Cost", value: "₹2.8L", change: "+4% from last month", changeType: "negative" as const, icon: Gauge, iconColor: "bg-primary/10 text-primary" },
];

export default function Utilities() {
  const [readings, setReadings] = useState<UtilityReading[]>([]);
  const [meterMasters, setMeterMasters] = useState<MeterMaster[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedReading, setSelectedReading] = useState<UtilityReading | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    store: "",
    meter_master_id: "",
    asset_id: "",
    reading_date: format(new Date(), "yyyy-MM-dd"),
    readings: {} as Record<string, number>,
  });

  const [selectedMeterMaster, setSelectedMeterMaster] = useState<MeterMaster | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [readingsRes, mastersRes, storesRes, assetsRes] = await Promise.all([
      supabase.from("utility_readings").select("*").order("created_at", { ascending: false }),
      supabase.from("meter_masters").select("*").order("name"),
      supabase.from("stores").select("id, name").order("name"),
      supabase.from("assets").select("id, name, asset_number").order("name"),
    ]);

    if (storesRes.error) {
      toast({ title: "Error", description: "Failed to load stores", variant: "destructive" });
    } else {
      setStores(storesRes.data || []);
    }

    setAssets(assetsRes.data || []);

    if (readingsRes.error) {
      toast({ title: "Error", description: "Failed to load readings", variant: "destructive" });
    } else {
      // Map meter masters to readings
      const mastersMap = new Map((mastersRes.data || []).map(m => [m.id, m]));
      const enrichedReadings = (readingsRes.data || []).map(r => ({
        ...r,
        readings: r.readings as Record<string, number>,
        meter_master: mastersMap.get(r.meter_master_id),
      }));
      setReadings(enrichedReadings);
    }

    if (mastersRes.error) {
      toast({ title: "Error", description: "Failed to load meter masters", variant: "destructive" });
    } else {
      setMeterMasters(mastersRes.data || []);
    }
    setLoading(false);
  };

  const handleMeterMasterChange = (id: string) => {
    const master = meterMasters.find(m => m.id === id);
    setSelectedMeterMaster(master || null);
    setFormData(prev => ({
      ...prev,
      meter_master_id: id,
      readings: {},
    }));
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

  const calculateConsumption = (readings: Record<string, number>, master: MeterMaster | null) => {
    if (!master || master.details_to_capture !== "Both") return null;
    
    const consumptions: { param: string; value: number }[] = [];
    master.reading_parameters.forEach((param) => {
      const start = readings[`${param}_start`] || 0;
      const end = readings[`${param}_end`] || 0;
      consumptions.push({ param, value: end - start });
    });
    
    return consumptions;
  };

  const validateDate = (dateStr: string): boolean => {
    const selectedDate = new Date(dateStr);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return selectedDate <= today;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.store || !formData.meter_master_id || !formData.reading_date) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    if (!validateDate(formData.reading_date)) {
      toast({ title: "Error", description: "Future dates are not allowed", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("utility_readings").insert({
      store: formData.store,
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
      toast({ title: "Reading recorded", description: `Utility reading has been saved.` });
      resetForm();
      setOpen(false);
      fetchData();
    }
  };

  const handleUpdate = async () => {
    if (!selectedReading) return;

    if (!validateDate(formData.reading_date)) {
      toast({ title: "Error", description: "Future dates are not allowed", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("utility_readings")
      .update({
        store: formData.store,
        meter_master_id: formData.meter_master_id,
        asset_id: formData.asset_id || null,
        reading_date: formData.reading_date,
        readings: formData.readings,
        last_modified_by: "Current User",
        last_modified_at: new Date().toISOString(),
      })
      .eq("id", selectedReading.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update reading", variant: "destructive" });
    } else {
      toast({ title: "Reading updated", description: `Utility reading has been updated.` });
      setIsEditing(false);
      setViewOpen(false);
      fetchData();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase.from("utility_readings").delete().eq("id", deleteId);

    if (error) {
      toast({ title: "Error", description: "Failed to delete reading", variant: "destructive" });
    } else {
      toast({ title: "Reading deleted", description: "Utility reading has been deleted." });
      setDeleteId(null);
      setViewOpen(false);
      fetchData();
    }
  };

  const resetForm = () => {
    setFormData({
      store: "",
      meter_master_id: "",
      asset_id: "",
      reading_date: format(new Date(), "yyyy-MM-dd"),
      readings: {},
    });
    setSelectedMeterMaster(null);
  };

  const openViewDialog = (reading: UtilityReading) => {
    setSelectedReading(reading);
    setFormData({
      store: reading.store,
      meter_master_id: reading.meter_master_id,
      asset_id: reading.asset_id || "",
      reading_date: reading.reading_date,
      readings: reading.readings,
    });
    const master = meterMasters.find(m => m.id === reading.meter_master_id);
    setSelectedMeterMaster(master || null);
    setIsEditing(false);
    setViewOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Utilities Monitoring</h1>
          <p className="text-muted-foreground">Track utility consumption based on meter masters</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Reading
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Utility Reading</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Store *</Label>
                  <Select value={formData.store} onValueChange={(v) => setFormData(prev => ({ ...prev, store: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select store" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.name}>{store.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Utility Type (Meter Master) *</Label>
                  <Select value={formData.meter_master_id} onValueChange={handleMeterMasterChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select meter type" />
                    </SelectTrigger>
                    <SelectContent>
                      {meterMasters.map((master) => (
                        <SelectItem key={master.id} value={master.id}>{master.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Asset (Optional)</Label>
                  <Select value={formData.asset_id || "none"} onValueChange={(v) => setFormData(prev => ({ ...prev, asset_id: v === "none" ? "" : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {assets.map((asset) => (
                        <SelectItem key={asset.id} value={asset.id}>
                          {asset.asset_number ? `${asset.asset_number} - ` : ""}{asset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reading Date *</Label>
                  <Input
                    type="date"
                    value={formData.reading_date}
                    max={format(new Date(), "yyyy-MM-dd")}
                    onChange={(e) => setFormData(prev => ({ ...prev, reading_date: e.target.value }))}
                  />
                </div>
              </div>

              {selectedMeterMaster && (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-medium">Reading Parameters</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {getReadingFields(selectedMeterMaster).map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label>{field.label}</Label>
                        <Input
                          type="number"
                          placeholder="Enter reading"
                          value={formData.readings[field.key] || ""}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            readings: { ...prev.readings, [field.key]: parseFloat(e.target.value) || 0 }
                          }))}
                        />
                      </div>
                    ))}
                  </div>
                  
                  {/* Live Consumption Calculation */}
                  {selectedMeterMaster.details_to_capture === "Both" && (
                    <div className="pt-4">
                      <h4 className="font-medium text-sm mb-2">Consumption Preview (End - Start)</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {calculateConsumption(formData.readings, selectedMeterMaster)?.map((c) => (
                          <div key={c.param} className="p-2 bg-primary/10 rounded text-sm">
                            <span className="text-muted-foreground">{c.param}:</span>
                            <span className="font-medium ml-2">{c.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button type="submit">
                  <Save className="h-4 w-4 mr-2" />
                  Save Reading
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="stat-card">
        <h3 className="font-semibold mb-4">Consumption Trends</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="power" stroke="hsl(var(--warning))" strokeWidth={2} name="Power (kWh)" />
              <Line type="monotone" dataKey="water" stroke="hsl(var(--info))" strokeWidth={2} name="Water (KL)" />
              <Line type="monotone" dataKey="generator" stroke="hsl(var(--destructive))" strokeWidth={2} name="Generator (hrs)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Latest Readings</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead>Meter Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No readings found. Add a reading to get started.
                  </TableCell>
                </TableRow>
              ) : (
                readings.map((reading) => (
                  <TableRow key={reading.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openViewDialog(reading)}>
                    <TableCell className="font-medium">{reading.store}</TableCell>
                    <TableCell>{reading.meter_master?.name || "Unknown"}</TableCell>
                    <TableCell>{new Date(reading.reading_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openViewDialog(reading); setIsEditing(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(reading.id); }}>
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
      </div>

      {/* View/Edit Dialog */}
      <Dialog open={viewOpen} onOpenChange={(o) => { setViewOpen(o); if (!o) { setIsEditing(false); setSelectedReading(null); } }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Utility Reading" : "View Utility Reading"}</DialogTitle>
          </DialogHeader>
          
          {selectedReading && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Store</Label>
                  {isEditing ? (
                    <Select value={formData.store} onValueChange={(v) => setFormData(prev => ({ ...prev, store: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select store" />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map((store) => (
                          <SelectItem key={store.id} value={store.name}>{store.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">{formData.store}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Utility Type (Meter Master)</Label>
                  {isEditing ? (
                    <Select value={formData.meter_master_id} onValueChange={handleMeterMasterChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select meter type" />
                      </SelectTrigger>
                      <SelectContent>
                        {meterMasters.map((master) => (
                          <SelectItem key={master.id} value={master.id}>{master.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">{selectedReading.meter_master?.name || "Unknown"}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reading Date</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={formData.reading_date}
                    max={format(new Date(), "yyyy-MM-dd")}
                    onChange={(e) => setFormData(prev => ({ ...prev, reading_date: e.target.value }))}
                  />
                ) : (
                  <p className="text-sm p-2 bg-muted rounded">{new Date(formData.reading_date).toLocaleDateString()}</p>
                )}
              </div>

              {selectedMeterMaster && (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-medium">Reading Parameters</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {getReadingFields(selectedMeterMaster).map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label>{field.label}</Label>
                        {isEditing ? (
                          <Input
                            type="number"
                            placeholder="Enter reading"
                            value={formData.readings[field.key] || ""}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              readings: { ...prev.readings, [field.key]: parseFloat(e.target.value) || 0 }
                            }))}
                          />
                        ) : (
                          <p className="text-sm p-2 bg-muted rounded">{formData.readings[field.key] || 0}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Consumption Calculation */}
              {selectedMeterMaster && selectedMeterMaster.details_to_capture === "Both" && !isEditing && (
                <div className="space-y-2 pt-4 border-t">
                  <h4 className="font-medium">Consumption (End - Start)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {calculateConsumption(formData.readings, selectedMeterMaster)?.map((c) => (
                      <div key={c.param} className="p-3 bg-primary/10 rounded-lg">
                        <span className="text-sm text-muted-foreground">{c.param} Consumption</span>
                        <p className="text-lg font-semibold">{c.value.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit Fields */}
              <div className="pt-4 border-t space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Audit Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Created By:</span>
                    <p>{selectedReading.created_by}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created At:</span>
                    <p>{new Date(selectedReading.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Modified By:</span>
                    <p>{selectedReading.last_modified_by}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Modified At:</span>
                    <p>{new Date(selectedReading.last_modified_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4">
                {isEditing ? (
                  <>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={handleUpdate}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" className="text-destructive" onClick={() => setDeleteId(selectedReading.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                    <Button onClick={() => setIsEditing(true)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reading</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this utility reading? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
