import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Search, Package, CheckCircle, AlertTriangle, FileCheck, ScanLine } from "lucide-react";
import { format } from "date-fns";
import { BarcodeScanner } from "@/components/inventory/BarcodeScanner";
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

const grnSchema = z.object({
  store_id: z.string().min(1, "Store is required"),
  shipment_id: z.string().optional(),
  received_by: z.string().min(1, "Receiver name is required"),
  notes: z.string().optional(),
});

type GRNFormData = z.infer<typeof grnSchema>;

interface Store {
  id: string;
  name: string;
}

interface Shipment {
  id: string;
  shipment_number: string;
  status: string;
}

interface GRN {
  id: string;
  grn_number: string;
  store_id: string;
  shipment_id: string | null;
  received_by: string;
  verified_by: string | null;
  status: string;
  notes: string | null;
  received_at: string;
  verified_at: string | null;
  stores?: { name: string };
  shipments?: { shipment_number: string } | null;
}

export default function GoodsReceipt() {
  const [grns, setGrns] = useState<GRN[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<GRNFormData>({
    resolver: zodResolver(grnSchema),
    defaultValues: {
      store_id: "",
      shipment_id: "",
      received_by: "",
      notes: "",
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [grnRes, storeRes, shipRes] = await Promise.all([
        supabase
          .from("grn")
          .select("*, stores(name), shipments(shipment_number)")
          .order("created_at", { ascending: false }),
        supabase.from("stores").select("id, name").eq("status", "active"),
        supabase.from("shipments").select("id, shipment_number, status")
          .in("status", ["dispatched", "in_transit", "out_for_delivery"]),
      ]);

      if (grnRes.error) throw grnRes.error;
      if (storeRes.error) throw storeRes.error;
      if (shipRes.error) throw shipRes.error;

      setGrns(grnRes.data || []);
      setStores(storeRes.data || []);
      setShipments(shipRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const generateGrnNumber = () => {
    const date = new Date();
    const prefix = "GRN";
    const timestamp = date.getFullYear().toString().slice(-2) +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  };

  const onSubmit = async (data: GRNFormData) => {
    try {
      const insertData: any = {
        grn_number: generateGrnNumber(),
        store_id: data.store_id,
        received_by: data.received_by,
        notes: data.notes || null,
      };
      
      if (data.shipment_id && data.shipment_id !== "none") {
        insertData.shipment_id = data.shipment_id;
      }

      const { error } = await supabase.from("grn").insert([insertData]);
      if (error) throw error;
      toast.success("GRN created successfully");
      form.reset();
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error creating GRN:", error);
      toast.error("Failed to create GRN");
    }
  };

  const verifyGrn = async (id: string) => {
    try {
      const { error } = await supabase
        .from("grn")
        .update({
          status: "verified",
          verified_by: "Admin",
          verified_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("GRN verified successfully");
      fetchData();
    } catch (error) {
      console.error("Error verifying GRN:", error);
      toast.error("Failed to verify GRN");
    }
  };

  const completeGrn = async (id: string) => {
    try {
      const { error } = await supabase
        .from("grn")
        .update({ status: "completed" })
        .eq("id", id);
      if (error) throw error;
      toast.success("GRN completed - Inventory updated");
      fetchData();
    } catch (error) {
      console.error("Error completing GRN:", error);
      toast.error("Failed to complete GRN");
    }
  };

  const filteredGrns = grns.filter(grn =>
    grn.grn_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    grn.received_by.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBarcodeScan = async (barcode: string) => {
    // Try to find item by barcode or SKU for verification
    const { data, error } = await supabase
      .from("inventory_items")
      .select("id, name, barcode, sku")
      .or(`barcode.eq.${barcode},sku.eq.${barcode}`)
      .single();

    if (error || !data) {
      toast.error(`No item found with barcode: ${barcode}`);
      return;
    }

    toast.success(`Verified: ${data.name}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500 text-white";
      case "verified": return "bg-blue-500 text-white";
      case "completed": return "bg-green-500 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Goods Receipt Notes</h1>
          <p className="text-muted-foreground">Receive and verify incoming shipments</p>
        </div>
        <div className="flex gap-2">
          <BarcodeScanner
            onScan={handleBarcodeScan}
            trigger={
              <Button variant="outline">
                <ScanLine className="mr-2 h-4 w-4" /> Scan Item
              </Button>
            }
          />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Create GRN
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Goods Receipt Note</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="store_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receiving Store</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select store" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {stores.map(store => (
                            <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="shipment_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Linked Shipment (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select shipment" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {shipments.map(ship => (
                            <SelectItem key={ship.id} value={ship.id}>
                              {ship.shipment_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="received_by"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Received By</FormLabel>
                      <FormControl>
                        <Input placeholder="Staff name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any observations..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">Create GRN</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total GRNs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{grns.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {grns.filter(g => g.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {grns.filter(g => g.status === 'verified').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {grns.filter(g => g.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search GRNs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GRN Number</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Shipment</TableHead>
                <TableHead>Received By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredGrns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No GRNs found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredGrns.map((grn) => (
                  <TableRow key={grn.id}>
                    <TableCell className="font-mono font-medium">{grn.grn_number}</TableCell>
                    <TableCell>{grn.stores?.name || '-'}</TableCell>
                    <TableCell>{grn.shipments?.shipment_number || 'Direct Receipt'}</TableCell>
                    <TableCell>{grn.received_by}</TableCell>
                    <TableCell>{format(new Date(grn.received_at), 'dd MMM yyyy HH:mm')}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(grn.status)}>
                        {grn.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {grn.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => verifyGrn(grn.id)}>
                          Verify
                        </Button>
                      )}
                      {grn.status === 'verified' && (
                        <Button size="sm" variant="outline" onClick={() => completeGrn(grn.id)}>
                          Complete
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
