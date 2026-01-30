import { useState, useEffect } from "react";
import { Plus, FileText, CheckCircle, Clock, AlertTriangle, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ContractSummaryCard } from "@/components/services/ContractSummaryCard";
import { ContractFormDialog } from "@/components/services/ContractFormDialog";
import { differenceInDays } from "date-fns";
import { usePermissions } from "@/hooks/usePermissions";

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

type ContractWithCounts = ServiceContract & {
  assets_count?: number;
  locations_count?: number;
};

export default function ServiceContracts() {
  const [contracts, setContracts] = useState<ContractWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { toast } = useToast();
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission("services.contracts", "create");

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    setLoading(true);
    
    // Fetch contracts with service provider
    const { data: contractsData, error } = await supabase
      .from("service_contracts")
      .select(`
        id,
        contract_number,
        customer_name,
        contract_type,
        contract_value,
        start_date,
        end_date,
        status,
        service_provider:service_provider_id(name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to load contracts", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch asset and location counts
    const [assetsRes, locationsRes] = await Promise.all([
      supabase.from("service_contract_assets").select("service_contract_id"),
      supabase.from("service_contract_locations").select("service_contract_id"),
    ]);

    const assetCounts: Record<string, number> = {};
    const locationCounts: Record<string, number> = {};

    (assetsRes.data || []).forEach((a: { service_contract_id: string }) => {
      assetCounts[a.service_contract_id] = (assetCounts[a.service_contract_id] || 0) + 1;
    });

    (locationsRes.data || []).forEach((l: { service_contract_id: string }) => {
      locationCounts[l.service_contract_id] = (locationCounts[l.service_contract_id] || 0) + 1;
    });

    const enrichedContracts = (contractsData || []).map(c => ({
      ...c,
      assets_count: assetCounts[c.id] || 0,
      locations_count: locationCounts[c.id] || 0,
    }));

    setContracts(enrichedContracts);
    setLoading(false);
  };

  // Calculate stats
  const stats = [
    { 
      title: "Total Contracts", 
      value: contracts.length.toString(), 
      icon: FileText, 
      iconColor: "bg-primary/10 text-primary" 
    },
    { 
      title: "Active", 
      value: contracts.filter(c => c.status === "active").length.toString(), 
      icon: CheckCircle, 
      iconColor: "bg-success/10 text-success" 
    },
    { 
      title: "Expiring Soon", 
      value: contracts.filter(c => {
        const days = differenceInDays(new Date(c.end_date), new Date());
        return days > 0 && days <= 30;
      }).length.toString(), 
      icon: Clock, 
      iconColor: "bg-warning/10 text-warning" 
    },
    { 
      title: "Expired", 
      value: contracts.filter(c => differenceInDays(new Date(c.end_date), new Date()) <= 0).length.toString(), 
      icon: AlertTriangle, 
      iconColor: "bg-destructive/10 text-destructive" 
    },
  ];

  // Filter contracts
  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = 
      contract.contract_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contract.service_provider?.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
    const matchesType = typeFilter === "all" || contract.contract_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

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
          <p className="text-muted-foreground">Manage AMC, warranty, and service agreements</p>
        </div>
        {canCreate && (
          <Button className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New Contract
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contracts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expiring">Expiring</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="amc">AMC</SelectItem>
            <SelectItem value="warranty">Warranty</SelectItem>
            <SelectItem value="sla">SLA</SelectItem>
            <SelectItem value="hybrid">Hybrid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contracts Grid */}
      {filteredContracts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No contracts found</p>
          <p className="text-sm">Create a new contract to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredContracts.map((contract) => (
            <ContractSummaryCard
              key={contract.id}
              contract={contract}
              onClick={() => {
                // TODO: Open contract details
                toast({ title: "Coming soon", description: "Contract details view will be available soon" });
              }}
            />
          ))}
        </div>
      )}

      <ContractFormDialog
        open={open}
        onOpenChange={setOpen}
        onSuccess={fetchContracts}
      />
    </div>
  );
}
