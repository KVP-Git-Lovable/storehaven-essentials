import { useState, useEffect } from "react";
import { format, differenceInMinutes, differenceInHours } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Wrench,
  Car,
  Package,
  AlertTriangle,
  TrendingUp,
  FileText,
  Loader2,
  Edit,
  Save,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type ServiceContract = {
  id: string;
  contract_number: string;
  service_provider_id: string | null;
  labour_included: boolean | null;
  labour_hours_included: number | null;
  labour_rate_per_hour: number | null;
  travel_included: boolean | null;
  travel_radius_km: number | null;
  travel_rate_per_km: number | null;
  spares_included: boolean | null;
  spares_coverage_percent: number | null;
  spares_max_value: number | null;
  consumables_included: boolean | null;
  consumables_limit: number | null;
  p1_response_mins: number | null;
  p1_resolution_hrs: number | null;
  p2_response_mins: number | null;
  p2_resolution_hrs: number | null;
  p3_response_mins: number | null;
  p3_resolution_hrs: number | null;
  p4_response_mins: number | null;
  p4_resolution_hrs: number | null;
  support_hours: string | null;
  service_provider?: { name: string } | null;
};

type AdherenceItem = {
  id: string;
  category: string;
  item_name: string;
  expected_value: string | null;
  actual_value: string | null;
  is_compliant: boolean;
  weight: number;
  notes: string | null;
  checked_at: string | null;
  checked_by: string | null;
};

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
  first_response_at: string | null;
  response_time_mins: number | null;
  resolved_at: string | null;
  resolution_time_hours: number | null;
  service_contract_id: string | null;
  sla_response_met: boolean | null;
  sla_resolution_met: boolean | null;
  service_score: number | null;
  spares_used: boolean | null;
  spares_cost: number | null;
  labour_hours: number | null;
  labour_cost: number | null;
  travel_distance_km: number | null;
  travel_cost: number | null;
  solution_provided: string | null;
  store?: { name: string } | null;
  asset?: { name: string } | null;
};

interface ServiceTicketDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
  onUpdate: () => void;
}

export function ServiceTicketDetailsDialog({
  open,
  onOpenChange,
  ticketId,
  onUpdate,
}: ServiceTicketDetailsDialogProps) {
  const [ticket, setTicket] = useState<ServiceTicket | null>(null);
  const [contract, setContract] = useState<ServiceContract | null>(null);
  const [contracts, setContracts] = useState<ServiceContract[]>([]);
  const [adherenceItems, setAdherenceItems] = useState<AdherenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    status: "",
    assigned_to: "",
    solution_provided: "",
    first_response_at: "",
    resolved_at: "",
    spares_used: false,
    spares_cost: 0,
    labour_hours: 0,
    labour_cost: 0,
    travel_distance_km: 0,
    travel_cost: 0,
    service_contract_id: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open && ticketId) {
      fetchTicketDetails();
      fetchContracts();
    }
  }, [open, ticketId]);

  const fetchContracts = async () => {
    const { data } = await supabase
      .from("service_contracts")
      .select("id, contract_number, service_provider_id, labour_included, labour_hours_included, labour_rate_per_hour, travel_included, travel_radius_km, travel_rate_per_km, spares_included, spares_coverage_percent, spares_max_value, consumables_included, consumables_limit, p1_response_mins, p1_resolution_hrs, p2_response_mins, p2_resolution_hrs, p3_response_mins, p3_resolution_hrs, p4_response_mins, p4_resolution_hrs, support_hours, service_provider:service_provider_id(name)")
      .eq("status", "active")
      .order("contract_number");
    setContracts((data as ServiceContract[]) || []);
  };

  const fetchTicketDetails = async () => {
    if (!ticketId) return;
    setLoading(true);

    const [ticketRes, adherenceRes] = await Promise.all([
      supabase
        .from("service_tickets")
        .select("*, store:store_id(name), asset:asset_id(name)")
        .eq("id", ticketId)
        .maybeSingle(),
      supabase
        .from("service_ticket_adherence")
        .select("*")
        .eq("service_ticket_id", ticketId)
        .order("category"),
    ]);

    if (ticketRes.data) {
      const ticketData = ticketRes.data as ServiceTicket;
      setTicket(ticketData);
      setEditData({
        status: ticketData.status,
        assigned_to: ticketData.assigned_to || "",
        solution_provided: ticketData.solution_provided || "",
        first_response_at: ticketData.first_response_at?.slice(0, 16) || "",
        resolved_at: ticketData.resolved_at?.slice(0, 16) || "",
        spares_used: ticketData.spares_used || false,
        spares_cost: ticketData.spares_cost || 0,
        labour_hours: ticketData.labour_hours || 0,
        labour_cost: ticketData.labour_cost || 0,
        travel_distance_km: ticketData.travel_distance_km || 0,
        travel_cost: ticketData.travel_cost || 0,
        service_contract_id: ticketData.service_contract_id || "",
      });

      // Fetch contract if linked
      if (ticketData.service_contract_id) {
        const { data: contractData } = await supabase
          .from("service_contracts")
          .select("*, service_provider:service_provider_id(name)")
          .eq("id", ticketData.service_contract_id)
          .maybeSingle();
        setContract(contractData as ServiceContract);
      } else {
        setContract(null);
      }
    }

    setAdherenceItems((adherenceRes.data as AdherenceItem[]) || []);
    setLoading(false);
  };

  const generateAdherenceChecklist = async (contractData: ServiceContract, ticketData: ServiceTicket) => {
    // Delete existing adherence items
    await supabase
      .from("service_ticket_adherence")
      .delete()
      .eq("service_ticket_id", ticketData.id);

    const items: { category: string; item_name: string; expected_value?: string; actual_value?: string; is_compliant: boolean; weight: number }[] = [];

    // SLA Response Time
    const priorityMap: Record<string, { response: number | null; resolution: number | null }> = {
      critical: { response: contractData.p1_response_mins, resolution: contractData.p1_resolution_hrs },
      high: { response: contractData.p2_response_mins, resolution: contractData.p2_resolution_hrs },
      medium: { response: contractData.p3_response_mins, resolution: contractData.p3_resolution_hrs },
      low: { response: contractData.p4_response_mins, resolution: contractData.p4_resolution_hrs },
    };
    const sla = priorityMap[ticketData.priority] || { response: null, resolution: null };

    if (sla.response) {
      items.push({
        category: "sla",
        item_name: "Response Time SLA",
        expected_value: `${sla.response} minutes`,
        actual_value: ticketData.first_response_at
          ? `${differenceInMinutes(new Date(ticketData.first_response_at), new Date(ticketData.reported_at))} minutes`
          : "Pending",
        is_compliant: ticketData.sla_response_met ?? false,
        weight: 2.0,
      });
    }

    if (sla.resolution) {
      items.push({
        category: "sla",
        item_name: "Resolution Time SLA",
        expected_value: `${sla.resolution} hours`,
        actual_value: ticketData.resolved_at
          ? `${differenceInHours(new Date(ticketData.resolved_at), new Date(ticketData.reported_at))} hours`
          : "Pending",
        is_compliant: ticketData.sla_resolution_met ?? false,
        weight: 2.0,
      });
    }

    // Labour Coverage
    if (contractData.labour_included) {
      items.push({
        category: "labour",
        item_name: "Labour Coverage",
        expected_value: contractData.labour_hours_included ? `${contractData.labour_hours_included} hours included` : "Included",
        actual_value: ticketData.labour_hours ? `${ticketData.labour_hours} hours used` : "N/A",
        is_compliant: !ticketData.labour_hours || (contractData.labour_hours_included ? ticketData.labour_hours <= contractData.labour_hours_included : true),
        weight: 1.0,
      });
    }

    // Travel Coverage
    if (contractData.travel_included) {
      items.push({
        category: "travel",
        item_name: "Travel Coverage",
        expected_value: contractData.travel_radius_km ? `Within ${contractData.travel_radius_km} km` : "Included",
        actual_value: ticketData.travel_distance_km ? `${ticketData.travel_distance_km} km` : "N/A",
        is_compliant: !ticketData.travel_distance_km || (contractData.travel_radius_km ? ticketData.travel_distance_km <= contractData.travel_radius_km : true),
        weight: 1.0,
      });
    }

    // Spares Coverage
    if (contractData.spares_included) {
      items.push({
        category: "spares",
        item_name: "Spares Coverage",
        expected_value: contractData.spares_max_value ? `Up to ₹${contractData.spares_max_value}` : `${contractData.spares_coverage_percent || 100}% covered`,
        actual_value: ticketData.spares_cost ? `₹${ticketData.spares_cost} used` : "N/A",
        is_compliant: !ticketData.spares_cost || (contractData.spares_max_value ? ticketData.spares_cost <= contractData.spares_max_value : true),
        weight: 1.0,
      });
    }

    // Consumables Coverage
    if (contractData.consumables_included) {
      items.push({
        category: "consumables",
        item_name: "Consumables Coverage",
        expected_value: contractData.consumables_limit ? `Up to ₹${contractData.consumables_limit}` : "Included",
        is_compliant: true,
        weight: 0.5,
      });
    }

    // Support Hours
    if (contractData.support_hours) {
      items.push({
        category: "response",
        item_name: "Support Hours",
        expected_value: contractData.support_hours === "24x7" ? "24x7 Support" : "Business Hours",
        is_compliant: true,
        weight: 0.5,
      });
    }

    // Insert items
    if (items.length > 0) {
      const insertData = items.map(item => ({
        service_ticket_id: ticketData.id,
        ...item,
      }));
      await supabase.from("service_ticket_adherence").insert(insertData);
    }

    // Refresh adherence items
    const { data } = await supabase
      .from("service_ticket_adherence")
      .select("*")
      .eq("service_ticket_id", ticketData.id)
      .order("category");
    setAdherenceItems((data as AdherenceItem[]) || []);
  };

  const calculateServiceScore = (): number => {
    if (adherenceItems.length === 0) return 0;

    const totalWeight = adherenceItems.reduce((sum, item) => sum + item.weight, 0);
    const compliantWeight = adherenceItems
      .filter((item) => item.is_compliant)
      .reduce((sum, item) => sum + item.weight, 0);

    return totalWeight > 0 ? Math.round((compliantWeight / totalWeight) * 100) : 0;
  };

  const handleContractChange = async (contractId: string) => {
    setEditData((prev) => ({ ...prev, service_contract_id: contractId }));

    if (contractId && ticket) {
      const selectedContract = contracts.find((c) => c.id === contractId);
      if (selectedContract) {
        setContract(selectedContract);
        await generateAdherenceChecklist(selectedContract, ticket);
      }
    }
  };

  const handleAdherenceToggle = async (itemId: string, isCompliant: boolean) => {
    await supabase
      .from("service_ticket_adherence")
      .update({ is_compliant: isCompliant, checked_at: new Date().toISOString() })
      .eq("id", itemId);

    setAdherenceItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, is_compliant: isCompliant, checked_at: new Date().toISOString() } : item
      )
    );
  };

  const handleSave = async () => {
    if (!ticket) return;
    setSaving(true);

    // Calculate SLA compliance
    let slaResponseMet: boolean | null = null;
    let slaResolutionMet: boolean | null = null;
    let responseTimeMins: number | null = null;
    let resolutionTimeHours: number | null = null;

    if (editData.first_response_at && ticket.reported_at) {
      responseTimeMins = differenceInMinutes(
        new Date(editData.first_response_at),
        new Date(ticket.reported_at)
      );

      if (contract) {
        const priorityMap: Record<string, number | null> = {
          critical: contract.p1_response_mins,
          high: contract.p2_response_mins,
          medium: contract.p3_response_mins,
          low: contract.p4_response_mins,
        };
        const expectedResponse = priorityMap[ticket.priority];
        if (expectedResponse) {
          slaResponseMet = responseTimeMins <= expectedResponse;
        }
      }
    }

    if (editData.resolved_at && ticket.reported_at) {
      resolutionTimeHours = differenceInHours(
        new Date(editData.resolved_at),
        new Date(ticket.reported_at)
      );

      if (contract) {
        const priorityMap: Record<string, number | null> = {
          critical: contract.p1_resolution_hrs,
          high: contract.p2_resolution_hrs,
          medium: contract.p3_resolution_hrs,
          low: contract.p4_resolution_hrs,
        };
        const expectedResolution = priorityMap[ticket.priority];
        if (expectedResolution) {
          slaResolutionMet = resolutionTimeHours <= expectedResolution;
        }
      }
    }

    // Calculate service score
    const score = calculateServiceScore();

    const { error } = await supabase
      .from("service_tickets")
      .update({
        status: editData.status,
        assigned_to: editData.assigned_to || null,
        solution_provided: editData.solution_provided || null,
        first_response_at: editData.first_response_at || null,
        resolved_at: editData.resolved_at || null,
        response_time_mins: responseTimeMins,
        resolution_time_hours: resolutionTimeHours,
        sla_response_met: slaResponseMet,
        sla_resolution_met: slaResolutionMet,
        service_contract_id: editData.service_contract_id || null,
        spares_used: editData.spares_used,
        spares_cost: editData.spares_cost || null,
        labour_hours: editData.labour_hours || null,
        labour_cost: editData.labour_cost || null,
        travel_distance_km: editData.travel_distance_km || null,
        travel_cost: editData.travel_cost || null,
        service_score: score,
      })
      .eq("id", ticket.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update ticket", variant: "destructive" });
    } else {
      toast({ title: "Updated", description: "Ticket updated successfully" });
      setEditing(false);
      fetchTicketDetails();
      onUpdate();
    }

    setSaving(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Good";
    if (score >= 60) return "Fair";
    if (score >= 40) return "Poor";
    return "Critical";
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "sla":
        return <Clock className="h-4 w-4" />;
      case "labour":
        return <Wrench className="h-4 w-4" />;
      case "travel":
        return <Car className="h-4 w-4" />;
      case "spares":
        return <Package className="h-4 w-4" />;
      case "response":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!ticket) {
    return null;
  }

  const serviceScore = calculateServiceScore();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                {ticket.ticket_number}
                <Badge variant={ticket.priority === "critical" ? "destructive" : "secondary"}>
                  {ticket.priority}
                </Badge>
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{ticket.title}</p>
            </div>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Save
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6 pt-4">
          <div className="space-y-6">
            {/* Service Score Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Service Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className={`text-4xl font-bold ${getScoreColor(serviceScore)}`}>
                    {serviceScore}%
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">{getScoreLabel(serviceScore)}</span>
                      <span className="text-sm text-muted-foreground">
                        {adherenceItems.filter((i) => i.is_compliant).length}/{adherenceItems.length} items compliant
                      </span>
                    </div>
                    <Progress value={serviceScore} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ticket Details & Contract Link */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Ticket Info</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Store:</span>
                    <span>{ticket.store?.name || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Asset:</span>
                    <span>{ticket.asset?.name || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reported:</span>
                    <span>{format(new Date(ticket.reported_at), "dd MMM yyyy HH:mm")}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status:</span>
                    {editing ? (
                      <Select value={editData.status} onValueChange={(v) => setEditData((p) => ({ ...p, status: v }))}>
                        <SelectTrigger className="w-32 h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="pending_parts">Pending Parts</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge>{ticket.status}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Service Contract</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  {editing ? (
                    <Select
                      value={editData.service_contract_id}
                      onValueChange={handleContractChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Link to contract..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">No Contract</SelectItem>
                        {contracts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.contract_number} - {c.service_provider?.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : contract ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Contract:</span>
                        <span>{contract.contract_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Provider:</span>
                        <span>{contract.service_provider?.name || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Support:</span>
                        <span>{contract.support_hours === "24x7" ? "24x7" : "Business Hours"}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No contract linked</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* SLA Tracking */}
            {editing && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Response & Resolution</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">First Response At</label>
                    <Input
                      type="datetime-local"
                      value={editData.first_response_at}
                      onChange={(e) => setEditData((p) => ({ ...p, first_response_at: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Resolved At</label>
                    <Input
                      type="datetime-local"
                      value={editData.resolved_at}
                      onChange={(e) => setEditData((p) => ({ ...p, resolved_at: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Assigned To</label>
                    <Input
                      value={editData.assigned_to}
                      onChange={(e) => setEditData((p) => ({ ...p, assigned_to: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Solution Provided</label>
                    <Textarea
                      value={editData.solution_provided}
                      onChange={(e) => setEditData((p) => ({ ...p, solution_provided: e.target.value }))}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cost Tracking */}
            {editing && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Cost Tracking</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Labour Hours</label>
                    <Input
                      type="number"
                      value={editData.labour_hours || ""}
                      onChange={(e) => setEditData((p) => ({ ...p, labour_hours: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Labour Cost (₹)</label>
                    <Input
                      type="number"
                      value={editData.labour_cost || ""}
                      onChange={(e) => setEditData((p) => ({ ...p, labour_cost: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={editData.spares_used}
                      onCheckedChange={(c) => setEditData((p) => ({ ...p, spares_used: !!c }))}
                    />
                    <label className="text-sm">Spares Used</label>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Spares Cost (₹)</label>
                    <Input
                      type="number"
                      value={editData.spares_cost || ""}
                      onChange={(e) => setEditData((p) => ({ ...p, spares_cost: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Travel Distance (km)</label>
                    <Input
                      type="number"
                      value={editData.travel_distance_km || ""}
                      onChange={(e) => setEditData((p) => ({ ...p, travel_distance_km: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Travel Cost (₹)</label>
                    <Input
                      type="number"
                      value={editData.travel_cost || ""}
                      onChange={(e) => setEditData((p) => ({ ...p, travel_cost: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contract Adherence Checklist */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Contract Adherence Checklist</span>
                  {contract && (
                    <Badge variant="outline" className="font-normal">
                      {adherenceItems.filter((i) => i.is_compliant).length}/{adherenceItems.length} compliant
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {adherenceItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {contract
                      ? "Adherence checklist will be generated when contract terms are tracked."
                      : "Link a service contract to generate adherence checklist."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {["sla", "labour", "travel", "spares", "consumables", "response"].map((category) => {
                      const categoryItems = adherenceItems.filter((i) => i.category === category);
                      if (categoryItems.length === 0) return null;

                      return (
                        <div key={category}>
                          <div className="flex items-center gap-2 mb-2">
                            {getCategoryIcon(category)}
                            <span className="text-sm font-medium capitalize">{category}</span>
                          </div>
                          <div className="space-y-2 ml-6">
                            {categoryItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-2 rounded-lg border bg-muted/30"
                              >
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={item.is_compliant}
                                    onCheckedChange={(checked) => handleAdherenceToggle(item.id, !!checked)}
                                  />
                                  <div>
                                    <p className="text-sm font-medium">{item.item_name}</p>
                                    <div className="flex gap-4 text-xs text-muted-foreground">
                                      <span>Expected: {item.expected_value || "-"}</span>
                                      <span>Actual: {item.actual_value || "-"}</span>
                                    </div>
                                  </div>
                                </div>
                                {item.is_compliant ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
