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
  Shield
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
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

export default function VendorContractView() {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<ContractData | null>(null);
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    coverage: true,
    sla: true,
    pm: false,
    escalation: false,
    assets: false,
    locations: false,
  });

  useEffect(() => {
    if (token) {
      validateAndFetchContract();
    }
  }, [token]);

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
    section 
  }: { 
    title: string; 
    icon: React.ElementType; 
    section: string 
  }) => (
    <CollapsibleTrigger 
      onClick={() => toggleSection(section)}
      className="flex items-center justify-between w-full py-3 hover:bg-muted/50 rounded-lg px-3 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <span className="font-medium">{title}</span>
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
            <Badge className={getStatusColor(contract.status)}>
              {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Overview Section */}
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

        {/* Coverage Section */}
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

        {/* SLA Section */}
        <Card>
          <Collapsible open={expandedSections.sla}>
            <SectionHeader title="Service Level Agreement" icon={Clock} section="sla" />
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
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Response & Resolution Times</p>
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
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* PM Schedule Section */}
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

        {/* Escalation Matrix */}
        {(contract.escalation_l1_name || contract.escalation_l2_name || contract.escalation_l3_name) && (
          <Card>
            <Collapsible open={expandedSections.escalation}>
              <SectionHeader title="Escalation Matrix" icon={AlertTriangle} section="escalation" />
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <Separator />
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
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {/* Covered Assets */}
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

        {/* Covered Locations */}
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

        {/* Notes */}
        {contract.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{contract.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-6 text-xs text-muted-foreground">
          <p>This is a read-only view of the service contract.</p>
          <p>For any queries, please contact your account manager.</p>
        </div>
      </div>
    </div>
  );
}
