import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, FileText, Zap, Loader2, Calendar, MapPin, Building2, Wrench } from "lucide-react";
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

type Asset = {
  id: string;
  name: string;
  asset_number: string | null;
  category: string;
  category_id: string | null;
  location: string;
  condition: string;
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
  service_type: string;
  vendor: string;
  start_date: string;
  end_date: string;
  value: number;
  status: string;
};

type UtilityReading = {
  id: string;
  reading_date: string;
  store: string;
  readings: Record<string, unknown>;
  meter_master: { name: string } | null;
};

const conditionLabels: Record<string, string> = {
  "under-warranty": "Under Warranty",
  "under-amc": "Under AMC",
  "non-operational": "Non-Operational",
};

const conditionColors: Record<string, string> = {
  "under-warranty": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  "under-amc": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  "non-operational": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function AssetDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [asset, setAsset] = useState<Asset | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [serviceContracts, setServiceContracts] = useState<ServiceContract[]>([]);
  const [utilityReadings, setUtilityReadings] = useState<UtilityReading[]>([]);
  const [loading, setLoading] = useState(true);

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
    const [vendorsRes, contractAssetsRes, readingsRes] = await Promise.all([
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
    ]);

    setVendors(vendorsRes.data || []);
    setUtilityReadings(readingsRes.data as UtilityReading[] || []);

    // Fetch service contracts if there are linked ones
    if (contractAssetsRes.data && contractAssetsRes.data.length > 0) {
      const contractIds = contractAssetsRes.data.map((ca) => ca.service_contract_id);
      const { data: contractsData } = await supabase
        .from("service_contracts")
        .select("*")
        .in("id", contractIds)
        .order("end_date", { ascending: false });
      
      setServiceContracts(contractsData || []);
    }

    setLoading(false);
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
                  <TableHead>Service Type</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceContracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.service_type}</TableCell>
                    <TableCell>{contract.vendor}</TableCell>
                    <TableCell>{formatDate(contract.start_date)}</TableCell>
                    <TableCell>{formatDate(contract.end_date)}</TableCell>
                    <TableCell>₹{Number(contract.value).toLocaleString()}</TableCell>
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
