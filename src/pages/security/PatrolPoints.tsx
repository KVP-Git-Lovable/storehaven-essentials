import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, QrCode, Download, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Store {
  id: string;
  name: string;
}

interface PatrolPoint {
  id: string;
  store_id: string;
  name: string;
  location_description: string | null;
  floor: string | null;
  zone: string | null;
  qr_code: string;
  is_active: boolean;
  stores?: { name: string };
}

export default function PatrolPoints() {
  const [points, setPoints] = useState<PatrolPoint[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<PatrolPoint | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>("all");

  const [form, setForm] = useState({
    store_id: "",
    name: "",
    location_description: "",
    floor: "",
    zone: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pointsRes, storesRes] = await Promise.all([
        supabase.from("security_patrol_points").select(`*, stores(name)`).order("name"),
        supabase.from("stores").select("id, name").eq("status", "active"),
      ]);

      if (pointsRes.data) setPoints(pointsRes.data);
      if (storesRes.data) setStores(storesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch patrol points");
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = () => {
    return `SP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  };

  const handleSubmit = async () => {
    try {
      if (selectedPoint) {
        const { error } = await supabase
          .from("security_patrol_points")
          .update({
            store_id: form.store_id,
            name: form.name,
            location_description: form.location_description || null,
            floor: form.floor || null,
            zone: form.zone || null,
          })
          .eq("id", selectedPoint.id);

        if (error) throw error;
        toast.success("Patrol point updated");
      } else {
        const { error } = await supabase.from("security_patrol_points").insert({
          store_id: form.store_id,
          name: form.name,
          location_description: form.location_description || null,
          floor: form.floor || null,
          zone: form.zone || null,
          qr_code: generateQRCode(),
        });

        if (error) throw error;
        toast.success("Patrol point created");
      }

      setIsFormOpen(false);
      setSelectedPoint(null);
      setForm({ store_id: "", name: "", location_description: "", floor: "", zone: "" });
      fetchData();
    } catch (error) {
      console.error("Error saving patrol point:", error);
      toast.error("Failed to save patrol point");
    }
  };

  const handleDelete = async () => {
    if (!selectedPoint) return;
    try {
      const { error } = await supabase
        .from("security_patrol_points")
        .delete()
        .eq("id", selectedPoint.id);

      if (error) throw error;
      toast.success("Patrol point deleted");
      fetchData();
    } catch (error) {
      console.error("Error deleting patrol point:", error);
      toast.error("Failed to delete patrol point");
    } finally {
      setIsDeleteOpen(false);
      setSelectedPoint(null);
    }
  };

  const openEditForm = (point: PatrolPoint) => {
    setSelectedPoint(point);
    setForm({
      store_id: point.store_id,
      name: point.name,
      location_description: point.location_description || "",
      floor: point.floor || "",
      zone: point.zone || "",
    });
    setIsFormOpen(true);
  };

  const downloadQRCode = (point: PatrolPoint) => {
    // Generate QR code as data URL using a canvas
    const canvas = document.createElement("canvas");
    const size = 200;
    canvas.width = size;
    canvas.height = size + 40;
    const ctx = canvas.getContext("2d");
    
    if (ctx) {
      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size + 40);
      
      // QR Code simulation (in production, use a QR library)
      ctx.fillStyle = "#000000";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(point.qr_code, size / 2, size / 2);
      ctx.fillText(point.name, size / 2, size + 20);
      
      // Download
      const link = document.createElement("a");
      link.download = `qr-${point.name.replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
    toast.success("QR code downloaded");
  };

  const filteredPoints = points.filter((point) => {
    const matchesSearch = point.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStore = selectedStore === "all" || point.store_id === selectedStore;
    return matchesSearch && matchesStore;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Patrol Points</h1>
          <p className="text-muted-foreground">Manage building sections and QR codes for patrol</p>
        </div>
        <Button onClick={() => { setSelectedPoint(null); setForm({ store_id: "", name: "", location_description: "", floor: "", zone: "" }); setIsFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Patrol Point
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search points..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedStore} onValueChange={setSelectedStore}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by store" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stores</SelectItem>
            {stores.map((store) => (
              <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Floor</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>QR Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPoints.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No patrol points found
                </TableCell>
              </TableRow>
            ) : (
              filteredPoints.map((point) => (
                <TableRow key={point.id}>
                  <TableCell className="font-medium">{point.name}</TableCell>
                  <TableCell>{point.stores?.name}</TableCell>
                  <TableCell>{point.location_description || "-"}</TableCell>
                  <TableCell>{point.floor || "-"}</TableCell>
                  <TableCell>{point.zone || "-"}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{point.qr_code}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={point.is_active ? "default" : "secondary"}>
                      {point.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setSelectedPoint(point); setIsQROpen(true); }}
                        title="View QR Code"
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => downloadQRCode(point)}
                        title="Download QR"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditForm(point)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setSelectedPoint(point); setIsDeleteOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPoint ? "Edit Patrol Point" : "Add Patrol Point"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Store *</Label>
              <Select value={form.store_id} onValueChange={(v) => setForm({...form, store_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Point Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
                placeholder="e.g., Main Entrance, Fire Exit A"
              />
            </div>
            <div className="space-y-2">
              <Label>Location Description</Label>
              <Textarea
                value={form.location_description}
                onChange={(e) => setForm({...form, location_description: e.target.value})}
                placeholder="Describe where this point is located"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Floor</Label>
                <Input
                  value={form.floor}
                  onChange={(e) => setForm({...form, floor: e.target.value})}
                  placeholder="e.g., Ground, 1st, Basement"
                />
              </div>
              <div className="space-y-2">
                <Label>Zone</Label>
                <Input
                  value={form.zone}
                  onChange={(e) => setForm({...form, zone: e.target.value})}
                  placeholder="e.g., North Wing, Parking"
                />
              </div>
            </div>
            <Button className="w-full" onClick={handleSubmit} disabled={!form.store_id || !form.name}>
              {selectedPoint ? "Update" : "Create"} Patrol Point
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code View Dialog */}
      <Dialog open={isQROpen} onOpenChange={setIsQROpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">QR Code</DialogTitle>
          </DialogHeader>
          {selectedPoint && (
            <Card className="text-center">
              <CardHeader>
                <CardTitle className="text-lg">{selectedPoint.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-8 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <QrCode className="h-24 w-24 mx-auto mb-4" />
                    <code className="text-sm">{selectedPoint.qr_code}</code>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Print this QR code and place it at {selectedPoint.location_description || "the designated location"}
                </p>
                <Button className="w-full" onClick={() => downloadQRCode(selectedPoint)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Patrol Point</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedPoint?.name}"? This will also remove any associated visit records.
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
