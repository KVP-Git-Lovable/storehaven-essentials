import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { 
  FileText, 
  Calendar, 
  Building2, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Wrench,
  MapPin,
  ChevronDown,
  ChevronRight,
  Shield,
  Save,
  Edit2,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ContractData {
  id: string;
  contract_number: string;
  customer_name: string;
  contract_type: string;
  contract_value: number;
  start_date: string;
  end_date: string;
  effective_date: string;
  status: string;
  service_types: string[];
  
  // Coverage
  labour_included: boolean;
  labour_rate_per_hour: number | null;
  labour_hours_included: number | null;
  travel_included: boolean;
  travel_radius_km: number | null;
  travel_rate_per_km: number | null;
  spares_included: boolean;
  spares_coverage_percent: number | null;
  spares_max_value: number | null;
  consumables_included: boolean;
  consumables_limit: number | null;
  exclusions: string | null;
  
  // SLA
  support_hours: string;
  support_hours_custom: string | null;
  p1_response_mins: number | null;
  p1_resolution_hrs: number | null;
  p2_response_mins: number | null;
  p2_resolution_hrs: number | null;
  p3_response_mins: number | null;
  p3_resolution_hrs: number | null;
  p4_response_mins: number | null;
  p4_resolution_hrs: number | null;
  
  // PM
  pm_frequency: string | null;
  pm_task_type: string | null;
  
  // Escalation
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
  
  service_provider: { name: string } | null;
}

interface AssetData {
  id: string;
  name: string;
  asset_number: string | null;
  store: { name: string } | null;
}

interface LocationData {
  store: { id: string; name: string; address: string } | null;
}

// Editable fields interface
interface EditableFields {
  // Escalation
  escalation_l1_name: string;
  escalation_l1_phone: string;
  escalation_l1_email: string;
  escalation_l2_name: string;
  escalation_l2_phone: string;
  escalation_l2_email: string;
  escalation_l3_name: string;
  escalation_l3_phone: string;
  escalation_l3_email: string;
  // SLA
  p1_response_mins: string;
  p1_resolution_hrs: string;
  p2_response_mins: string;
  p2_resolution_hrs: string;
  p3_response_mins: string;
  p3_resolution_hrs: string;
  p4_response_mins: string;
  p4_resolution_hrs: string;
  // Notes
  notes: string;
}

export default function VendorContractView() {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<ContractData | null>(null);
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableFields, setEditableFields] = useState<EditableFields>({
    escalation_l1_name: "",
    escalation_l1_phone: "",
    escalation_l1_email: "",
    escalation_l2_name: "",
    escalation_l2_phone: "",
    escalation_l2_email: "",
    escalation_l3_name: "",
    escalation_l3_phone: "",
    escalation_l3_email: "",
    p1_response_mins: "",
    p1_resolution_hrs: "",
    p2_response_mins: "",
    p2_resolution_hrs: "",
    p3_response_mins: "",
    p3_resolution_hrs: "",
    p4_response_mins: "",
    p4_resolution_hrs: "",
    notes: "",
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    coverage: true,
    sla: true,
    pm: false,
    escalation: true,
    assets: false,
    locations: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (token) {
      validateAndFetchContract();
    }
  }, [token]);

  const initializeEditableFields = (contractData: ContractData) => {
    setEditableFields({
      escalation_l1_name: contractData.escalation_l1_name || "",
      escalation_l1_phone: contractData.escalation_l1_phone || "",
      escalation_l1_email: contractData.escalation_l1_email || "",
      escalation_l2_name: contractData.escalation_l2_name || "",
      escalation_l2_phone: contractData.escalation_l2_phone || "",
      escalation_l2_email: contractData.escalation_l2_email || "",
      escalation_l3_name: contractData.escalation_l3_name || "",
      escalation_l3_phone: contractData.escalation_l3_phone || "",
      escalation_l3_email: contractData.escalation_l3_email || "",
      p1_response_mins: contractData.p1_response_mins?.toString() || "",
      p1_resolution_hrs: contractData.p1_resolution_hrs?.toString() || "",
      p2_response_mins: contractData.p2_response_mins?.toString() || "",
      p2_resolution_hrs: contractData.p2_resolution_hrs?.toString() || "",
      p3_response_mins: contractData.p3_response_mins?.toString() || "",
      p3_resolution_hrs: contractData.p3_resolution_hrs?.toString() || "",
      p4_response_mins: contractData.p4_response_mins?.toString() || "",
      p4_resolution_hrs: contractData.p4_resolution_hrs?.toString() || "",
      notes: contractData.notes || "",
    });
  };

  const validateAndFetchContract = async () => {
    setLoading(true);
    setError(null);

    try {
      // Validate token and get contract ID
      const { data: linkData, error: linkError } = await supabase
        .from("service_contract_vendor_links")
        .select("service_contract_id")
        .eq("token", token)
        .eq("is_active", true)
        .maybeSingle();

      if (linkError || !linkData) {
        setError("This link is invalid or has expired.");
        setLoading(false);
        return;
      }

      // Update last accessed timestamp
      await supabase
        .from("service_contract_vendor_links")
        .update({ last_accessed_at: new Date().toISOString() })
        .eq("token", token);

      // Fetch contract details
      const { data: contractData, error: contractError } = await supabase
        .from("service_contracts")
        .select(`
          *,
          service_provider:service_provider_id(name)
        `)
        .eq("id", linkData.service_contract_id)
        .single();

      if (contractError || !contractData) {
        setError("Contract not found.");
        setLoading(false);
        return;
      }

      setContract(contractData);
      initializeEditableFields(contractData);

      // Fetch assets and locations
      const [assetsRes, locationsRes] = await Promise.all([
        supabase
          .from("service_contract_assets")
          .select("asset:asset_id(id, name, asset_number, store:store_id(name))")
          .eq("service_contract_id", linkData.service_contract_id),
        supabase
          .from("service_contract_locations")
          .select("store:store_id(id, name, address)")
          .eq("service_contract_id", linkData.service_contract_id),
      ]);

      if (assetsRes.data) {
        setAssets(assetsRes.data.map((a: any) => a.asset).filter(Boolean));
      }
      if (locationsRes.data) {
        setLocations(locationsRes.data);
      }
    } catch (err) {
      console.error("Error fetching contract:", err);
      setError("An error occurred while loading the contract.");
    }

    setLoading(false);
  };

  const handleSaveChanges = async () => {
    if (!contract) return;
    
    setSaving(true);
    try {
      const updateData = {
        escalation_l1_name: editableFields.escalation_l1_name || null,
        escalation_l1_phone: editableFields.escalation_l1_phone || null,
        escalation_l1_email: editableFields.escalation_l1_email || null,
        escalation_l2_name: editableFields.escalation_l2_name || null,
        escalation_l2_phone: editableFields.escalation_l2_phone || null,
        escalation_l2_email: editableFields.escalation_l2_email || null,
        escalation_l3_name: editableFields.escalation_l3_name || null,
        escalation_l3_phone: editableFields.escalation_l3_phone || null,
        escalation_l3_email: editableFields.escalation_l3_email || null,
        p1_response_mins: editableFields.p1_response_mins ? parseInt(editableFields.p1_response_mins) : null,
        p1_resolution_hrs: editableFields.p1_resolution_hrs ? parseInt(editableFields.p1_resolution_hrs) : null,
        p2_response_mins: editableFields.p2_response_mins ? parseInt(editableFields.p2_response_mins) : null,
        p2_resolution_hrs: editableFields.p2_resolution_hrs ? parseInt(editableFields.p2_resolution_hrs) : null,
        p3_response_mins: editableFields.p3_response_mins ? parseInt(editableFields.p3_response_mins) : null,
        p3_resolution_hrs: editableFields.p3_resolution_hrs ? parseInt(editableFields.p3_resolution_hrs) : null,
        p4_response_mins: editableFields.p4_response_mins ? parseInt(editableFields.p4_response_mins) : null,
        p4_resolution_hrs: editableFields.p4_resolution_hrs ? parseInt(editableFields.p4_resolution_hrs) : null,
        notes: editableFields.notes || null,
        // Mark as vendor update pending review
        vendor_update_status: "pending_review",
        vendor_updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("service_contracts")
        .update(updateData)
        .eq("id", contract.id);

      if (updateError) throw updateError;

      // Update local contract state
      setContract(prev => prev ? { ...prev, ...updateData } : null);
      setIsEditMode(false);
      toast({
        title: "Changes Saved",
        description: "Your updates have been saved successfully.",
      });
    } catch (err) {
      console.error("Error saving changes:", err);
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const handleCancelEdit = () => {
    if (contract) {
      initializeEditableFields(contract);
    }
    setIsEditMode(false);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-success/10 text-success border-success/30";
      case "draft": return "bg-muted text-muted-foreground";
      case "expired": return "bg-destructive/10 text-destructive border-destructive/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const updateField = (field: keyof EditableFields, value: string) => {
    setEditableFields(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Loading contract details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold">Access Denied</h1>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!contract) return null;

  const SectionHeader = ({ 
    title, 
    icon: Icon, 
    section,
    editable = false 
  }: { 
    title: string; 
    icon: React.ElementType; 
    section: string;
    editable?: boolean;
  }) => (
    <CollapsibleTrigger 
      onClick={() => toggleSection(section)}
      className="flex items-center justify-between w-full py-3 hover:bg-muted/50 rounded-lg px-3 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <span className="font-medium">{title}</span>
        {editable && (
          <Badge variant="outline" className="text-xs ml-2">Editable</Badge>
        )}
      </div>
      {expandedSections[section] ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </CollapsibleTrigger>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Service Contract
              </h1>
              <p className="text-sm text-muted-foreground">{contract.contract_number}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(contract.status)}>
                {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
              </Badge>
              {!isEditMode ? (
                <Button size="sm" variant="outline" onClick={() => setIsEditMode(true)} className="gap-2">
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveChanges} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </Button>
                </>
              )}
            </div>
          </div>
          {isEditMode && (
            <p className="text-xs text-muted-foreground mt-2">
              You can edit Escalation Matrix, SLA times, and Notes. Other fields are read-only.
            </p>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Overview Section - Read Only */}
        <Card>
          <Collapsible open={expandedSections.overview}>
            <SectionHeader title="Contract Overview" icon={FileText} section="overview" />
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Contract Type</p>
                    <p className="font-medium">{contract.contract_type.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Contract Value</p>
                    <p className="font-medium">{formatCurrency(contract.contract_value)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="font-medium">{format(new Date(contract.start_date), "dd MMM yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">End Date</p>
                    <p className="font-medium">{format(new Date(contract.end_date), "dd MMM yyyy")}</p>
                  </div>
                  {contract.service_provider && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Service Provider</p>
                      <p className="font-medium">{contract.service_provider.name}</p>
                    </div>
                  )}
                  {contract.service_types && contract.service_types.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-2">Service Types</p>
                      <div className="flex flex-wrap gap-2">
                        {contract.service_types.map((type) => (
                          <Badge key={type} variant="secondary">{type}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Coverage Section - Read Only */}
        <Card>
          <Collapsible open={expandedSections.coverage}>
            <SectionHeader title="Coverage & Entitlements" icon={Shield} section="coverage" />
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    {contract.labour_included ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">Labour {contract.labour_included ? "Included" : "Not Included"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {contract.travel_included ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">Travel {contract.travel_included ? "Included" : "Not Included"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {contract.spares_included ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">
                      Spares {contract.spares_included ? `(${contract.spares_coverage_percent || 0}%)` : "Not Included"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {contract.consumables_included ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">Consumables {contract.consumables_included ? "Included" : "Not Included"}</span>
                  </div>
                </div>
                {contract.exclusions && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Exclusions</p>
                    <p className="text-sm bg-muted/50 p-2 rounded">{contract.exclusions}</p>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* SLA Section - Editable */}
        <Card className={isEditMode ? "ring-2 ring-primary/20" : ""}>
          <Collapsible open={expandedSections.sla}>
            <SectionHeader title="Service Level Agreement" icon={Clock} section="sla" editable />
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Support Hours</p>
                  <p className="font-medium">
                    {contract.support_hours === "custom" 
                      ? contract.support_hours_custom 
                      : contract.support_hours === "24x7" 
                        ? "24x7" 
                        : "Business Hours (9 AM - 6 PM)"}
                  </p>
                </div>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Response & Resolution Times</p>
                  {isEditMode ? (
                    <div className="space-y-4">
                      {[
                        { priority: "P1 - Critical", responseKey: "p1_response_mins" as const, resolutionKey: "p1_resolution_hrs" as const },
                        { priority: "P2 - High", responseKey: "p2_response_mins" as const, resolutionKey: "p2_resolution_hrs" as const },
                        { priority: "P3 - Medium", responseKey: "p3_response_mins" as const, resolutionKey: "p3_resolution_hrs" as const },
                        { priority: "P4 - Low", responseKey: "p4_response_mins" as const, resolutionKey: "p4_resolution_hrs" as const },
                      ].map((p) => (
                        <div key={p.priority} className="p-3 bg-muted/50 rounded-lg space-y-2">
                          <p className="font-medium text-sm">{p.priority}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Response (mins)</Label>
                              <Input
                                type="number"
                                value={editableFields[p.responseKey]}
                                onChange={(e) => updateField(p.responseKey, e.target.value)}
                                placeholder="Minutes"
                                className="h-8 mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Resolution (hrs)</Label>
                              <Input
                                type="number"
                                value={editableFields[p.resolutionKey]}
                                onChange={(e) => updateField(p.resolutionKey, e.target.value)}
                                placeholder="Hours"
                                className="h-8 mt-1"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { priority: "P1 - Critical", response: contract.p1_response_mins, resolution: contract.p1_resolution_hrs },
                        { priority: "P2 - High", response: contract.p2_response_mins, resolution: contract.p2_resolution_hrs },
                        { priority: "P3 - Medium", response: contract.p3_response_mins, resolution: contract.p3_resolution_hrs },
                        { priority: "P4 - Low", response: contract.p4_response_mins, resolution: contract.p4_resolution_hrs },
                      ].filter(p => p.response || p.resolution).map((p) => (
                        <div key={p.priority} className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm">
                          <span className="font-medium">{p.priority}</span>
                          <div className="text-right text-xs">
                            {p.response && <span>Response: {p.response} mins</span>}
                            {p.response && p.resolution && <span className="mx-2">|</span>}
                            {p.resolution && <span>Resolution: {p.resolution} hrs</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* PM Schedule Section - Read Only */}
        {(contract.pm_frequency || contract.pm_task_type) && (
          <Card>
            <Collapsible open={expandedSections.pm}>
              <SectionHeader title="Preventive Maintenance" icon={Wrench} section="pm" />
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    {contract.pm_frequency && (
                      <div>
                        <p className="text-xs text-muted-foreground">Frequency</p>
                        <p className="font-medium capitalize">{contract.pm_frequency}</p>
                      </div>
                    )}
                    {contract.pm_task_type && (
                      <div>
                        <p className="text-xs text-muted-foreground">Task Type</p>
                        <p className="font-medium capitalize">{contract.pm_task_type.replace(/-/g, " ")}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Escalation Matrix - Editable */}
        <Card className={isEditMode ? "ring-2 ring-primary/20" : ""}>
          <Collapsible open={expandedSections.escalation}>
            <SectionHeader title="Escalation Matrix" icon={AlertTriangle} section="escalation" editable />
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                <Separator />
                {isEditMode ? (
                  <div className="space-y-4">
                    {[
                      { level: "Level 1", nameKey: "escalation_l1_name" as const, phoneKey: "escalation_l1_phone" as const, emailKey: "escalation_l1_email" as const },
                      { level: "Level 2", nameKey: "escalation_l2_name" as const, phoneKey: "escalation_l2_phone" as const, emailKey: "escalation_l2_email" as const },
                      { level: "Level 3", nameKey: "escalation_l3_name" as const, phoneKey: "escalation_l3_phone" as const, emailKey: "escalation_l3_email" as const },
                    ].map((e) => (
                      <div key={e.level} className="p-3 bg-muted/50 rounded-lg space-y-3">
                        <p className="font-medium text-sm">{e.level}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Name</Label>
                            <Input
                              value={editableFields[e.nameKey]}
                              onChange={(ev) => updateField(e.nameKey, ev.target.value)}
                              placeholder="Contact name"
                              className="h-8 mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Phone</Label>
                            <Input
                              value={editableFields[e.phoneKey]}
                              onChange={(ev) => updateField(e.phoneKey, ev.target.value)}
                              placeholder="Phone number"
                              className="h-8 mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Email</Label>
                            <Input
                              type="email"
                              value={editableFields[e.emailKey]}
                              onChange={(ev) => updateField(e.emailKey, ev.target.value)}
                              placeholder="Email address"
                              className="h-8 mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[
                      { level: "Level 1", name: contract.escalation_l1_name, phone: contract.escalation_l1_phone, email: contract.escalation_l1_email },
                      { level: "Level 2", name: contract.escalation_l2_name, phone: contract.escalation_l2_phone, email: contract.escalation_l2_email },
                      { level: "Level 3", name: contract.escalation_l3_name, phone: contract.escalation_l3_phone, email: contract.escalation_l3_email },
                    ].filter(e => e.name).map((e) => (
                      <div key={e.level} className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">{e.level}</p>
                        <p className="font-medium">{e.name}</p>
                        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                          {e.phone && <span>{e.phone}</span>}
                          {e.email && <span>{e.email}</span>}
                        </div>
                      </div>
                    ))}
                    {!contract.escalation_l1_name && !contract.escalation_l2_name && !contract.escalation_l3_name && (
                      <p className="text-sm text-muted-foreground">No escalation contacts defined.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Covered Assets - Read Only */}
        {assets.length > 0 && (
          <Card>
            <Collapsible open={expandedSections.assets}>
              <SectionHeader title={`Covered Assets (${assets.length})`} icon={Wrench} section="assets" />
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <Separator />
                  <div className="space-y-2">
                    {assets.map((asset) => (
                      <div key={asset.id} className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm">
                        <div>
                          <p className="font-medium">{asset.name}</p>
                          {asset.asset_number && (
                            <p className="text-xs text-muted-foreground">{asset.asset_number}</p>
                          )}
                        </div>
                        {asset.store && (
                          <span className="text-xs text-muted-foreground">{asset.store.name}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Covered Locations - Read Only */}
        {locations.length > 0 && (
          <Card>
            <Collapsible open={expandedSections.locations}>
              <SectionHeader title={`Covered Locations (${locations.length})`} icon={MapPin} section="locations" />
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <Separator />
                  <div className="space-y-2">
                    {locations.filter(l => l.store).map((loc) => (
                      <div key={loc.store!.id} className="p-2 bg-muted/50 rounded text-sm">
                        <p className="font-medium">{loc.store!.name}</p>
                        <p className="text-xs text-muted-foreground">{loc.store!.address}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Notes - Editable */}
        <Card className={isEditMode ? "ring-2 ring-primary/20" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              Additional Notes
              <Badge variant="outline" className="text-xs">Editable</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditMode ? (
              <Textarea
                value={editableFields.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Add notes or comments..."
                rows={4}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {contract.notes || "No notes added."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-6 text-xs text-muted-foreground">
          <p>You can edit Escalation Matrix, SLA times, and Notes.</p>
          <p>For other changes, please contact your account manager.</p>
        </div>
      </div>
    </div>
  );
}
