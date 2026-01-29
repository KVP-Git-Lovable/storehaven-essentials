import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, FileText, Zap, Loader2, Calendar, MapPin, Building2, Wrench, History, Clock } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Asset = {
  id: string;
  name: string;
  asset_number: string | null;
  category: string;
  category_id: string | null;
  location: string;
  condition: string;
  asset_status: string;
  purchase_date: string;
  value: number;
  vendor_id: string | null;
  oem_id: string | null;
  warranty_start_date: string | null;
  warranty_end_date: string | null;
  created_at: string;
  updated_at: string;
};

type Vendor = {
  id: string;
  name: string;
  vendor_type: string;
};

type ServiceContract = {
  id: string;
  contract_number: string;
  customer_name: string;
  contract_type: string;
  contract_value: number;
  start_date: string;
  end_date: string;
  status: string;
  service_provider?: { name: string } | null;
};

type UtilityReading = {
  id: string;
  reading_date: string;
  store: string;
  readings: Record<string, unknown>;
  meter_master: { name: string } | null;
};

type StatusHistory = {
  id: string;
  asset_id: string;
  status: string;
  changed_at: string;
  changed_by: string;
};

const conditionLabels: Record<string, string> = {
  "under-warranty": "Under Warranty",
  "under-amc": "Under AMC",
  "need-based-support": "Need Based Support",
  "no-service-support": "No Service Support",
};

const conditionColors: Record<string, string> = {
  "under-warranty": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  "under-amc": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  "need-based-support": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  "no-service-support": "bg-muted text-muted-foreground",
};

const assetStatusOptions = [
  { value: "requisition-raised", label: "Requisition Raised" },
  { value: "procurement-planned", label: "Procurement Planned" },
  { value: "po-issued", label: "PO Issued" },
  { value: "product-received", label: "Product Received" },
  { value: "shipped-to-store", label: "Shipped to Store" },
  { value: "installation-fixed", label: "Installation Fixed" },
  { value: "installed", label: "Installed" },
  { value: "working", label: "Working" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "drop", label: "Drop" },
];

const getStatusLabel = (status: string) => {
  return assetStatusOptions.find((opt) => opt.value === status)?.label || status;
};

export default function AssetDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [asset, setAsset] = useState<Asset | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [serviceContracts, setServiceContracts] = useState<ServiceContract[]>([]);
  const [utilityReadings, setUtilityReadings] = useState<UtilityReading[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (id) {
      fetchAssetDetails();
    }
  }, [id]);

  const fetchAssetDetails = async () => {
    setLoading(true);
    
    // Fetch asset details
    const { data: assetData, error: assetError } = await supabase
      .from("assets")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (assetError || !assetData) {
      toast({ title: "Error", description: "Asset not found", variant: "destructive" });
      navigate("/assets/inventory");
      return;
    }

    setAsset(assetData);

    // Fetch related data in parallel
    const [vendorsRes, contractAssetsRes, readingsRes, historyRes] = await Promise.all([
      supabase.from("vendors").select("id, name, vendor_type"),
      supabase
        .from("service_contract_assets")
        .select("service_contract_id")
        .eq("asset_id", id),
      supabase
        .from("utility_readings")
        .select("id, reading_date, store, readings, meter_master:meter_masters(name)")
        .eq("asset_id", id)
        .order("reading_date", { ascending: false })
        .limit(10),
      supabase
        .from("asset_status_history")
        .select("*")
        .eq("asset_id", id)
        .order("changed_at", { ascending: false }),
    ]);

    setVendors(vendorsRes.data || []);
    setUtilityReadings(readingsRes.data as UtilityReading[] || []);
    setStatusHistory(historyRes.data || []);

    // Fetch service contracts if there are linked ones
    if (contractAssetsRes.data && contractAssetsRes.data.length > 0) {
      const contractIds = contractAssetsRes.data.map((ca) => ca.service_contract_id);
      const { data: contractsData } = await supabase
        .from("service_contracts")
        .select("id, contract_number, customer_name, contract_type, contract_value, start_date, end_date, status, service_provider:service_provider_id(name)")
        .in("id", contractIds)
        .order("end_date", { ascending: false });
      
      setServiceContracts(contractsData as ServiceContract[] || []);
    }

    setLoading(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!asset || newStatus === asset.asset_status) return;
    
    setUpdatingStatus(true);
    
    // Update asset status
    const { error: updateError } = await supabase
      .from("assets")
      .update({ asset_status: newStatus })
      .eq("id", asset.id);
    
    if (updateError) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
      setUpdatingStatus(false);
      return;
    }
    
    // Insert status history record
    const { error: historyError } = await supabase
      .from("asset_status_history")
      .insert({
        asset_id: asset.id,
        status: newStatus,
        changed_by: "System",
      });
    
    if (historyError) {
      console.error("Failed to record status history:", historyError);
    }
    
    toast({ title: "Status Updated", description: `Asset status changed to ${getStatusLabel(newStatus)}` });
    
    // Refresh data
    await fetchAssetDetails();
    setUpdatingStatus(false);
  };

  const getVendorName = (vendorId: string | null) => {
    if (!vendorId) return "-";
    const vendor = vendors.find((v) => v.id === vendorId);
    return vendor?.name || "-";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      expired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!asset) {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/assets/inventory")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{asset.name}</h1>
            <Badge className={conditionColors[asset.condition]}>
              {conditionLabels[asset.condition] || asset.condition}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono">{asset.asset_number || "No Asset #"}</p>
        </div>
      </div>

      {/* Asset Status Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Asset Status
          </CardTitle>
          <CardDescription>
            Current lifecycle stage of this asset
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select
              value={asset.asset_status || "requisition-raised"}
              onValueChange={handleStatusChange}
              disabled={updatingStatus}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {assetStatusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {updatingStatus && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </CardContent>
      </Card>

      {/* Asset Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Asset Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="font-medium">{asset.category}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {asset.location}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Purchase Date</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(asset.purchase_date)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Value</p>
                <p className="font-medium text-lg">₹{Number(asset.value).toLocaleString()}</p>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Vendor Procured From</p>
                <p className="font-medium flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  {getVendorName(asset.vendor_id)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">OEM</p>
                <p className="font-medium">{getVendorName(asset.oem_id)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Warranty Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Warranty Start</p>
                <p className="font-medium">{formatDate(asset.warranty_start_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Warranty End</p>
                <p className="font-medium">{formatDate(asset.warranty_end_date)}</p>
              </div>
            </div>
            {asset.warranty_end_date && (
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm">
                  {new Date(asset.warranty_end_date) > new Date() 
                    ? `Warranty valid for ${Math.ceil((new Date(asset.warranty_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} more days`
                    : "Warranty has expired"
                  }
                </p>
              </div>
            )}
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <p>Created</p>
                <p className="text-foreground">{formatDate(asset.created_at)}</p>
              </div>
              <div>
                <p>Last Updated</p>
                <p className="text-foreground">{formatDate(asset.updated_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Trail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Audit Trail
          </CardTitle>
          <CardDescription>
            Status change history for this asset
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statusHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No status changes recorded yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Changed At</TableHead>
                  <TableHead>Changed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statusHistory.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Badge variant="secondary">
                        {getStatusLabel(record.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(record.changed_at)}</TableCell>
                    <TableCell>{record.changed_by}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Service Contracts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Linked Service Contracts
          </CardTitle>
          <CardDescription>
            Service contracts associated with this asset
          </CardDescription>
        </CardHeader>
        <CardContent>
          {serviceContracts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No service contracts linked to this asset</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceContracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.contract_number}</TableCell>
                    <TableCell className="capitalize">{contract.contract_type}</TableCell>
                    <TableCell>{contract.service_provider?.name || "-"}</TableCell>
                    <TableCell>
                      {formatDate(contract.start_date)} - {formatDate(contract.end_date)}
                    </TableCell>
                    <TableCell>₹{Number(contract.contract_value).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(contract.status)}>
                        {contract.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Utility Readings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Utility Readings
          </CardTitle>
          <CardDescription>
            Recent utility readings for this asset (last 10)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {utilityReadings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No utility readings recorded for this asset</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Meter Type</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Readings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {utilityReadings.map((reading) => (
                  <TableRow key={reading.id}>
                    <TableCell>{formatDate(reading.reading_date)}</TableCell>
                    <TableCell>{reading.meter_master?.name || "-"}</TableCell>
                    <TableCell>{reading.store}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {Object.entries(reading.readings || {}).map(([key, value]) => (
                        <span key={key} className="mr-3">
                          {key}: {String(value)}
                        </span>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}