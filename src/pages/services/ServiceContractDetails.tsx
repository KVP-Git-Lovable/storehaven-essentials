import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, FileText, Building2, Calendar, IndianRupee, Clock, 
  Users, Wrench, MapPin, Download, Shield, AlertTriangle, CheckCircle,
  Phone, Mail, Loader2, Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";

type ServiceContract = {
  id: string;
  contract_number: string;
  customer_name: string;
  customer_address: string | null;
  contract_type: string;
  contract_value: number;
  effective_date: string;
  start_date: string;
  end_date: string;
  status: string;
  auto_renewal: boolean | null;
  renewal_notice_days: number | null;
  pricing_model: string | null;
  invoice_frequency: string | null;
  payment_terms_days: number | null;
  annual_escalation_percent: number | null;
  service_types: string[] | null;
  labour_included: boolean | null;
  labour_rate_per_hour: number | null;
  labour_hours_included: number | null;
  travel_included: boolean | null;
  travel_radius_km: number | null;
  travel_rate_per_km: number | null;
  visit_charge: number | null;
  spares_included: boolean | null;
  spares_coverage_percent: number | null;
  spares_max_value: number | null;
  spares_excluded_items: string | null;
  consumables_included: boolean | null;
  consumables_limit: number | null;
  support_hours: string | null;
  support_hours_custom: string | null;
  after_hours_multiplier: number | null;
  p1_response_mins: number | null;
  p1_resolution_hrs: number | null;
  p2_response_mins: number | null;
  p2_resolution_hrs: number | null;
  p3_response_mins: number | null;
  p3_resolution_hrs: number | null;
  p4_response_mins: number | null;
  p4_resolution_hrs: number | null;
  sla_penalties: boolean | null;
  sla_penalty_details: string | null;
  target_uptime_percent: number | null;
  uptime_measurement_method: string | null;
  pm_frequency: string | null;
  pm_task_type: string | null;
  pm_checklist_items: string[] | null;
  pm_checklist_attached: boolean | null;
  penalty_applicable: boolean | null;
  penalty_type: string | null;
  penalty_rate_percent: number | null;
  penalty_grace_period_days: number | null;
  penalty_max_percent: number | null;
  penalty_calculation_basis: string | null;
  penalty_notes: string | null;
  escalation_l1_name: string | null;
  escalation_l1_phone: string | null;
  escalation_l1_email: string | null;
  escalation_l2_name: string | null;
  escalation_l2_phone: string | null;
  escalation_l2_email: string | null;
  escalation_l3_name: string | null;
  escalation_l3_phone: string | null;
  escalation_l3_email: string | null;
  notes: string | null;
  exclusions: string | null;
  created_at: string;
  updated_at: string;
  service_provider?: { id: string; name: string } | null;
};

type LinkedAsset = {
  id: string;
  asset_id: string;
  asset: {
    id: string;
    name: string;
    asset_number: string | null;
    condition: string;
    store: { id: string; name: string } | null;
  } | null;
};

type LinkedLocation = {
  id: string;
  store_id: string;
  store: {
    id: string;
    name: string;
    address: string;
  } | null;
};

type Attachment = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  attachment_type: string | null;
  uploaded_at: string;
};

const contractTypeLabels: Record<string, string> = {
  amc: "AMC",
  warranty: "Warranty",
  sla: "On Call", // Legacy support
  "on-call": "On Call",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  expiring: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  expired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  terminated: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const conditionLabels: Record<string, string> = {
  "under-warranty": "Under Warranty",
  "under-amc": "Under AMC",
  "need-based-support": "Need Based Support",
  "no-service-support": "No Service Support",
};

export default function ServiceContractDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [contract, setContract] = useState<ServiceContract | null>(null);
  const [linkedAssets, setLinkedAssets] = useState<LinkedAsset[]>([]);
  const [linkedLocations, setLinkedLocations] = useState<LinkedLocation[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchContractDetails();
    }
  }, [id]);

  const fetchContractDetails = async () => {
    setLoading(true);
    
    // Fetch contract details with service provider
    const { data: contractData, error: contractError } = await supabase
      .from("service_contracts")
      .select(`
        *,
        service_provider:service_provider_id(id, name)
      `)
      .eq("id", id)
      .maybeSingle();

    if (contractError || !contractData) {
      toast({ title: "Error", description: "Contract not found", variant: "destructive" });
      navigate("/services/contracts");
      return;
    }

    setContract(contractData as ServiceContract);

    // Fetch related data in parallel
    const [assetsRes, locationsRes, attachmentsRes] = await Promise.all([
      supabase
        .from("service_contract_assets")
        .select(`
          id,
          asset_id,
          asset:assets(id, name, asset_number, condition, store:stores(id, name))
        `)
        .eq("service_contract_id", id),
      supabase
        .from("service_contract_locations")
        .select(`
          id,
          store_id,
          store:stores(id, name, address)
        `)
        .eq("service_contract_id", id),
      supabase
        .from("service_contract_attachments")
        .select("*")
        .eq("service_contract_id", id)
        .order("uploaded_at", { ascending: false }),
    ]);

    setLinkedAssets(assetsRes.data as LinkedAsset[] || []);
    setLinkedLocations(locationsRes.data as LinkedLocation[] || []);
    setAttachments(attachmentsRes.data || []);

    setLoading(false);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(new Date(dateStr), "dd MMM yyyy");
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDaysRemaining = () => {
    if (!contract) return 0;
    return differenceInDays(new Date(contract.end_date), new Date());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contract) {
    return null;
  }

  const daysRemaining = getDaysRemaining();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/services/contracts")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{contract.contract_number}</h1>
            <Badge className={statusColors[contract.status] || "bg-muted"}>
              {contract.status}
            </Badge>
            <Badge variant="outline">
              {contractTypeLabels[contract.contract_type] || contract.contract_type}
            </Badge>
          </div>
          <p className="text-muted-foreground">{contract.customer_name}</p>
          {contract.service_provider?.name && (
            <p className="text-sm text-muted-foreground">
              Provider: {contract.service_provider.name}
            </p>
          )}
        </div>
      </div>

      {/* Contract Duration Banner */}
      {daysRemaining <= 30 && daysRemaining > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-warning border border-warning/20">
          <Clock className="h-5 w-5" />
          <span className="font-medium">Expires in {daysRemaining} days</span>
        </div>
      )}
      {daysRemaining <= 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">Contract expired {Math.abs(daysRemaining)} days ago</span>
        </div>
      )}

      {/* Contract Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contract Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Effective Date</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(contract.effective_date)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contract Value</p>
                <p className="font-medium flex items-center gap-1">
                  <IndianRupee className="h-4 w-4" />
                  ₹{Number(contract.contract_value).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Start Date</p>
                <p className="font-medium">{formatDate(contract.start_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">End Date</p>
                <p className="font-medium">{formatDate(contract.end_date)}</p>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Auto Renewal</p>
                <p className="font-medium">{contract.auto_renewal ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Renewal Notice</p>
                <p className="font-medium">{contract.renewal_notice_days ? `${contract.renewal_notice_days} days` : "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pricing Model</p>
                <p className="font-medium capitalize">{contract.pricing_model || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Invoice Frequency</p>
                <p className="font-medium capitalize">{contract.invoice_frequency || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Terms</p>
                <p className="font-medium">{contract.payment_terms_days ? `${contract.payment_terms_days} days` : "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Annual Escalation</p>
                <p className="font-medium">{contract.annual_escalation_percent ? `${contract.annual_escalation_percent}%` : "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scope & Coverage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Scope & Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contract.service_types && contract.service_types.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Service Types</p>
                <div className="flex flex-wrap gap-1">
                  {contract.service_types.map((type, i) => (
                    <Badge key={i} variant="secondary" className="capitalize">{type}</Badge>
                  ))}
                </div>
              </div>
            )}
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Labour</p>
                <p className="font-medium">
                  {contract.labour_included 
                    ? contract.labour_hours_included 
                      ? `${contract.labour_hours_included} hrs included` 
                      : "Included"
                    : contract.labour_rate_per_hour 
                      ? `₹${contract.labour_rate_per_hour}/hr` 
                      : "Not included"
                  }
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Travel</p>
                <p className="font-medium">
                  {contract.travel_included 
                    ? contract.travel_radius_km 
                      ? `Within ${contract.travel_radius_km} km` 
                      : "Included"
                    : contract.travel_rate_per_km 
                      ? `₹${contract.travel_rate_per_km}/km` 
                      : "Not included"
                  }
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Spares</p>
                <p className="font-medium">
                  {contract.spares_included 
                    ? contract.spares_coverage_percent 
                      ? `${contract.spares_coverage_percent}% covered` 
                      : "Included"
                    : "Not included"
                  }
                  {contract.spares_max_value && ` (max ₹${contract.spares_max_value.toLocaleString()})`}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Consumables</p>
                <p className="font-medium">
                  {contract.consumables_included 
                    ? contract.consumables_limit 
                      ? `Up to ₹${contract.consumables_limit.toLocaleString()}` 
                      : "Included"
                    : "Not included"
                  }
                </p>
              </div>
              {contract.visit_charge && (
                <div>
                  <p className="text-muted-foreground">Visit Charge</p>
                  <p className="font-medium">₹{contract.visit_charge.toLocaleString()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SLA Matrix */}
      {(contract.p1_response_mins || contract.p2_response_mins || contract.p3_response_mins || contract.p4_response_mins) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              SLA Matrix
            </CardTitle>
            <CardDescription>
              {contract.support_hours ? `Support: ${contract.support_hours}` : ""}
              {contract.support_hours_custom && ` (${contract.support_hours_custom})`}
              {contract.after_hours_multiplier && ` | After hours: ${contract.after_hours_multiplier}x`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Response Time</TableHead>
                  <TableHead>Resolution Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contract.p1_response_mins && (
                  <TableRow>
                    <TableCell><Badge variant="destructive">P1 - Critical</Badge></TableCell>
                    <TableCell>{contract.p1_response_mins} mins</TableCell>
                    <TableCell>{contract.p1_resolution_hrs ? `${contract.p1_resolution_hrs} hrs` : "-"}</TableCell>
                  </TableRow>
                )}
                {contract.p2_response_mins && (
                  <TableRow>
                    <TableCell><Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">P2 - High</Badge></TableCell>
                    <TableCell>{contract.p2_response_mins} mins</TableCell>
                    <TableCell>{contract.p2_resolution_hrs ? `${contract.p2_resolution_hrs} hrs` : "-"}</TableCell>
                  </TableRow>
                )}
                {contract.p3_response_mins && (
                  <TableRow>
                    <TableCell><Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">P3 - Medium</Badge></TableCell>
                    <TableCell>{contract.p3_response_mins} mins</TableCell>
                    <TableCell>{contract.p3_resolution_hrs ? `${contract.p3_resolution_hrs} hrs` : "-"}</TableCell>
                  </TableRow>
                )}
                {contract.p4_response_mins && (
                  <TableRow>
                    <TableCell><Badge variant="secondary">P4 - Low</Badge></TableCell>
                    <TableCell>{contract.p4_response_mins} mins</TableCell>
                    <TableCell>{contract.p4_resolution_hrs ? `${contract.p4_resolution_hrs} hrs` : "-"}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {contract.sla_penalties && contract.sla_penalty_details && (
              <div className="mt-4 p-3 rounded-lg bg-muted">
                <p className="text-sm font-medium">SLA Penalties</p>
                <p className="text-sm text-muted-foreground">{contract.sla_penalty_details}</p>
              </div>
            )}
            {contract.target_uptime_percent && (
              <div className="mt-4 flex items-center gap-4">
                <span className="text-sm text-muted-foreground">Target Uptime:</span>
                <Badge variant="outline">{contract.target_uptime_percent}%</Badge>
                {contract.uptime_measurement_method && (
                  <span className="text-sm text-muted-foreground">({contract.uptime_measurement_method})</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* PM Schedule */}
      {contract.pm_frequency && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Preventive Maintenance Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Frequency</p>
                <p className="font-medium capitalize">{contract.pm_frequency}</p>
              </div>
              {contract.pm_task_type && (
                <div>
                  <p className="text-sm text-muted-foreground">Task Type</p>
                  <p className="font-medium capitalize">{contract.pm_task_type}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Checklist Attached</p>
                <p className="font-medium">{contract.pm_checklist_attached ? "Yes" : "No"}</p>
              </div>
            </div>
            {contract.pm_checklist_items && contract.pm_checklist_items.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Checklist Items</p>
                  <ul className="space-y-1">
                    {contract.pm_checklist_items.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Penalty Clauses */}
      {contract.penalty_applicable && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Penalty Clauses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Penalty Type</p>
                <p className="font-medium capitalize">{contract.penalty_type || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rate</p>
                <p className="font-medium">{contract.penalty_rate_percent ? `${contract.penalty_rate_percent}%` : "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Grace Period</p>
                <p className="font-medium">{contract.penalty_grace_period_days ? `${contract.penalty_grace_period_days} days` : "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Max Penalty</p>
                <p className="font-medium">{contract.penalty_max_percent ? `${contract.penalty_max_percent}%` : "-"}</p>
              </div>
            </div>
            {contract.penalty_calculation_basis && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Calculation Basis</p>
                <p className="font-medium">{contract.penalty_calculation_basis}</p>
              </div>
            )}
            {contract.penalty_notes && (
              <div className="mt-4 p-3 rounded-lg bg-muted">
                <p className="text-sm">{contract.penalty_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Escalation Contacts */}
      {(contract.escalation_l1_name || contract.escalation_l2_name || contract.escalation_l3_name) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Escalation Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {contract.escalation_l1_name && (
                <div className="p-4 rounded-lg border">
                  <Badge className="mb-2">L1</Badge>
                  <p className="font-medium">{contract.escalation_l1_name}</p>
                  {contract.escalation_l1_phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Phone className="h-3 w-3" />
                      {contract.escalation_l1_phone}
                    </p>
                  )}
                  {contract.escalation_l1_email && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {contract.escalation_l1_email}
                    </p>
                  )}
                </div>
              )}
              {contract.escalation_l2_name && (
                <div className="p-4 rounded-lg border">
                  <Badge className="mb-2" variant="secondary">L2</Badge>
                  <p className="font-medium">{contract.escalation_l2_name}</p>
                  {contract.escalation_l2_phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Phone className="h-3 w-3" />
                      {contract.escalation_l2_phone}
                    </p>
                  )}
                  {contract.escalation_l2_email && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {contract.escalation_l2_email}
                    </p>
                  )}
                </div>
              )}
              {contract.escalation_l3_name && (
                <div className="p-4 rounded-lg border">
                  <Badge className="mb-2" variant="outline">L3</Badge>
                  <p className="font-medium">{contract.escalation_l3_name}</p>
                  {contract.escalation_l3_phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Phone className="h-3 w-3" />
                      {contract.escalation_l3_phone}
                    </p>
                  )}
                  {contract.escalation_l3_email && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {contract.escalation_l3_email}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Linked Assets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Linked Assets
          </CardTitle>
          <CardDescription>
            {linkedAssets.length} asset{linkedAssets.length !== 1 ? "s" : ""} covered under this contract
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linkedAssets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No assets linked to this contract</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Asset #</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Condition</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linkedAssets.map((item) => (
                  <TableRow 
                    key={item.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => item.asset && navigate(`/assets/inventory/${item.asset.id}`)}
                  >
                    <TableCell className="font-medium">{item.asset?.name || "-"}</TableCell>
                    <TableCell className="font-mono text-sm">{item.asset?.asset_number || "-"}</TableCell>
                    <TableCell>{item.asset?.store?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {conditionLabels[item.asset?.condition || ""] || item.asset?.condition || "-"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Covered Locations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Covered Locations
          </CardTitle>
          <CardDescription>
            {linkedLocations.length} location{linkedLocations.length !== 1 ? "s" : ""} covered
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linkedLocations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No locations linked to this contract</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linkedLocations.map((item) => (
                  <TableRow 
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => item.store && navigate(`/stores/${item.store.id}`)}
                  >
                    <TableCell className="font-medium">{item.store?.name || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{item.store?.address || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Attachments
          </CardTitle>
          <CardDescription>
            Contract documents and files
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No attachments uploaded</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div 
                  key={attachment.id} 
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{attachment.file_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(attachment.file_size)} • {formatDate(attachment.uploaded_at)}
                        {attachment.attachment_type && ` • ${attachment.attachment_type}`}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => window.open(attachment.file_url, "_blank")}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes & Exclusions */}
      {(contract.notes || contract.exclusions) && (
        <Card>
          <CardHeader>
            <CardTitle>Notes & Exclusions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contract.notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                <p className="whitespace-pre-wrap">{contract.notes}</p>
              </div>
            )}
            {contract.exclusions && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Exclusions</p>
                <p className="whitespace-pre-wrap">{contract.exclusions}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
