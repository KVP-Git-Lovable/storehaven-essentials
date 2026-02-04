import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Upload, FileText, Trash2, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VendorLinkSection } from "./VendorLinkSection";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const PM_TASK_TYPES = [
  { value: "preventive-maintenance", label: "Preventive Maintenance" },
  { value: "routine-inspection", label: "Routine Inspection" },
  { value: "deep-cleaning", label: "Deep Cleaning" },
  { value: "calibration", label: "Calibration" },
];

const PM_FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "biannual", label: "Bi-Annual" },
  { value: "annual", label: "Annual" },
];

const contractSchema = z.object({
  // Parties
  service_provider_id: z.string().min(1, "Service provider is required"),
  
  // Dates
  effective_date: z.string().min(1, "Effective date is required"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  auto_renewal: z.boolean().default(false),
  renewal_notice_days: z.coerce.number().optional(),
  
  // Scope
  contract_type: z.string().min(1, "Contract type is required"),
  service_types: z.array(z.string()).default([]),
  
  // Coverage
  labour_included: z.boolean().default(true),
  labour_rate_per_hour: z.coerce.number().optional(),
  labour_hours_included: z.coerce.number().optional(),
  travel_included: z.boolean().default(true),
  travel_radius_km: z.coerce.number().optional(),
  travel_rate_per_km: z.coerce.number().optional(),
  spares_included: z.boolean().default(false),
  spares_coverage_percent: z.coerce.number().optional(),
  spares_max_value: z.coerce.number().optional(),
  spares_excluded_items: z.string().optional(),
  consumables_included: z.boolean().default(false),
  consumables_limit: z.coerce.number().optional(),
  
  // Penalty Clause
  penalty_applicable: z.boolean().default(false),
  penalty_type: z.string().optional(),
  penalty_rate_percent: z.coerce.number().optional(),
  penalty_max_percent: z.coerce.number().optional(),
  penalty_grace_period_days: z.coerce.number().optional(),
  penalty_calculation_basis: z.string().optional(),
  penalty_notes: z.string().optional(),
  
  // Exclusions
  exclusions: z.string().optional(),
  
  // SLA
  support_hours: z.string().default("business"),
  support_hours_custom: z.string().optional(),
  p1_response_mins: z.coerce.number().optional(),
  p1_resolution_hrs: z.coerce.number().optional(),
  p2_response_mins: z.coerce.number().optional(),
  p2_resolution_hrs: z.coerce.number().optional(),
  p3_response_mins: z.coerce.number().optional(),
  p3_resolution_hrs: z.coerce.number().optional(),
  p4_response_mins: z.coerce.number().optional(),
  p4_resolution_hrs: z.coerce.number().optional(),
  sla_penalties: z.boolean().default(false),
  sla_penalty_details: z.string().optional(),
  
  // PM - now uses external state for pm_schedules
  pm_frequency: z.string().optional(), // Keep for backwards compatibility
  pm_task_type: z.string().default("preventive-maintenance"),
  auto_create_pm: z.boolean().default(true),
  
  // Uptime
  target_uptime_percent: z.coerce.number().optional(),
  
  // Commercial
  pricing_model: z.string().default("fixed"),
  contract_value: z.coerce.number().min(0, "Value is required"),
  visit_charge: z.coerce.number().optional(),
  after_hours_multiplier: z.coerce.number().optional(),
  invoice_frequency: z.string().default("monthly"),
  payment_terms_days: z.coerce.number().optional(),
  annual_escalation_percent: z.coerce.number().optional(),
  
  // Escalation
  escalation_l1_name: z.string().optional(),
  escalation_l1_phone: z.string().optional(),
  escalation_l1_email: z.string().optional(),
  escalation_l2_name: z.string().optional(),
  escalation_l2_phone: z.string().optional(),
  escalation_l2_email: z.string().optional(),
  escalation_l3_name: z.string().optional(),
  escalation_l3_phone: z.string().optional(),
  escalation_l3_email: z.string().optional(),
  
  // Meta
  notes: z.string().optional(),
});

type ContractFormData = z.infer<typeof contractSchema>;

type Vendor = { id: string; name: string };
type Asset = { 
  id: string; 
  name: string; 
  asset_number: string | null;
  store?: { name: string } | null;
  condition: string;
  asset_status: string;
};
type Store = { id: string; name: string };

interface ContractFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  contractId?: string;
}

const SERVICE_TYPES = [
  { value: "pm", label: "Preventive Maintenance" },
  { value: "breakdown", label: "Breakdown / Corrective" },
  { value: "remote", label: "Remote Support" },
  { value: "onsite", label: "On-site Support" },
  { value: "installation", label: "Installation" },
  { value: "decommissioning", label: "Decommissioning" },
];

// PM Schedule item type
interface PMScheduleItem {
  id: string;
  frequency: string;
  taskType: string;
}

export function ContractFormDialog({ open, onOpenChange, onSuccess, contractId }: ContractFormDialogProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [pmSchedules, setPmSchedules] = useState<PMScheduleItem[]>([]);
  const [escalationLevels, setEscalationLevels] = useState<number[]>([1]); // Start with level 1
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    parties: true,
    scope: true,
    coverage: false,
    penalty: false,
    sla: false,
    pm: false,
    commercial: true,
    escalation: false,
  });
  const { toast } = useToast();

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      contract_type: "amc",
      service_types: [],
      labour_included: true,
      travel_included: true,
      spares_included: false,
      consumables_included: false,
      penalty_applicable: false,
      support_hours: "business",
      sla_penalties: false,
      pricing_model: "fixed",
      contract_value: 0,
      invoice_frequency: "monthly",
      auto_renewal: false,
      pm_task_type: "preventive-maintenance",
      auto_create_pm: true,
    },
  });

  const isEditMode = !!contractId;

  // Helper functions for PM schedules
  const addPmSchedule = () => {
    setPmSchedules(prev => [...prev, { 
      id: crypto.randomUUID(), 
      frequency: "monthly", 
      taskType: "preventive-maintenance" 
    }]);
  };

  const removePmSchedule = (id: string) => {
    setPmSchedules(prev => prev.filter(s => s.id !== id));
  };

  const updatePmSchedule = (id: string, field: keyof PMScheduleItem, value: string) => {
    setPmSchedules(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // Helper functions for escalation levels
  const addEscalationLevel = () => {
    const nextLevel = Math.max(...escalationLevels) + 1;
    if (nextLevel <= 3) {
      setEscalationLevels(prev => [...prev, nextLevel]);
    }
  };

  const removeEscalationLevel = (level: number) => {
    if (escalationLevels.length > 1) {
      setEscalationLevels(prev => prev.filter(l => l !== level));
    }
  };

  useEffect(() => {
    if (open) {
      fetchReferenceData();
      if (contractId) {
        fetchContractData(contractId);
      } else {
        // Reset form for create mode
        form.reset();
        setSelectedAssets([]);
        setSelectedLocations([]);
        setAttachments([]);
        setPmSchedules([]);
        setEscalationLevels([1]);
      }
    }
  }, [open, contractId]);

  const fetchReferenceData = async () => {
    const [vendorsRes, assetsRes, storesRes] = await Promise.all([
      supabase.from("vendors").select("id, name").order("name"),
      supabase.from("assets").select("id, name, asset_number, condition, asset_status, store:store_id(name)").order("name"),
      supabase.from("stores").select("id, name").order("name"),
    ]);
    
    setVendors(vendorsRes.data || []);
    setAssets(assetsRes.data || []);
    setStores(storesRes.data || []);
  };

  const fetchContractData = async (id: string) => {
    const [contractRes, assetsRes, locationsRes] = await Promise.all([
      supabase.from("service_contracts").select("*").eq("id", id).single(),
      supabase.from("service_contract_assets").select("asset_id").eq("service_contract_id", id),
      supabase.from("service_contract_locations").select("store_id").eq("service_contract_id", id),
    ]);

    if (contractRes.data) {
      const c = contractRes.data;
      form.reset({
        service_provider_id: c.service_provider_id || "",
        effective_date: c.effective_date || "",
        start_date: c.start_date || "",
        end_date: c.end_date || "",
        auto_renewal: c.auto_renewal || false,
        renewal_notice_days: c.renewal_notice_days || undefined,
        contract_type: c.contract_type || "amc",
        service_types: (c.service_types as string[]) || [],
        labour_included: c.labour_included ?? true,
        labour_rate_per_hour: c.labour_rate_per_hour || undefined,
        labour_hours_included: c.labour_hours_included || undefined,
        travel_included: c.travel_included ?? true,
        travel_radius_km: c.travel_radius_km || undefined,
        travel_rate_per_km: c.travel_rate_per_km || undefined,
        spares_included: c.spares_included ?? false,
        spares_coverage_percent: c.spares_coverage_percent || undefined,
        spares_max_value: c.spares_max_value || undefined,
        spares_excluded_items: c.spares_excluded_items || "",
        consumables_included: c.consumables_included ?? false,
        consumables_limit: c.consumables_limit || undefined,
        penalty_applicable: c.penalty_applicable ?? false,
        penalty_type: c.penalty_type || "",
        penalty_rate_percent: c.penalty_rate_percent || undefined,
        penalty_max_percent: c.penalty_max_percent || undefined,
        penalty_grace_period_days: c.penalty_grace_period_days || undefined,
        penalty_calculation_basis: c.penalty_calculation_basis || "",
        penalty_notes: c.penalty_notes || "",
        exclusions: c.exclusions || "",
        support_hours: c.support_hours || "business",
        support_hours_custom: c.support_hours_custom || "",
        p1_response_mins: c.p1_response_mins || undefined,
        p1_resolution_hrs: c.p1_resolution_hrs || undefined,
        p2_response_mins: c.p2_response_mins || undefined,
        p2_resolution_hrs: c.p2_resolution_hrs || undefined,
        p3_response_mins: c.p3_response_mins || undefined,
        p3_resolution_hrs: c.p3_resolution_hrs || undefined,
        p4_response_mins: c.p4_response_mins || undefined,
        p4_resolution_hrs: c.p4_resolution_hrs || undefined,
        sla_penalties: c.sla_penalties ?? false,
        sla_penalty_details: c.sla_penalty_details || "",
        pm_frequency: c.pm_frequency || "",
        pm_task_type: c.pm_task_type || "preventive-maintenance",
        auto_create_pm: true,
        target_uptime_percent: c.target_uptime_percent || undefined,
        pricing_model: c.pricing_model || "fixed",
        contract_value: c.contract_value || 0,
        visit_charge: c.visit_charge || undefined,
        after_hours_multiplier: c.after_hours_multiplier || undefined,
        invoice_frequency: c.invoice_frequency || "monthly",
        payment_terms_days: c.payment_terms_days || undefined,
        annual_escalation_percent: c.annual_escalation_percent || undefined,
        escalation_l1_name: c.escalation_l1_name || "",
        escalation_l1_phone: c.escalation_l1_phone || "",
        escalation_l1_email: c.escalation_l1_email || "",
        escalation_l2_name: c.escalation_l2_name || "",
        escalation_l2_phone: c.escalation_l2_phone || "",
        escalation_l2_email: c.escalation_l2_email || "",
        escalation_l3_name: c.escalation_l3_name || "",
        escalation_l3_phone: c.escalation_l3_phone || "",
        escalation_l3_email: c.escalation_l3_email || "",
        notes: c.notes || "",
      });
    }

    if (assetsRes.data) {
      setSelectedAssets(assetsRes.data.map((a) => a.asset_id));
    }
    if (locationsRes.data) {
      setSelectedLocations(locationsRes.data.map((l) => l.store_id));
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const generateContractNumber = () => {
    const prefix = "SC";
    const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${date}-${random}`;
  };

  const onSubmit = async (data: ContractFormData) => {
    setUploading(true);

    try {
      const contractPayload = {
        service_provider_id: data.service_provider_id || null,
        effective_date: data.effective_date,
        start_date: data.start_date,
        end_date: data.end_date,
        auto_renewal: data.auto_renewal,
        renewal_notice_days: data.renewal_notice_days || null,
        contract_type: data.contract_type,
        service_types: data.service_types,
        labour_included: data.labour_included,
        labour_rate_per_hour: data.labour_rate_per_hour || null,
        labour_hours_included: data.labour_hours_included || null,
        travel_included: data.travel_included,
        travel_radius_km: data.travel_radius_km || null,
        travel_rate_per_km: data.travel_rate_per_km || null,
        spares_included: data.spares_included,
        spares_coverage_percent: data.spares_coverage_percent || null,
        spares_max_value: data.spares_max_value || null,
        spares_excluded_items: data.spares_excluded_items || null,
        consumables_included: data.consumables_included,
        consumables_limit: data.consumables_limit || null,
        penalty_applicable: data.penalty_applicable,
        penalty_type: data.penalty_type || null,
        penalty_rate_percent: data.penalty_rate_percent || null,
        penalty_max_percent: data.penalty_max_percent || null,
        penalty_grace_period_days: data.penalty_grace_period_days || null,
        penalty_calculation_basis: data.penalty_calculation_basis || null,
        penalty_notes: data.penalty_notes || null,
        exclusions: data.exclusions || null,
        support_hours: data.support_hours,
        support_hours_custom: data.support_hours_custom || null,
        p1_response_mins: data.p1_response_mins || null,
        p1_resolution_hrs: data.p1_resolution_hrs || null,
        p2_response_mins: data.p2_response_mins || null,
        p2_resolution_hrs: data.p2_resolution_hrs || null,
        p3_response_mins: data.p3_response_mins || null,
        p3_resolution_hrs: data.p3_resolution_hrs || null,
        p4_response_mins: data.p4_response_mins || null,
        p4_resolution_hrs: data.p4_resolution_hrs || null,
        sla_penalties: data.sla_penalties,
        sla_penalty_details: data.sla_penalty_details || null,
        pm_frequency: pmSchedules.length > 0 ? pmSchedules[0].frequency : (data.pm_frequency || null),
        pm_task_type: pmSchedules.length > 0 ? pmSchedules[0].taskType : (data.pm_task_type || "preventive-maintenance"),
        target_uptime_percent: data.target_uptime_percent || null,
        pricing_model: data.pricing_model,
        contract_value: data.contract_value,
        visit_charge: data.visit_charge || null,
        after_hours_multiplier: data.after_hours_multiplier || null,
        invoice_frequency: data.invoice_frequency,
        payment_terms_days: data.payment_terms_days || null,
        annual_escalation_percent: data.annual_escalation_percent || null,
        escalation_l1_name: data.escalation_l1_name || null,
        escalation_l1_phone: data.escalation_l1_phone || null,
        escalation_l1_email: data.escalation_l1_email || null,
        escalation_l2_name: data.escalation_l2_name || null,
        escalation_l2_phone: data.escalation_l2_phone || null,
        escalation_l2_email: data.escalation_l2_email || null,
        escalation_l3_name: data.escalation_l3_name || null,
        escalation_l3_phone: data.escalation_l3_phone || null,
        escalation_l3_email: data.escalation_l3_email || null,
        notes: data.notes || null,
      };

      let savedContractId: string;

      if (isEditMode && contractId) {
        // Update existing contract
        const { error } = await supabase
          .from("service_contracts")
          .update(contractPayload)
          .eq("id", contractId);

        if (error) throw error;
        savedContractId = contractId;

        // Update linked assets - delete old and insert new
        await supabase.from("service_contract_assets").delete().eq("service_contract_id", contractId);
        await supabase.from("service_contract_locations").delete().eq("service_contract_id", contractId);
      } else {
        // Create new contract
        const contractNumber = generateContractNumber();
        const { data: newContract, error } = await supabase
          .from("service_contracts")
          .insert({
            ...contractPayload,
            contract_number: contractNumber,
            customer_name: "-",
            status: "draft",
          })
          .select()
          .single();

        if (error || !newContract) {
          throw error || new Error("Failed to create contract");
        }
        savedContractId = newContract.id;
      }

      // Link assets
      if (selectedAssets.length > 0) {
        const assetLinks = selectedAssets.map(assetId => ({
          service_contract_id: savedContractId,
          asset_id: assetId,
        }));
        await supabase.from("service_contract_assets").insert(assetLinks);
      }

      // Link locations
      if (selectedLocations.length > 0) {
        const locationLinks = selectedLocations.map(storeId => ({
          service_contract_id: savedContractId,
          store_id: storeId,
        }));
        await supabase.from("service_contract_locations").insert(locationLinks);
      }

      // Upload attachments (only for new contracts or new files)
      for (const file of attachments) {
        const filePath = `${savedContractId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("service-contracts")
          .upload(filePath, file);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("service-contracts")
            .getPublicUrl(filePath);

          await supabase.from("service_contract_attachments").insert({
            service_contract_id: savedContractId,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type,
            file_size: file.size,
            attachment_type: "contract",
          });
        }
      }

      // Auto-create PM schedules if enabled (only for new contracts)
      if (!isEditMode && data.auto_create_pm && pmSchedules.length > 0 && selectedAssets.length > 0) {
        const vendorName = vendors.find(v => v.id === data.service_provider_id)?.name || "Vendor";
        const startDate = new Date(data.start_date);
        const endDate = new Date(data.end_date);
        
        // Create PM tasks for each schedule and each selected asset
        for (const schedule of pmSchedules) {
          const taskTypeLabel = PM_TASK_TYPES.find(t => t.value === schedule.taskType)?.label || "Preventive Maintenance";
          
          // Calculate all due dates from start to end based on frequency
          let currentDue = new Date(startDate);
          while (currentDue <= endDate) {
            for (const assetId of selectedAssets) {
              const asset = assets.find(a => a.id === assetId);
              if (asset) {
                await supabase.from("maintenance_tasks").insert({
                  asset: asset.name,
                  asset_id: assetId,
                  task_type: taskTypeLabel,
                  frequency: schedule.frequency,
                  last_done: "-",
                  next_due: currentDue.toISOString().split("T")[0],
                  assigned_to: vendorName,
                  status: "scheduled",
                  service_contract_id: savedContractId,
                });
              }
            }
            
            // Move to next due date based on frequency
            switch (schedule.frequency) {
              case "weekly":
                currentDue.setDate(currentDue.getDate() + 7);
                break;
              case "monthly":
                currentDue.setMonth(currentDue.getMonth() + 1);
                break;
              case "quarterly":
                currentDue.setMonth(currentDue.getMonth() + 3);
                break;
              case "biannual":
                currentDue.setMonth(currentDue.getMonth() + 6);
                break;
              case "annual":
                currentDue.setFullYear(currentDue.getFullYear() + 1);
                break;
              default:
                currentDue.setMonth(currentDue.getMonth() + 1);
            }
          }
        }
      }

      toast({
        title: isEditMode ? "Contract updated" : "Contract created",
        description: isEditMode ? "Contract has been updated successfully." : "Contract has been created successfully.",
      });

      form.reset();
      setSelectedAssets([]);
      setSelectedLocations([]);
      setAttachments([]);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to create contract",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const SectionHeader = ({ id, title, icon: Icon }: { id: string; title: string; icon?: React.ElementType }) => (
    <CollapsibleTrigger 
      className="flex items-center justify-between w-full py-2 px-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
      onClick={() => toggleSection(id)}
    >
      <div className="flex items-center gap-2 font-medium">
        {Icon && <Icon className="h-4 w-4" />}
        {title}
      </div>
      {expandedSections[id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </CollapsibleTrigger>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>{isEditMode ? "Edit Service Contract" : "New Service Contract"}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              {/* Section 1: Parties and Dates */}
              <Collapsible open={expandedSections.parties}>
                <SectionHeader id="parties" title="1. Parties & Contract Period" />
                <CollapsibleContent className="pt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="service_provider_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Provider *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {vendors.map(v => (
                              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="effective_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Effective Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex items-center gap-6">
                    <FormField
                      control={form.control}
                      name="auto_renewal"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0">Auto Renewal</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="renewal_notice_days"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormLabel className="whitespace-nowrap">Notice Period</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="30" className="w-20" {...field} />
                          </FormControl>
                          <span className="text-sm text-muted-foreground">days</span>
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Section 2: Contract Scope */}
              <Collapsible open={expandedSections.scope}>
                <SectionHeader id="scope" title="2. Contract Scope" />
                <CollapsibleContent className="pt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="contract_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="amc">AMC (Annual Maintenance Contract)</SelectItem>
                            <SelectItem value="warranty">Warranty</SelectItem>
                            <SelectItem value="on-call">On Call</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="service_types"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Types Included</FormLabel>
                        <div className="flex flex-wrap gap-2">
                          {SERVICE_TYPES.map(st => (
                            <Badge
                              key={st.value}
                              variant={field.value.includes(st.value) ? "default" : "outline"}
                              className="cursor-pointer"
                              onClick={() => {
                                const newValue = field.value.includes(st.value)
                                  ? field.value.filter(v => v !== st.value)
                                  : [...field.value, st.value];
                                field.onChange(newValue);
                              }}
                            >
                              {st.label}
                            </Badge>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Covered Assets */}
                  <div>
                    <FormLabel>Covered Assets</FormLabel>
                    <div className="mt-2 border rounded-md p-2">
                      {selectedAssets.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {selectedAssets.map(assetId => {
                            const asset = assets.find(a => a.id === assetId);
                            return (
                              <Badge key={assetId} variant="secondary" className="gap-1">
                                {asset?.name || assetId}
                                <button
                                  type="button"
                                  onClick={() => setSelectedAssets(prev => prev.filter(id => id !== assetId))}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      <div className="relative mb-2">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search assets..."
                          value={assetSearch}
                          onChange={(e) => setAssetSearch(e.target.value)}
                          className="pl-8 h-8"
                        />
                      </div>
                      <ScrollArea className="h-48">
                        <div className="space-y-1">
                          {assets
                            .filter(asset => {
                              const searchLower = assetSearch.toLowerCase();
                              return (
                                asset.name.toLowerCase().includes(searchLower) ||
                                (asset.asset_number?.toLowerCase().includes(searchLower)) ||
                                (asset.store?.name?.toLowerCase().includes(searchLower))
                              );
                            })
                            .map(asset => (
                            <div key={asset.id} className="flex items-center gap-2 py-1 hover:bg-muted/50 px-1 rounded">
                              <Checkbox
                                checked={selectedAssets.includes(asset.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedAssets(prev => [...prev, asset.id]);
                                  } else {
                                    setSelectedAssets(prev => prev.filter(id => id !== asset.id));
                                  }
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium">
                                  {asset.asset_number ? `${asset.asset_number} - ` : ""}{asset.name}
                                </span>
                                {asset.store?.name && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    @ {asset.store.name}
                                  </span>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {asset.asset_status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                  {/* Covered Locations */}
                  <div>
                    <FormLabel>Covered Locations</FormLabel>
                    <div className="mt-2 border rounded-md p-2">
                      {selectedLocations.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {selectedLocations.map(storeId => {
                            const store = stores.find(s => s.id === storeId);
                            return (
                              <Badge key={storeId} variant="secondary" className="gap-1">
                                {store?.name || storeId}
                                <button
                                  type="button"
                                  onClick={() => setSelectedLocations(prev => prev.filter(id => id !== storeId))}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      <div className="relative mb-2">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search locations..."
                          value={locationSearch}
                          onChange={(e) => setLocationSearch(e.target.value)}
                          className="pl-8 h-8"
                        />
                      </div>
                      <ScrollArea className="h-32">
                        <div className="space-y-1">
                          {stores
                            .filter(store => store.name.toLowerCase().includes(locationSearch.toLowerCase()))
                            .map(store => (
                            <div key={store.id} className="flex items-center gap-2 py-1 hover:bg-muted/50 px-1 rounded">
                              <Checkbox
                                checked={selectedLocations.includes(store.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedLocations(prev => [...prev, store.id]);
                                  } else {
                                    setSelectedLocations(prev => prev.filter(id => id !== store.id));
                                  }
                                }}
                              />
                              <span className="text-sm">{store.name}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Section 3: Coverage & Entitlements */}
              <Collapsible open={expandedSections.coverage}>
                <SectionHeader id="coverage" title="3. Coverage & Entitlements" />
                <CollapsibleContent className="pt-4 space-y-4">
                  {/* Labour Coverage */}
                  <div className="border rounded-md p-3 space-y-3">
                    <FormField
                      control={form.control}
                      name="labour_included"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0 font-medium">Labour Included</FormLabel>
                        </FormItem>
                      )}
                    />
                    {form.watch("labour_included") && (
                      <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-primary/20">
                        <FormField
                          control={form.control}
                          name="labour_rate_per_hour"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rate per Hour (₹)</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="0" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="labour_hours_included"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Hours Included (per year)</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="Unlimited" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  {/* Travel Coverage */}
                  <div className="border rounded-md p-3 space-y-3">
                    <FormField
                      control={form.control}
                      name="travel_included"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0 font-medium">Travel Included</FormLabel>
                        </FormItem>
                      )}
                    />
                    {form.watch("travel_included") && (
                      <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-primary/20">
                        <FormField
                          control={form.control}
                          name="travel_radius_km"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Coverage Radius (km)</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 50" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="travel_rate_per_km"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rate per KM (₹) - beyond radius</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="0" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  {/* Spares Coverage */}
                  <div className="border rounded-md p-3 space-y-3">
                    <FormField
                      control={form.control}
                      name="spares_included"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0 font-medium">Spares Included</FormLabel>
                        </FormItem>
                      )}
                    />
                    {form.watch("spares_included") && (
                      <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="spares_coverage_percent"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Coverage Percentage (%)</FormLabel>
                                <FormControl>
                                  <Input type="number" placeholder="100" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="spares_max_value"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Max Value per Year (₹)</FormLabel>
                                <FormControl>
                                  <Input type="number" placeholder="Unlimited" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="spares_excluded_items"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Excluded Spare Items</FormLabel>
                              <FormControl>
                                <Textarea placeholder="List any excluded spare parts..." {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  {/* Consumables Coverage */}
                  <div className="border rounded-md p-3 space-y-3">
                    <FormField
                      control={form.control}
                      name="consumables_included"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0 font-medium">Consumables Included</FormLabel>
                        </FormItem>
                      )}
                    />
                    {form.watch("consumables_included") && (
                      <div className="pl-6 border-l-2 border-primary/20">
                        <FormField
                          control={form.control}
                          name="consumables_limit"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Annual Consumables Limit (₹)</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="Unlimited" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="exclusions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>General Exclusions</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="List any exclusions (power issues, physical damage, etc.)" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>

              {/* Section 4: Penalty Clause */}
              <Collapsible open={expandedSections.penalty}>
                <SectionHeader id="penalty" title="4. Penalty Clause" />
                <CollapsibleContent className="pt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="penalty_applicable"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!mt-0 font-medium">Penalty Clause Applicable</FormLabel>
                      </FormItem>
                    )}
                  />
                  
                  {form.watch("penalty_applicable") && (
                    <div className="space-y-4 border-l-2 border-destructive/20 pl-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="penalty_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Penalty Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                                  <SelectItem value="percentage">Percentage of Contract Value</SelectItem>
                                  <SelectItem value="sla-based">SLA-Based Deduction</SelectItem>
                                  <SelectItem value="tiered">Tiered Penalty</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="penalty_calculation_basis"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Calculation Basis</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select basis" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="per-incident">Per Incident</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="quarterly">Quarterly</SelectItem>
                                  <SelectItem value="cumulative">Cumulative</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="penalty_rate_percent"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Penalty Rate (%)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.1" placeholder="e.g., 1.0" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="penalty_max_percent"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Max Penalty (%)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.1" placeholder="e.g., 10" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="penalty_grace_period_days"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Grace Period (days)</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 7" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="penalty_notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Penalty Terms & Notes</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Describe penalty conditions, escalation, exceptions..." 
                                {...field} 
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Section 5: SLA */}
              <Collapsible open={expandedSections.sla}>
                <SectionHeader id="sla" title="5. Service Level Agreement (SLA)" />
                <CollapsibleContent className="pt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="support_hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Support Hours</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select hours" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="business">Business Hours (9-6, Mon-Sat)</SelectItem>
                            <SelectItem value="24x7">24x7</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-sm font-medium">Priority</div>
                    <div className="text-sm font-medium">Response (mins)</div>
                    <div className="text-sm font-medium">Resolution (hrs)</div>
                    <div />
                    
                    <div className="text-sm">P1 - Critical</div>
                    <FormField control={form.control} name="p1_response_mins" render={({ field }) => (
                      <FormItem><FormControl><Input type="number" placeholder="15" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="p1_resolution_hrs" render={({ field }) => (
                      <FormItem><FormControl><Input type="number" placeholder="4" {...field} /></FormControl></FormItem>
                    )} />
                    <div />

                    <div className="text-sm">P2 - High</div>
                    <FormField control={form.control} name="p2_response_mins" render={({ field }) => (
                      <FormItem><FormControl><Input type="number" placeholder="30" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="p2_resolution_hrs" render={({ field }) => (
                      <FormItem><FormControl><Input type="number" placeholder="8" {...field} /></FormControl></FormItem>
                    )} />
                    <div />

                    <div className="text-sm">P3 - Medium</div>
                    <FormField control={form.control} name="p3_response_mins" render={({ field }) => (
                      <FormItem><FormControl><Input type="number" placeholder="60" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="p3_resolution_hrs" render={({ field }) => (
                      <FormItem><FormControl><Input type="number" placeholder="24" {...field} /></FormControl></FormItem>
                    )} />
                    <div />

                    <div className="text-sm">P4 - Low</div>
                    <FormField control={form.control} name="p4_response_mins" render={({ field }) => (
                      <FormItem><FormControl><Input type="number" placeholder="120" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="p4_resolution_hrs" render={({ field }) => (
                      <FormItem><FormControl><Input type="number" placeholder="48" {...field} /></FormControl></FormItem>
                    )} />
                    <div />
                  </div>

                  <div className="flex items-center gap-4">
                    <FormField
                      control={form.control}
                      name="sla_penalties"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0">SLA Penalties Apply</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="target_uptime_percent"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormLabel className="whitespace-nowrap">Target Uptime</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" placeholder="98.5" className="w-24" {...field} />
                          </FormControl>
                          <span className="text-sm text-muted-foreground">%</span>
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Section 6: PM Program */}
              <Collapsible open={expandedSections.pm}>
                <SectionHeader id="pm" title="6. Preventive Maintenance Program" />
                <CollapsibleContent className="pt-4 space-y-4">
                  {/* PM Schedules List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <FormLabel>Preventive Maintenance Tasks</FormLabel>
                      <Button type="button" variant="outline" size="sm" onClick={addPmSchedule}>
                        <Plus className="h-4 w-4 mr-1" /> Add PM Task
                      </Button>
                    </div>
                    
                    {pmSchedules.length === 0 ? (
                      <div className="text-center py-6 border rounded-lg bg-muted/30">
                        <p className="text-sm text-muted-foreground">No PM tasks added yet.</p>
                        <p className="text-xs text-muted-foreground mt-1">Click "Add PM Task" to schedule preventive maintenance.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pmSchedules.map((schedule, index) => (
                          <div key={schedule.id} className="grid grid-cols-[1fr_1fr_auto] gap-3 p-3 border rounded-lg bg-muted/30">
                            <div className="space-y-1">
                              <FormLabel className="text-xs">Frequency</FormLabel>
                              <Select 
                                value={schedule.frequency} 
                                onValueChange={(v) => updatePmSchedule(schedule.id, 'frequency', v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select frequency" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PM_FREQUENCIES.map(f => (
                                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <FormLabel className="text-xs">Task Type</FormLabel>
                              <Select 
                                value={schedule.taskType} 
                                onValueChange={(v) => updatePmSchedule(schedule.id, 'taskType', v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PM_TASK_TYPES.map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-end">
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon"
                                onClick={() => removePmSchedule(schedule.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="auto_create_pm"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 p-3 border rounded-lg bg-primary/5">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div>
                          <FormLabel className="!mt-0 font-medium">Auto-create PM Schedules</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Automatically schedule preventive maintenance tasks for covered assets from start to end date
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>

              {/* Section 7: Commercial Terms */}
              <Collapsible open={expandedSections.commercial}>
                <SectionHeader id="commercial" title="7. Commercial Terms" />
                <CollapsibleContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="pricing_model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pricing Model</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select model" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="fixed">Fixed Fee</SelectItem>
                              <SelectItem value="per-call">Per Call</SelectItem>
                              <SelectItem value="time-material">Time & Material</SelectItem>
                              <SelectItem value="hybrid">Hybrid</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contract_value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract Value (₹) *</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Total value" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="visit_charge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Visit Charge (₹)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Per visit" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="after_hours_multiplier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>After-Hours Multiplier</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" placeholder="1.5" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="annual_escalation_percent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Annual Escalation (%)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" placeholder="5" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="invoice_frequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Frequency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="annual">Annual</SelectItem>
                              <SelectItem value="on-completion">On Completion</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="payment_terms_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Terms (days)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="30" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Section 8: Escalation Matrix */}
              <Collapsible open={expandedSections.escalation}>
                <SectionHeader id="escalation" title="8. Escalation Matrix" />
                <CollapsibleContent className="pt-4 space-y-4">
                  {escalationLevels.map(level => (
                    <div key={level} className="p-3 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Level {level}</span>
                        {escalationLevels.length > 1 && (
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeEscalationLevel(level)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name={`escalation_l${level}_name` as keyof ContractFormData}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Contact name" {...field} value={field.value as string || ""} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`escalation_l${level}_phone` as keyof ContractFormData}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Phone</FormLabel>
                              <FormControl>
                                <Input placeholder="Phone" {...field} value={field.value as string || ""} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`escalation_l${level}_email` as keyof ContractFormData}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Email</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="Email" {...field} value={field.value as string || ""} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                  
                  {escalationLevels.length < 3 && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={addEscalationLevel}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Level {Math.max(...escalationLevels) + 1}
                    </Button>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Attachments */}
              <div className="space-y-2">
                <FormLabel>Attachments</FormLabel>
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <label className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Files
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleFileChange}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        />
                      </label>
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      PDF, DOC, XLS, Images (max 10MB each)
                    </span>
                  </div>
                  
                  {attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-muted/50 rounded p-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttachment(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any additional notes or terms" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Vendor Link Section - Only show in edit mode */}
              {isEditMode && contractId && (
                <VendorLinkSection contractId={contractId} />
              )}

              <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-background pb-2 border-t mt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? (isEditMode ? "Updating..." : "Creating...") : (isEditMode ? "Update Contract" : "Create Contract")}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
