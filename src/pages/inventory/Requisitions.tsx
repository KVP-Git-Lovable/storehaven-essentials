import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Search, ClipboardList, CheckCircle2, Clock, Truck } from "lucide-react";
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

const requisitionSchema = z.object({
  store_id: z.string().min(1, "Store is required"),
  source_warehouse_id: z.string().min(1, "Warehouse is required"),
  requested_by: z.string().min(1, "Requester name is required"),
  priority: z.string().min(1),
  notes: z.string().optional(),
});

type RequisitionFormData = z.infer<typeof requisitionSchema>;

interface Store {
  id: string;
  name: string;
}

interface Warehouse {
  id: string;
  name: string;
  location: string;
}

interface Requisition {
  id: string;
  requisition_number: string;
  store_id: string;
  source_warehouse_id: string;
  requested_by: string;
  approved_by: string | null;
  status: string;
  priority: string;
  notes: string | null;
  requested_at: string;
  approved_at: string | null;
  stores?: { name: string };
  warehouses?: { name: string };
}

export default function Requisitions() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const form = useForm<RequisitionFormData>({
    resolver: zodResolver(requisitionSchema),
    defaultValues: {
      store_id: "",
      source_warehouse_id: "",
      requested_by: "",
      priority: "normal",
      notes: "",
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [reqRes, storeRes, whRes] = await Promise.all([
        supabase
          .from("requisitions")
          .select("*, stores(name), warehouses(name)")
          .order("created_at", { ascending: false }),
        supabase.from("stores").select("id, name").eq("status", "active"),
        supabase.from("warehouses").select("id, name, location").eq("status", "active"),
      ]);

      if (reqRes.error) throw reqRes.error;
      if (storeRes.error) throw storeRes.error;
      if (whRes.error) throw whRes.error;

      setRequisitions(reqRes.data || []);
      setStores(storeRes.data || []);
      setWarehouses(whRes.data || []);
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

  const onSubmit = async (data: RequisitionFormData) => {
    try {
      const { error } = await supabase.from("requisitions").insert([{
        requisition_number: generateReqNumber(),
        store_id: data.store_id,
        source_warehouse_id: data.source_warehouse_id,
        requested_by: data.requested_by,
        priority: data.priority,
        notes: data.notes || null,
      }]);
      if (error) throw error;
      toast.success("Requisition created successfully");
      form.reset();
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error creating requisition:", error);
      toast.error("Failed to create requisition");
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const updates: any = { status };
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Requisitions</h1>
          <p className="text-muted-foreground">Stock requests from stores to warehouses</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Requisition
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Stock Requisition</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="store_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requesting Store</FormLabel>
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
                  name="source_warehouse_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Warehouse</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select warehouse" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {warehouses.map(wh => (
                            <SelectItem key={wh.id} value={wh.id}>
                              {wh.name} ({wh.location})
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
                  name="requested_by"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requested By</FormLabel>
                      <FormControl>
                        <Input placeholder="Store Manager name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
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
                <Button type="submit" className="w-full">Create Requisition</Button>
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
                <TableHead>Warehouse</TableHead>
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
                    <TableCell>{req.warehouses?.name || '-'}</TableCell>
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
