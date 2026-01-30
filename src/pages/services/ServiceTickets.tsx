import { useState, useEffect } from "react";
import { Plus, Search, Loader2, AlertTriangle, Clock, CheckCircle, Ticket, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { StatCard } from "@/components/dashboard/StatCard";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ServiceTicketDetailsDialog } from "@/components/services/ServiceTicketDetailsDialog";
import { useStoreAccess } from "@/hooks/useStoreAccess";
import { usePermissions } from "@/hooks/usePermissions";

const ticketSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  store_id: z.string().min(1, "Store is required"),
  asset_id: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().optional(),
  reported_by: z.string().min(1, "Reporter is required"),
  assigned_to: z.string().optional(),
  service_contract_id: z.string().optional(),
});

type TicketFormData = z.infer<typeof ticketSchema>;

type ServiceTicket = {
  id: string;
  ticket_number: string;
  store_id: string;
  asset_id: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  reported_by: string;
  reported_at: string;
  assigned_to: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  solution_provided: string | null;
  service_contract_id: string | null;
  service_score: number | null;
  sla_response_met: boolean | null;
  sla_resolution_met: boolean | null;
};

type Store = { id: string; name: string };
type Asset = { id: string; name: string; store_id: string | null };
type ServiceContract = { 
  id: string; 
  contract_number: string; 
  service_provider?: { name: string } | null;
};

export default function ServiceTickets() {
  const [searchQuery, setSearchQuery] = useState("");
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [contracts, setContracts] = useState<ServiceContract[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const { toast } = useToast();
  const { accessibleStoreIds, isAdmin, loading: accessLoading } = useStoreAccess();
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission("services.tickets", "create");

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: "",
      store_id: "",
      asset_id: "",
      priority: "medium",
      description: "",
      reported_by: "",
      assigned_to: "",
      service_contract_id: "",
    },
  });

  const selectedStoreId = form.watch("store_id");

  useEffect(() => {
    if (!accessLoading) {
      fetchData();
    }
  }, [accessLoading, accessibleStoreIds]);

  useEffect(() => {
    if (selectedStoreId) {
      const storeAssets = assets.filter(a => a.store_id === selectedStoreId);
      setFilteredAssets(storeAssets);
    } else {
      setFilteredAssets([]);
    }
    form.setValue("asset_id", "");
  }, [selectedStoreId, assets]);

  const fetchData = async () => {
    setLoading(true);
    const storeIds = Array.from(accessibleStoreIds);
    
    // Fetch tickets with store filter
    let ticketsQuery = supabase.from("service_tickets").select("*").order("created_at", { ascending: false });
    if (!isAdmin && storeIds.length > 0) {
      ticketsQuery = ticketsQuery.in("store_id", storeIds);
    }
    
    // Fetch accessible stores
    let storesQuery = supabase.from("stores").select("id, name").order("name");
    if (!isAdmin && storeIds.length > 0) {
      storesQuery = storesQuery.in("id", storeIds);
    }
    
    const [ticketsRes, storesRes, assetsRes, contractsRes] = await Promise.all([
      ticketsQuery,
      storesQuery,
      supabase.from("assets").select("id, name, store_id").order("name"),
      supabase.from("service_contracts")
        .select("id, contract_number, service_provider:service_provider_id(name)")
        .eq("status", "active")
        .order("contract_number"),
    ]);
    setTickets(ticketsRes.data || []);
    setStores(storesRes.data || []);
    setAssets(assetsRes.data || []);
    setContracts((contractsRes.data as ServiceContract[]) || []);
    setLoading(false);
  };

  const generateTicketNumber = () => {
    const date = new Date();
    const prefix = "TKT";
    const timestamp = date.getFullYear().toString().slice(-2) +
      String(date.getMonth() + 1).padStart(2, "0") +
      String(date.getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `${prefix}-${timestamp}-${random}`;
  };

  const onSubmit = async (data: TicketFormData) => {
    const { error } = await supabase.from("service_tickets").insert({
      ticket_number: generateTicketNumber(),
      title: data.title,
      store_id: data.store_id,
      asset_id: data.asset_id && data.asset_id !== "_none" ? data.asset_id : null,
      priority: data.priority,
      description: data.description || null,
      reported_by: data.reported_by,
      assigned_to: data.assigned_to || null,
      service_contract_id: data.service_contract_id && data.service_contract_id !== "_none" ? data.service_contract_id : null,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to create ticket", variant: "destructive" });
    } else {
      toast({ title: "Ticket created", description: "Service ticket has been logged." });
      form.reset();
      setDialogOpen(false);
      fetchData();
    }
  };

  const handleRowClick = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setDetailsOpen(true);
  };

  const filteredTickets = tickets.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.ticket_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openTickets = tickets.filter((t) => t.status === "open").length;
  const inProgressTickets = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedTickets = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;
  const avgScore = tickets.filter(t => t.service_score !== null).length > 0
    ? Math.round(tickets.filter(t => t.service_score !== null).reduce((sum, t) => sum + (t.service_score || 0), 0) / tickets.filter(t => t.service_score !== null).length)
    : 0;

  const getStoreName = (storeId: string) => stores.find((s) => s.id === storeId)?.name || "-";
  const getAssetName = (assetId: string | null) => (assetId ? assets.find((a) => a.id === assetId)?.name : null) || "-";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive">Open</Badge>;
      case "in_progress":
        return <Badge className="bg-amber-500">In Progress</Badge>;
      case "pending_parts":
        return <Badge variant="secondary">Pending Parts</Badge>;
      case "resolved":
        return <Badge className="bg-green-600">Resolved</Badge>;
      case "closed":
        return <Badge variant="outline">Closed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge variant="secondary">Medium</Badge>;
      case "low":
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  const getScoreBadge = (score: number | null) => {
    if (score === null) return <span className="text-muted-foreground">-</span>;
    if (score >= 80) return <Badge className="bg-green-600">{score}%</Badge>;
    if (score >= 60) return <Badge className="bg-amber-500">{score}%</Badge>;
    return <Badge variant="destructive">{score}%</Badge>;
  };

  const getSLABadge = (responseMet: boolean | null, resolutionMet: boolean | null) => {
    if (responseMet === null && resolutionMet === null) return null;
    const allMet = (responseMet ?? true) && (resolutionMet ?? true);
    return allMet ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <AlertTriangle className="h-4 w-4 text-amber-500" />
    );
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Service Tickets</h1>
          <p className="text-muted-foreground">Track and manage service requests with contract adherence</p>
        </div>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Create Service Ticket</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Brief description of the issue" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="store_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Store</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select store" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {stores.map((store) => (
                                  <SelectItem key={store.id} value={store.id}>
                                    {store.name}
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
                        name="asset_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Asset (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!selectedStoreId}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={selectedStoreId ? "Select asset" : "Select store first"} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="_none">No specific asset</SelectItem>
                                {filteredAssets.map((asset) => (
                                  <SelectItem key={asset.id} value={asset.id}>
                                    {asset.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low (P4)</SelectItem>
                                <SelectItem value="medium">Medium (P3)</SelectItem>
                                <SelectItem value="high">High (P2)</SelectItem>
                                <SelectItem value="critical">Critical (P1)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="reported_by"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reported By</FormLabel>
                            <FormControl>
                              <Input placeholder="Name of reporter" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="service_contract_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Contract (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Link to service contract" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="_none">No contract</SelectItem>
                              {contracts.map((contract) => (
                                <SelectItem key={contract.id} value={contract.id}>
                                  {contract.contract_number} - {contract.service_provider?.name || "N/A"}
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
                      name="assigned_to"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned To (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Technician name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Detailed description of the issue" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Ticket</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Open Tickets" value={openTickets} icon={Ticket} />
        <StatCard title="In Progress" value={inProgressTickets} icon={Clock} />
        <StatCard title="Resolved" value={resolvedTickets} icon={CheckCircle} />
        <StatCard title="Avg Service Score" value={`${avgScore}%`} icon={TrendingUp} />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket #</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Reported At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No service tickets found
                </TableCell>
              </TableRow>
            ) : (
              filteredTickets.map((ticket) => (
                <TableRow 
                  key={ticket.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(ticket.id)}
                >
                  <TableCell className="font-mono text-sm">{ticket.ticket_number}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{ticket.title}</TableCell>
                  <TableCell>{getStoreName(ticket.store_id)}</TableCell>
                  <TableCell>{getAssetName(ticket.asset_id)}</TableCell>
                  <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                  <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                  <TableCell>{getSLABadge(ticket.sla_response_met, ticket.sla_resolution_met)}</TableCell>
                  <TableCell>{getScoreBadge(ticket.service_score)}</TableCell>
                  <TableCell>{new Date(ticket.reported_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ServiceTicketDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        ticketId={selectedTicketId}
        onUpdate={fetchData}
      />
    </div>
  );
}
