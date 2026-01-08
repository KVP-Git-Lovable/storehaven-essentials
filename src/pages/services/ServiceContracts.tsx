import { useState, useEffect } from "react";
import { Plus, FileText, CheckCircle, Clock, AlertTriangle, Loader2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/StatCard";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { serviceContractSchema, type ServiceContractFormData } from "@/lib/schemas";
import { supabase } from "@/integrations/supabase/client";

const serviceTypes = ["HVAC AMC", "CCTV Maintenance", "Generator Service", "POS Maintenance", "Fire Safety", "Electrical AMC"];

type ServiceContract = {
  id: string;
  vendor: string;
  service_type: string;
  start_date: string;
  end_date: string;
  value: number;
  status: string;
};

type Asset = {
  id: string;
  name: string;
  asset_number: string | null;
};

type Vendor = {
  id: string;
  name: string;
};

const stats = [
  { title: "Total Contracts", value: "24", icon: FileText, iconColor: "bg-primary/10 text-primary" },
  { title: "Active", value: "18", icon: CheckCircle, iconColor: "bg-success/10 text-success" },
  { title: "Expiring Soon", value: "4", icon: Clock, iconColor: "bg-warning/10 text-warning" },
  { title: "Expired", value: "2", icon: AlertTriangle, iconColor: "bg-destructive/10 text-destructive" },
];

export default function ServiceContracts() {
  const [contracts, setContracts] = useState<ServiceContract[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [contractAssets, setContractAssets] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<ServiceContractFormData>({
    resolver: zodResolver(serviceContractSchema),
    defaultValues: {
      vendor: "",
      serviceType: "",
      startDate: "",
      endDate: "",
      value: 0,
      assetIds: [],
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [contractsRes, assetsRes, vendorsRes, contractAssetsRes] = await Promise.all([
      supabase.from("service_contracts").select("*").order("created_at", { ascending: false }),
      supabase.from("assets").select("id, name, asset_number").order("name"),
      supabase.from("vendors").select("id, name").order("name"),
      supabase.from("service_contract_assets").select("*"),
    ]);

    if (contractsRes.error) {
      toast({ title: "Error", description: "Failed to load contracts", variant: "destructive" });
    } else {
      setContracts(contractsRes.data || []);
    }

    setAssets(assetsRes.data || []);
    setVendors(vendorsRes.data || []);

    // Map contract IDs to asset IDs
    if (contractAssetsRes.data) {
      const mapping: Record<string, string[]> = {};
      contractAssetsRes.data.forEach((ca: { service_contract_id: string; asset_id: string }) => {
        if (!mapping[ca.service_contract_id]) {
          mapping[ca.service_contract_id] = [];
        }
        mapping[ca.service_contract_id].push(ca.asset_id);
      });
      setContractAssets(mapping);
    }

    setLoading(false);
  };

  const onSubmit = async (data: ServiceContractFormData) => {
    // Insert the service contract
    const { data: newContract, error } = await supabase.from("service_contracts").insert({
      vendor: data.vendor,
      service_type: data.serviceType,
      start_date: data.startDate,
      end_date: data.endDate,
      value: data.value,
      status: "active",
    }).select().single();

    if (error || !newContract) {
      toast({ title: "Error", description: "Failed to add contract", variant: "destructive" });
      return;
    }

    // Insert the contract-asset relationships
    if (data.assetIds.length > 0) {
      const assetLinks = data.assetIds.map((assetId) => ({
        service_contract_id: newContract.id,
        asset_id: assetId,
      }));

      const { error: linkError } = await supabase.from("service_contract_assets").insert(assetLinks);
      if (linkError) {
        toast({ title: "Warning", description: "Contract created but failed to link assets", variant: "destructive" });
      }
    }

    toast({ title: "Contract added", description: `Service contract with ${data.vendor} has been created.` });
    form.reset();
    setOpen(false);
    fetchData();
  };

  const getAssetNames = (contractId: string) => {
    const assetIds = contractAssets[contractId] || [];
    return assetIds.map(id => {
      const asset = assets.find(a => a.id === id);
      return asset?.name || "Unknown";
    }).join(", ") || "-";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Service Contracts</h1>
          <p className="text-muted-foreground">Manage AMC and service agreements</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Contract
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Service Contract</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="vendor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.name}>{vendor.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {serviceTypes.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assetIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assets Covered</FormLabel>
                      <div className="border rounded-md p-2">
                        {field.value.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {field.value.map((assetId) => {
                              const asset = assets.find(a => a.id === assetId);
                              return (
                                <Badge key={assetId} variant="secondary" className="gap-1">
                                  {asset?.name || assetId}
                                  <button
                                    type="button"
                                    onClick={() => field.onChange(field.value.filter(id => id !== assetId))}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                        <ScrollArea className="h-40">
                          <div className="space-y-2">
                            {assets.map((asset) => (
                              <div key={asset.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={asset.id}
                                  checked={field.value.includes(asset.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...field.value, asset.id]);
                                    } else {
                                      field.onChange(field.value.filter(id => id !== asset.id));
                                    }
                                  }}
                                />
                                <label htmlFor={asset.id} className="text-sm cursor-pointer">
                                  {asset.asset_number ? `${asset.asset_number} - ` : ""}{asset.name}
                                </label>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Value (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Contract value" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Contract</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Service Type</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell className="font-medium">{contract.vendor}</TableCell>
                <TableCell>{contract.service_type}</TableCell>
                <TableCell className="max-w-[200px] truncate">{getAssetNames(contract.id)}</TableCell>
                <TableCell>₹{Number(contract.value).toLocaleString()}</TableCell>
                <TableCell className="text-sm">
                  {new Date(contract.start_date).toLocaleDateString()} - {new Date(contract.end_date).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      contract.status === "active" ? "default" :
                      contract.status === "expiring" ? "secondary" : "destructive"
                    }
                  >
                    {contract.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}