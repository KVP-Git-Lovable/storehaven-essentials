import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Plus, Phone, User, MapPin, Loader2, Package, Home, Trash2, Calendar, Wrench, Ticket, FileText, Check, X, Gauge, Wallet, Pencil } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { StoreUtilitiesTab } from "@/components/stores/StoreUtilitiesTab";
import { StorePettyCashTab } from "@/components/stores/StorePettyCashTab";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  designation: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  contact_type: z.string().min(1, "Contact type is required"),
  notes: z.string().optional(),
});

const ticketSchema = z.object({
  title: z.string().min(1, "Title is required"),
  asset_id: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().optional(),
  reported_by: z.string().min(1, "Reporter is required"),
  assigned_to: z.string().optional(),
});

const pmSchema = z.object({
  title: z.string().min(1, "Title is required"),
  asset_id: z.string().optional(),
  scheduled_date: z.string().min(1, "Date is required"),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annual"]),
  description: z.string().optional(),
  assigned_to: z.string().optional(),
});

const deploymentSchema = z.object({
  asset_id: z.string().min(1, "Asset is required"),
  deployed_date: z.string().min(1, "Deployed date is required"),
  status: z.enum(["active", "needs_service", "broke_down", "low_performance", "needs_replacement", "inactive", "removed"]),
  feedback: z.string().optional(),
  notes: z.string().optional(),
});

const storeEditSchema = z.object({
  name: z.string().min(1, "Store name is required"),
  address: z.string().min(1, "Address is required"),
  phone: z.string().min(1, "Phone is required"),
  manager_id: z.string().optional().nullable(),
  status: z.enum(["active", "under-renovation", "closed"]),
  store_size_sqft: z.coerce.number().min(0, "Size cannot be negative").optional().nullable(),
});

type ContactFormData = z.infer<typeof contactSchema>;
type TicketFormData = z.infer<typeof ticketSchema>;
type PMFormData = z.infer<typeof pmSchema>;
type DeploymentFormData = z.infer<typeof deploymentSchema>;
type StoreEditFormData = z.infer<typeof storeEditSchema>;

type UserProfile = {
  id: string;
  username: string;
  email: string;
  status: string;
  role?: {
    name: string;
  } | null;
};

type Store = {
  id: string;
  name: string;
  address: string;
  phone: string;
  manager: string;
  manager_id: string | null;
  status: string;
  assets: number;
  store_size_sqft: number | null;
  manager_profile?: {
    username: string;
    email: string;
  } | null;
};

type Rental = {
  id: string;
  store: string;
  landlord: string;
  rent: number;
  start_date: string;
  end_date: string;
  status: string;
};

type Contact = {
  id: string;
  store_id: string;
  contact_type: string;
  name: string;
  designation: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

type Asset = {
  id: string;
  name: string;
  category: string;
  condition: string;
  value: number;
  purchase_date: string;
};

type AssetDeployment = {
  id: string;
  store_id: string;
  asset_id: string;
  deployed_date: string;
  status: string;
  removed_date: string | null;
  feedback: string | null;
  notes: string | null;
  asset?: Asset;
};

type ServiceTicket = {
  id: string;
  ticket_number: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  reported_by: string;
  reported_at: string;
  assigned_to: string | null;
  asset_id: string | null;
  resolved_at: string | null;
  solution_provided: string | null;
  manager_confirmed: boolean;
  manager_feedback: string | null;
};

type PreventiveMaintenance = {
  id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  frequency: string;
  status: string;
  assigned_to: string | null;
  asset_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  manager_confirmed: boolean;
  manager_feedback: string | null;
};

export default function StoreDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [store, setStore] = useState<Store | null>(null);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deployments, setDeployments] = useState<AssetDeployment[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [pmTasks, setPmTasks] = useState<PreventiveMaintenance[]>([]);
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [pmDialogOpen, setPmDialogOpen] = useState(false);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", designation: "", phone: "", email: "", contact_type: "primary", notes: "" },
  });

  const ticketForm = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { title: "", asset_id: "", priority: "medium", description: "", reported_by: "", assigned_to: "" },
  });

  const pmForm = useForm<PMFormData>({
    resolver: zodResolver(pmSchema),
    defaultValues: { title: "", asset_id: "", scheduled_date: "", frequency: "monthly", description: "", assigned_to: "" },
  });

  const deployForm = useForm<DeploymentFormData>({
    resolver: zodResolver(deploymentSchema),
    defaultValues: { asset_id: "", deployed_date: format(new Date(), "yyyy-MM-dd"), status: "active", feedback: "", notes: "" },
  });

  const storeEditForm = useForm<StoreEditFormData>({
    resolver: zodResolver(storeEditSchema),
    defaultValues: { name: "", address: "", phone: "", manager_id: null, status: "active", store_size_sqft: null },
  });

  useEffect(() => {
    if (id) {
      fetchStoreData();
      fetchUsers();
    }
  }, [id]);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, email, status, role:user_roles_master(name)")
      .eq("status", "active")
      .order("username");

    if (!error && data) {
      setUsers(data as UserProfile[]);
    }
  };

  const fetchStoreData = async () => {
    setLoading(true);
    
    const { data: storeData, error: storeError } = await supabase
      .from("stores")
      .select("*, manager_profile:profiles!stores_manager_id_fkey(username, email)")
      .eq("id", id)
      .single();

    if (storeError) {
      toast({ title: "Error", description: "Failed to load store details", variant: "destructive" });
      navigate("/stores");
      return;
    }

    setStore(storeData);

    const [rentalsRes, contactsRes, deploymentsRes, ticketsRes, pmRes, assetsRes] = await Promise.all([
      supabase.from("rentals").select("*").eq("store", storeData.name).order("created_at", { ascending: false }),
      supabase.from("store_contacts").select("*").eq("store_id", id).order("created_at", { ascending: false }),
      supabase.from("store_asset_deployments").select("*, asset:assets(*)").eq("store_id", id).order("deployed_date", { ascending: false }),
      supabase.from("service_tickets").select("*").eq("store_id", id).order("created_at", { ascending: false }),
      supabase.from("store_preventive_maintenance").select("*").eq("store_id", id).order("scheduled_date", { ascending: true }),
      supabase.from("assets").select("*").order("name"),
    ]);

    setRentals(rentalsRes.data || []);
    setContacts(contactsRes.data || []);
    setDeployments((deploymentsRes.data || []) as AssetDeployment[]);
    setTickets(ticketsRes.data || []);
    setPmTasks(pmRes.data || []);
    setAllAssets(assetsRes.data || []);

    setLoading(false);
  };

  const onStoreEditSubmit = async (data: StoreEditFormData) => {
    const selectedUser = users.find(u => u.id === data.manager_id);
    const managerName = selectedUser?.username || "";

    const { error } = await supabase.from("stores").update({
      name: data.name,
      address: data.address,
      phone: data.phone,
      manager: managerName,
      manager_id: data.manager_id || null,
      status: data.status,
      store_size_sqft: data.store_size_sqft || null,
    }).eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to update store", variant: "destructive" });
    } else {
      toast({ title: "Store updated" });
      setEditDialogOpen(false);
      fetchStoreData();
    }
  };

  const openEditDialog = () => {
    if (store) {
      storeEditForm.reset({
        name: store.name,
        address: store.address,
        phone: store.phone,
        manager_id: store.manager_id || null,
        status: store.status as "active" | "under-renovation" | "closed",
        store_size_sqft: store.store_size_sqft,
      });
      setEditDialogOpen(true);
    }
  };

  const onContactSubmit = async (data: ContactFormData) => {
    const { error } = await supabase.from("store_contacts").insert({
      store_id: id,
      name: data.name,
      designation: data.designation || null,
      phone: data.phone || null,
      email: data.email || null,
      contact_type: data.contact_type,
      notes: data.notes || null,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to add contact", variant: "destructive" });
    } else {
      toast({ title: "Contact added" });
      contactForm.reset();
      setContactDialogOpen(false);
      fetchStoreData();
    }
  };

  const onTicketSubmit = async (data: TicketFormData) => {
    const ticketNumber = `TKT-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const { error } = await supabase.from("service_tickets").insert({
      ticket_number: ticketNumber,
      store_id: id,
      title: data.title,
      asset_id: data.asset_id && data.asset_id !== "_none" ? data.asset_id : null,
      priority: data.priority,
      description: data.description || null,
      reported_by: data.reported_by,
      assigned_to: data.assigned_to || null,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to create ticket", variant: "destructive" });
    } else {
      toast({ title: "Ticket created" });
      ticketForm.reset();
      setTicketDialogOpen(false);
      fetchStoreData();
    }
  };

  const onPMSubmit = async (data: PMFormData) => {
    const { error } = await supabase.from("store_preventive_maintenance").insert({
      store_id: id,
      title: data.title,
      asset_id: data.asset_id && data.asset_id !== "_none" ? data.asset_id : null,
      scheduled_date: data.scheduled_date,
      frequency: data.frequency,
      description: data.description || null,
      assigned_to: data.assigned_to || null,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to schedule maintenance", variant: "destructive" });
    } else {
      toast({ title: "Maintenance scheduled" });
      pmForm.reset();
      setPmDialogOpen(false);
      fetchStoreData();
    }
  };

  const onDeploySubmit = async (data: DeploymentFormData) => {
    const { error } = await supabase.from("store_asset_deployments").insert({
      store_id: id,
      asset_id: data.asset_id,
      deployed_date: data.deployed_date,
      status: data.status,
      feedback: data.feedback || null,
      notes: data.notes || null,
    });

    if (error) {
      toast({ title: "Error", description: error.message.includes("duplicate") ? "Asset already deployed" : "Failed to deploy asset", variant: "destructive" });
    } else {
      toast({ title: "Asset deployed" });
      deployForm.reset();
      setDeployDialogOpen(false);
      fetchStoreData();
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    const { error } = await supabase.from("store_contacts").delete().eq("id", contactId);
    if (!error) {
      toast({ title: "Contact deleted" });
      fetchStoreData();
    }
  };

  const handleConfirmPM = async (pmId: string, feedback: string) => {
    await supabase.from("store_preventive_maintenance").update({
      manager_confirmed: true,
      manager_confirmed_at: new Date().toISOString(),
      manager_feedback: feedback,
      status: "completed",
    }).eq("id", pmId);
    toast({ title: "Maintenance confirmed" });
    fetchStoreData();
  };

  const handleConfirmTicket = async (ticketId: string, feedback: string) => {
    await supabase.from("service_tickets").update({
      manager_confirmed: true,
      manager_confirmed_at: new Date().toISOString(),
      manager_feedback: feedback,
      status: "closed",
      closed_at: new Date().toISOString(),
    }).eq("id", ticketId);
    toast({ title: "Ticket closed" });
    fetchStoreData();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      scheduled: "secondary",
      completed: "default",
      open: "destructive",
      in_progress: "secondary",
      resolved: "default",
      closed: "outline",
      overdue: "destructive",
      needs_service: "destructive",
      broke_down: "destructive",
      low_performance: "secondary",
      needs_replacement: "destructive",
      inactive: "outline",
      removed: "outline",
    };
    return <Badge variant={variants[status] || "secondary"}>{status.replace(/_/g, " ")}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-600",
      high: "bg-orange-500",
      medium: "bg-yellow-500",
      low: "bg-gray-400",
    };
    return <Badge className={colors[priority] || ""}>{priority}</Badge>;
  };

  const getAssetName = (assetId: string | null) => {
    if (!assetId) return "-";
    return allAssets.find((a) => a.id === assetId)?.name || "-";
  };

  const deployedAssetIds = deployments.map((d) => d.asset_id);
  const availableAssets = allAssets.filter((a) => !deployedAssetIds.includes(a.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Store not found</p>
        <Button onClick={() => navigate("/stores")}>Back to Stores</Button>
      </div>
    );
  }

  const getManagerDisplayName = () => {
    if (store?.manager_profile?.username) {
      return store.manager_profile.username;
    }
    return store?.manager || "-";
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/stores")} className="shrink-0 self-start">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-semibold truncate">{store.name}</h1>
            <Badge variant={store.status === "active" ? "default" : "secondary"} className="shrink-0">{store.status}</Badge>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground mt-1">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="text-sm truncate">{store.address}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={openEditDialog} className="shrink-0 w-full sm:w-auto">
          <Pencil className="h-4 w-4 mr-2" />
          Edit Store
        </Button>
      </div>

      {/* Edit Store Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Store</DialogTitle>
          </DialogHeader>
          <Form {...storeEditForm}>
            <form onSubmit={storeEditForm.handleSubmit(onStoreEditSubmit)} className="space-y-4">
              <FormField control={storeEditForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Store Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={storeEditForm.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={storeEditForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={storeEditForm.control} name="manager_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store Manager</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)} 
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select manager" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No manager assigned</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.username} {user.role?.name ? `(${user.role.name})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={storeEditForm.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="under-renovation">Under Renovation</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={storeEditForm.control} name="store_size_sqft" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store Size</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          placeholder="e.g. 1500" 
                          {...field} 
                          value={field.value ?? ""} 
                          onChange={(e) => field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">sq ft</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Info Cards */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="overflow-hidden">
          <CardHeader className="pb-1 md:pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground truncate">Manager</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-4 md:pt-0">
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-sm md:text-base truncate">{getManagerDisplayName()}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="pb-1 md:pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground truncate">Phone</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-4 md:pt-0">
            <div className="flex items-center gap-2 min-w-0">
              <Phone className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-sm md:text-base truncate">{store.phone}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="pb-1 md:pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground truncate">Assets Deployed</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-4 md:pt-0">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-sm md:text-base">{deployments.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="pb-1 md:pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground truncate">Open Tickets</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-4 md:pt-0">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-sm md:text-base">{tickets.filter((t) => t.status === "open" || t.status === "in_progress").length}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="pb-1 md:pb-2 p-3 md:p-4">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground truncate">Upcoming PM</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-4 md:pt-0">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-sm md:text-base">{pmTasks.filter((p) => p.status === "scheduled").length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="assets" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="assets" className="text-xs sm:text-sm">Assets</TabsTrigger>
          <TabsTrigger value="pm" className="text-xs sm:text-sm">PM</TabsTrigger>
          <TabsTrigger value="tickets" className="text-xs sm:text-sm">Tickets</TabsTrigger>
          <TabsTrigger value="utilities" className="text-xs sm:text-sm"><Gauge className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />Utilities</TabsTrigger>
          <TabsTrigger value="pettycash" className="text-xs sm:text-sm"><Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />Petty Cash</TabsTrigger>
          <TabsTrigger value="rentals" className="text-xs sm:text-sm">Rentals</TabsTrigger>
          <TabsTrigger value="contacts" className="text-xs sm:text-sm">Contacts</TabsTrigger>
        </TabsList>

        {/* Assets Deployed Tab */}
        <TabsContent value="assets" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Assets Deployed</h2>
            <Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Deploy Asset</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Deploy Asset to Store</DialogTitle>
                </DialogHeader>
                <Form {...deployForm}>
                  <form onSubmit={deployForm.handleSubmit(onDeploySubmit)} className="space-y-4">
                    <FormField control={deployForm.control} name="asset_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {availableAssets.length === 0 ? (
                              <SelectItem value="_none" disabled>No available assets</SelectItem>
                            ) : (
                              availableAssets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} - {a.category}</SelectItem>)
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={deployForm.control} name="deployed_date" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deployed Date</FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={deployForm.control} name="status" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="needs_service">Needs Service</SelectItem>
                              <SelectItem value="broke_down">Broke Down</SelectItem>
                              <SelectItem value="low_performance">Low Performance</SelectItem>
                              <SelectItem value="needs_replacement">Needs Replacement</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={deployForm.control} name="notes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl><Textarea placeholder="Additional notes" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setDeployDialogOpen(false)}>Cancel</Button>
                      <Button type="submit">Deploy Asset</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Deployed Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Removed Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No assets deployed</TableCell></TableRow>
                ) : (
                  deployments.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        <Link to={`/assets/inventory/${d.asset_id}`} className="hover:underline text-primary">
                          {d.asset?.name || getAssetName(d.asset_id)}
                        </Link>
                      </TableCell>
                      <TableCell>{d.asset?.category || "-"}</TableCell>
                      <TableCell>{format(new Date(d.deployed_date), "PP")}</TableCell>
                      <TableCell>{getStatusBadge(d.status)}</TableCell>
                      <TableCell>{d.removed_date ? format(new Date(d.removed_date), "PP") : "-"}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{d.notes || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Preventive Maintenance Tab */}
        <TabsContent value="pm" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Preventive Maintenance</h2>
            <Dialog open={pmDialogOpen} onOpenChange={setPmDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Schedule PM</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Schedule Preventive Maintenance</DialogTitle>
                </DialogHeader>
                <Form {...pmForm}>
                  <form onSubmit={pmForm.handleSubmit(onPMSubmit)} className="space-y-4">
                    <FormField control={pmForm.control} name="title" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl><Input placeholder="Maintenance title" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={pmForm.control} name="asset_id" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="_none">General Store PM</SelectItem>
                              {deployments.map((d) => <SelectItem key={d.asset_id} value={d.asset_id}>{d.asset?.name || getAssetName(d.asset_id)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={pmForm.control} name="frequency" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frequency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="annual">Annual</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={pmForm.control} name="scheduled_date" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scheduled Date</FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={pmForm.control} name="assigned_to" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned To</FormLabel>
                          <FormControl><Input placeholder="Technician name" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={pmForm.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl><Textarea placeholder="Maintenance description" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setPmDialogOpen(false)}>Cancel</Button>
                      <Button type="submit">Schedule</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Manager Confirmed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pmTasks.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No scheduled maintenance</TableCell></TableRow>
                ) : (
                  pmTasks.map((pm) => (
                    <TableRow key={pm.id}>
                      <TableCell className="font-medium">{pm.title}</TableCell>
                      <TableCell>{getAssetName(pm.asset_id)}</TableCell>
                      <TableCell>{format(new Date(pm.scheduled_date), "PP")}</TableCell>
                      <TableCell className="capitalize">{pm.frequency}</TableCell>
                      <TableCell>{getStatusBadge(pm.status)}</TableCell>
                      <TableCell>{pm.assigned_to || "-"}</TableCell>
                      <TableCell>
                        {pm.manager_confirmed ? (
                          <Badge variant="default"><Check className="h-3 w-3 mr-1" />Confirmed</Badge>
                        ) : pm.status === "completed" ? (
                          <Button size="sm" variant="outline" onClick={() => handleConfirmPM(pm.id, "Confirmed by manager")}>
                            Confirm
                          </Button>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Service Tickets Tab */}
        <TabsContent value="tickets" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Service Tickets</h2>
            <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />New Ticket</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create Service Ticket</DialogTitle>
                </DialogHeader>
                <Form {...ticketForm}>
                  <form onSubmit={ticketForm.handleSubmit(onTicketSubmit)} className="space-y-4">
                    <FormField control={ticketForm.control} name="title" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl><Input placeholder="Brief issue description" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={ticketForm.control} name="asset_id" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asset (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="_none">General Store Issue</SelectItem>
                              {deployments.map((d) => <SelectItem key={d.asset_id} value={d.asset_id}>{d.asset?.name || getAssetName(d.asset_id)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={ticketForm.control} name="priority" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={ticketForm.control} name="reported_by" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reported By</FormLabel>
                          <FormControl><Input placeholder="Your name" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={ticketForm.control} name="assigned_to" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned To</FormLabel>
                          <FormControl><Input placeholder="Technician name" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={ticketForm.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl><Textarea placeholder="Detailed description" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setTicketDialogOpen(false)}>Cancel</Button>
                      <Button type="submit">Create Ticket</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reported By</TableHead>
                  <TableHead>Reported At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No service tickets</TableCell></TableRow>
                ) : (
                  tickets.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-sm">{t.ticket_number}</TableCell>
                      <TableCell className="font-medium max-w-[150px] truncate">{t.title}</TableCell>
                      <TableCell>{getAssetName(t.asset_id)}</TableCell>
                      <TableCell>{getPriorityBadge(t.priority)}</TableCell>
                      <TableCell>{getStatusBadge(t.status)}</TableCell>
                      <TableCell>{t.reported_by}</TableCell>
                      <TableCell>{format(new Date(t.reported_at), "PP")}</TableCell>
                      <TableCell>
                        {t.status === "resolved" && !t.manager_confirmed ? (
                          <Button size="sm" variant="outline" onClick={() => handleConfirmTicket(t.id, "Confirmed closed")}>
                            <Check className="h-3 w-3 mr-1" />Close
                          </Button>
                        ) : t.manager_confirmed ? (
                          <Badge variant="outline"><Check className="h-3 w-3 mr-1" />Closed</Badge>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Utilities Tab */}
        <TabsContent value="utilities">
          <StoreUtilitiesTab storeId={id!} storeName={store.name} deployedAssetIds={deployedAssetIds} />
        </TabsContent>

        {/* Petty Cash Tab */}
        <TabsContent value="pettycash">
          <StorePettyCashTab storeId={id!} />
        </TabsContent>

        {/* Rentals Tab */}
        <TabsContent value="rentals" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Rental Agreements</h2>
            <Button asChild size="sm">
              <Link to="/stores/rentals?action=add"><Plus className="h-4 w-4 mr-2" />Add Rental</Link>
            </Button>
          </div>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Landlord</TableHead>
                  <TableHead>Monthly Rent</TableHead>
                  <TableHead>Lease Period</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentals.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No rental agreements</TableCell></TableRow>
                ) : (
                  rentals.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.landlord}</TableCell>
                      <TableCell>₹{Number(r.rent).toLocaleString()}</TableCell>
                      <TableCell>{format(new Date(r.start_date), "PP")} - {format(new Date(r.end_date), "PP")}</TableCell>
                      <TableCell><Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Store Contacts</h2>
            <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Contact</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                </DialogHeader>
                <Form {...contactForm}>
                  <form onSubmit={contactForm.handleSubmit(onContactSubmit)} className="space-y-4">
                    <FormField control={contactForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl><Input placeholder="Contact name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={contactForm.control} name="contact_type" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="primary">Primary</SelectItem>
                              <SelectItem value="emergency">Emergency</SelectItem>
                              <SelectItem value="landlord">Landlord</SelectItem>
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                              <SelectItem value="security">Security</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={contactForm.control} name="designation" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Designation</FormLabel>
                          <FormControl><Input placeholder="e.g. Store Manager" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={contactForm.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl><Input placeholder="+91 98765 43210" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={contactForm.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl><Input type="email" placeholder="email@example.com" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={contactForm.control} name="notes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl><Input placeholder="Additional notes" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setContactDialogOpen(false)}>Cancel</Button>
                      <Button type="submit">Add Contact</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No contacts added</TableCell></TableRow>
                ) : (
                  contacts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><Badge variant="outline">{c.contact_type}</Badge></TableCell>
                      <TableCell>{c.designation || "-"}</TableCell>
                      <TableCell>{c.phone || "-"}</TableCell>
                      <TableCell>{c.email || "-"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteContact(c.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}