import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Search, Truck, Package, MapPin, Clock } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";

const shipmentSchema = z.object({
  requisition_id: z.string().min(1, "Requisition is required"),
  carrier_name: z.string().optional(),
  tracking_number: z.string().optional(),
  estimated_arrival: z.string().optional(),
});

type ShipmentFormData = z.infer<typeof shipmentSchema>;

interface Requisition {
  id: string;
  requisition_number: string;
  status: string;
}

interface Shipment {
  id: string;
  shipment_number: string;
  requisition_id: string;
  carrier_name: string | null;
  tracking_number: string | null;
  status: string;
  dispatched_at: string | null;
  estimated_arrival: string | null;
  delivered_at: string | null;
  created_at: string;
  requisitions?: { requisition_number: string; stores?: { name: string } };
}

export default function ShipmentTracking() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<ShipmentFormData>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {
      requisition_id: "",
      carrier_name: "",
      tracking_number: "",
      estimated_arrival: "",
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [shipRes, reqRes] = await Promise.all([
        supabase
          .from("shipments")
          .select("*, requisitions(requisition_number, stores(name))")
          .order("created_at", { ascending: false }),
        supabase.from("requisitions").select("id, requisition_number, status")
          .eq("status", "approved"),
      ]);

      if (shipRes.error) throw shipRes.error;
      if (reqRes.error) throw reqRes.error;

      setShipments(shipRes.data || []);
      setRequisitions(reqRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const generateShipmentNumber = () => {
    const date = new Date();
    const prefix = "SHP";
    const timestamp = date.getFullYear().toString().slice(-2) +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  };

  const onSubmit = async (data: ShipmentFormData) => {
    try {
      const { error } = await supabase.from("shipments").insert([{
        shipment_number: generateShipmentNumber(),
        requisition_id: data.requisition_id,
        carrier_name: data.carrier_name || null,
        tracking_number: data.tracking_number || null,
        estimated_arrival: data.estimated_arrival || null,
      }]);
      if (error) throw error;
      toast.success("Shipment created successfully");
      form.reset();
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error creating shipment:", error);
      toast.error("Failed to create shipment");
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const updates: any = { status };
      if (status === "dispatched") {
        updates.dispatched_at = new Date().toISOString();
      } else if (status === "delivered") {
        updates.delivered_at = new Date().toISOString();
      }
      const { error } = await supabase.from("shipments").update(updates).eq("id", id);
      if (error) throw error;
      toast.success(`Shipment ${status}`);
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const filteredShipments = shipments.filter(ship =>
    ship.shipment_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ship.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ship.carrier_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusProgress = (status: string) => {
    switch (status) {
      case "preparing": return 20;
      case "dispatched": return 40;
      case "in_transit": return 60;
      case "out_for_delivery": return 80;
      case "delivered": return 100;
      default: return 0;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "preparing": return "bg-gray-500 text-white";
      case "dispatched": return "bg-blue-500 text-white";
      case "in_transit": return "bg-yellow-500 text-white";
      case "out_for_delivery": return "bg-orange-500 text-white";
      case "delivered": return "bg-green-500 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Shipment Tracking</h1>
          <p className="text-muted-foreground">Track deliveries from warehouse to stores</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Shipment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Shipment</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="requisition_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requisition</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select approved requisition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {requisitions.map(req => (
                            <SelectItem key={req.id} value={req.id}>
                              {req.requisition_number}
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
                  name="carrier_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Carrier Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Delhivery, BlueDart" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tracking_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tracking Number</FormLabel>
                      <FormControl>
                        <Input placeholder="AWB/Tracking ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estimated_arrival"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Arrival</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">Create Shipment</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shipments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {shipments.filter(s => ['dispatched', 'in_transit', 'out_for_delivery'].includes(s.status)).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {shipments.filter(s => s.status === 'delivered').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preparing</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {shipments.filter(s => s.status === 'preparing').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search shipments, tracking numbers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Shipment Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <div className="col-span-2 text-center py-8 text-muted-foreground">Loading...</div>
        ) : filteredShipments.length === 0 ? (
          <div className="col-span-2 text-center py-8 text-muted-foreground">
            No shipments found.
          </div>
        ) : (
          filteredShipments.map((ship) => (
            <Card key={ship.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-mono">{ship.shipment_number}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {ship.requisitions?.requisition_number} → {ship.requisitions?.stores?.name || 'Store'}
                    </p>
                  </div>
                  <Badge className={getStatusColor(ship.status)}>
                    {ship.status.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Delivery Progress</span>
                    <span>{getStatusProgress(ship.status)}%</span>
                  </div>
                  <Progress value={getStatusProgress(ship.status)} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Preparing</span>
                    <span>Dispatched</span>
                    <span>In Transit</span>
                    <span>Out for Delivery</span>
                    <span>Delivered</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Carrier:</span>
                    <p className="font-medium">{ship.carrier_name || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tracking:</span>
                    <p className="font-medium font-mono">{ship.tracking_number || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dispatched:</span>
                    <p className="font-medium">
                      {ship.dispatched_at ? format(new Date(ship.dispatched_at), 'dd MMM, HH:mm') : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ETA:</span>
                    <p className="font-medium">
                      {ship.estimated_arrival ? format(new Date(ship.estimated_arrival), 'dd MMM, HH:mm') : '-'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {ship.status === 'preparing' && (
                    <Button size="sm" onClick={() => updateStatus(ship.id, 'dispatched')}>
                      Mark Dispatched
                    </Button>
                  )}
                  {ship.status === 'dispatched' && (
                    <Button size="sm" onClick={() => updateStatus(ship.id, 'in_transit')}>
                      In Transit
                    </Button>
                  )}
                  {ship.status === 'in_transit' && (
                    <Button size="sm" onClick={() => updateStatus(ship.id, 'out_for_delivery')}>
                      Out for Delivery
                    </Button>
                  )}
                  {ship.status === 'out_for_delivery' && (
                    <Button size="sm" onClick={() => updateStatus(ship.id, 'delivered')}>
                      Mark Delivered
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
