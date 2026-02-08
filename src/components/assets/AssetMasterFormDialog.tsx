import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchableSelect } from "@/components/ui/searchable-select";

import { HierarchicalCategorySelector } from "./HierarchicalCategorySelector";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Vendor = {
  id: string;
  name: string;
};

const assetMasterSchema = z.object({
  // Basic Information
  name: z.string().trim().min(1, "Asset name is required").max(100, "Name must be less than 100 characters"),
  category_id: z.string().min(1, "Category is required"),
  brand: z.string().max(100, "Brand must be less than 100 characters").optional(),
  model: z.string().max(100, "Model must be less than 100 characters").optional(),
  manufacturer: z.string().max(150, "Manufacturer must be less than 150 characters").optional(),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  
  // Material & Finish (Furniture/Fixtures)
  material: z.string().max(100, "Material must be less than 100 characters").optional(),
  finish_color: z.string().max(100, "Finish/Color must be less than 100 characters").optional(),
  load_capacity: z.string().max(100, "Load capacity must be less than 100 characters").optional(),
  
  // Identifiers
  sku: z.string().max(50, "SKU must be less than 50 characters").optional(),
  upc_barcode: z.string().max(50, "Barcode must be less than 50 characters").optional(),
  hsn_code: z.string().max(20, "HSN code must be less than 20 characters").optional(),
  
  // Classification
  criticality: z.enum(["high", "medium", "low"]),
  investment_size: z.enum(["high", "medium", "low"]),
  
  // Pricing & Defaults
  standard_price: z.coerce.number().min(0, "Price must be 0 or more").optional(),
  currency: z.string().default("INR"),
  unit_of_measure: z.string().max(30, "Unit must be less than 30 characters").optional(),
  default_vendor_id: z.string().uuid().optional().or(z.literal("")),
  default_oem_id: z.string().uuid().optional().or(z.literal("")),
  default_asset_status: z.string().optional(),
  default_service_engagement: z.string().optional(),
  default_purchase_date: z.string().optional(),
  
  // Physical Specifications
  weight_kg: z.coerce.number().min(0, "Weight must be 0 or more").optional().nullable(),
  dimensions_cm: z.string().max(50, "Dimensions must be less than 50 characters").optional(),
  
  // Technical Specifications
  power_consumption_watts: z.coerce.number().min(0).optional().nullable(),
  voltage_requirement: z.string().max(30).optional(),
  temperature_range: z.string().max(50).optional(),
  capacity: z.string().max(100).optional(),
  refrigerant_type: z.string().max(50).optional(),
  energy_rating: z.string().max(20).optional(),
  
  // Lifecycle
  warranty_start_date: z.string().optional(),
  warranty_end_date: z.string().optional(),
  expected_lifespan_years: z.coerce.number().min(0).optional().nullable(),
  maintenance_frequency: z.string().max(30).optional(),
  lead_time_days: z.coerce.number().min(0).optional().nullable(),
  min_order_quantity: z.coerce.number().min(1).optional().nullable(),
  
  // Compliance & Safety
  certification_required: z.boolean().default(false),
  certifications: z.string().optional(),
  safety_requirements: z.string().max(500).optional(),
  installation_requirements: z.string().max(500).optional(),
  
  // Logistics
  spare_parts_available: z.boolean().default(true),
  is_returnable: z.boolean().default(false),
  disposal_instructions: z.string().max(500).optional(),
  environment_impact: z.string().max(50).optional(),
  
  // Documents
  image_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  datasheet_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  manual_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type AssetMasterFormData = z.infer<typeof assetMasterSchema>;

type AssetMaster = {
  id: string;
  name: string;
  category_id: string | null;
  criticality: string;
  investment_size: string;
  description: string | null;
  brand?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  material?: string | null;
  finish_color?: string | null;
  load_capacity?: string | null;
  sku?: string | null;
  upc_barcode?: string | null;
  hsn_code?: string | null;
  unit_of_measure?: string | null;
  standard_price?: number | null;
  currency?: string | null;
  default_vendor_id?: string | null;
  default_oem_id?: string | null;
  default_asset_status?: string | null;
  default_service_engagement?: string | null;
  default_purchase_date?: string | null;
  weight_kg?: number | null;
  dimensions_cm?: string | null;
  power_consumption_watts?: number | null;
  voltage_requirement?: string | null;
  temperature_range?: string | null;
  capacity?: string | null;
  refrigerant_type?: string | null;
  energy_rating?: string | null;
  warranty_start_date?: string | null;
  warranty_end_date?: string | null;
  expected_lifespan_years?: number | null;
  maintenance_frequency?: string | null;
  certification_required?: boolean | null;
  certifications?: string[] | null;
  safety_requirements?: string | null;
  installation_requirements?: string | null;
  spare_parts_available?: boolean | null;
  lead_time_days?: number | null;
  min_order_quantity?: number | null;
  is_returnable?: boolean | null;
  disposal_instructions?: string | null;
  environment_impact?: string | null;
  image_url?: string | null;
  datasheet_url?: string | null;
  manual_url?: string | null;
  categories?: { name: string; type: string } | null;
};

interface AssetMasterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAsset: AssetMaster | null;
  onSuccess: () => void;
}

const criticalityOptions = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const investmentOptions = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const maintenanceFrequencyOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "bi-weekly", label: "Bi-Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi-annual", label: "Semi-Annual" },
  { value: "annual", label: "Annual" },
];

const energyRatingOptions = [
  { value: "5-star", label: "5 Star" },
  { value: "4-star", label: "4 Star" },
  { value: "3-star", label: "3 Star" },
  { value: "2-star", label: "2 Star" },
  { value: "1-star", label: "1 Star" },
  { value: "not-rated", label: "Not Rated" },
];

const refrigerantOptions = [
  { value: "R134a", label: "R134a" },
  { value: "R290", label: "R290 (Propane)" },
  { value: "R404A", label: "R404A" },
  { value: "R410A", label: "R410A" },
  { value: "R407C", label: "R407C" },
  { value: "R600a", label: "R600a (Isobutane)" },
  { value: "R32", label: "R32" },
  { value: "CO2", label: "CO2 (R744)" },
  { value: "ammonia", label: "Ammonia (R717)" },
  { value: "other", label: "Other" },
];

const unitOfMeasureOptions = [
  { value: "unit", label: "Unit (Ea)" },
  { value: "piece", label: "Piece (Pc)" },
  { value: "set", label: "Set" },
  { value: "pair", label: "Pair" },
  { value: "dozen", label: "Dozen (Dz)" },
  { value: "pack", label: "Pack" },
  { value: "box", label: "Box" },
  { value: "carton", label: "Carton" },
  { value: "meter", label: "Meter (m)" },
  { value: "centimeter", label: "Centimeter (cm)" },
  { value: "millimeter", label: "Millimeter (mm)" },
  { value: "feet", label: "Feet (ft)" },
  { value: "inch", label: "Inch (in)" },
  { value: "kilogram", label: "Kilogram (kg)" },
  { value: "gram", label: "Gram (g)" },
  { value: "pound", label: "Pound (lb)" },
  { value: "ton", label: "Ton" },
  { value: "liter", label: "Liter (L)" },
  { value: "milliliter", label: "Milliliter (mL)" },
  { value: "cubic-meter", label: "Cubic Meter (m³)" },
  { value: "gallon", label: "Gallon" },
  { value: "square-meter", label: "Square Meter (m²)" },
  { value: "square-feet", label: "Square Feet (sq ft)" },
  { value: "watt", label: "Watt (W)" },
  { value: "kilowatt", label: "Kilowatt (kW)" },
  { value: "ampere", label: "Ampere (A)" },
  { value: "volt", label: "Volt (V)" },
  { value: "hour", label: "Hour (hr)" },
  { value: "day", label: "Day" },
  { value: "month", label: "Month" },
  { value: "roll", label: "Roll" },
  { value: "sheet", label: "Sheet" },
  { value: "bundle", label: "Bundle" },
  { value: "lot", label: "Lot" },
];

/** Renders all basic fields (brand, model, specs, etc.) — shown for all categories */
function BasicFieldsSection({ form, vendors }: { form: any; vendors: Vendor[] }) {
  return (
    <>
      {/* Brand / Model / Manufacturer */}
      <div className="grid grid-cols-3 gap-4">
        <FormField control={form.control} name="brand" render={({ field }: any) => (
          <FormItem><FormLabel>Brand</FormLabel><FormControl><Input placeholder="e.g. Blue Star" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="model" render={({ field }: any) => (
          <FormItem><FormLabel>Model</FormLabel><FormControl><Input placeholder="e.g. DF-500" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="manufacturer" render={({ field }: any) => (
          <FormItem><FormLabel>Manufacturer</FormLabel><FormControl><Input placeholder="e.g. Blue Star Ltd" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
      </div>

      {/* Classification: Criticality & Investment Size */}
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="criticality" render={({ field }: any) => (
          <FormItem>
            <FormLabel>Criticality *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select criticality" /></SelectTrigger></FormControl>
              <SelectContent>
                {criticalityOptions.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="investment_size" render={({ field }: any) => (
          <FormItem>
            <FormLabel>Investment Size *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select investment size" /></SelectTrigger></FormControl>
              <SelectContent>
                {investmentOptions.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      {/* Pricing: Asset Value, Currency, Unit of Measure */}
      <div className="grid grid-cols-3 gap-4">
        <FormField control={form.control} name="standard_price" render={({ field }: any) => (
          <FormItem><FormLabel>Asset Value</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="currency" render={({ field }: any) => (
          <FormItem>
            <FormLabel>Currency</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="INR">INR (₹)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="unit_of_measure" render={({ field }: any) => (
          <FormItem>
            <FormLabel>Unit of Measure</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || "unit"}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger></FormControl>
              <SelectContent>
                {unitOfMeasureOptions.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      {/* Vendor & OEM */}
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="default_vendor_id" render={({ field }: any) => (
          <FormItem>
            <FormLabel>Vendor</FormLabel>
            <SearchableSelect
              options={vendors.map((v) => ({ value: v.id, label: v.name }))}
              value={field.value || ""}
              onValueChange={field.onChange}
              placeholder="Select vendor..."
              searchPlaceholder="Search vendors..."
              emptyMessage="No vendors found"
            />
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="default_oem_id" render={({ field }: any) => (
          <FormItem>
            <FormLabel>OEM</FormLabel>
            <SearchableSelect
              options={vendors.map((v) => ({ value: v.id, label: v.name }))}
              value={field.value || ""}
              onValueChange={field.onChange}
              placeholder="Select OEM..."
              searchPlaceholder="Search OEMs..."
              emptyMessage="No OEMs found"
            />
            <FormMessage />
          </FormItem>
        )} />
      </div>

      {/* Asset Status & Service Engagement */}
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="default_asset_status" render={({ field }: any) => (
          <FormItem>
            <FormLabel>Asset Status</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || "working"}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="requisition_raised">Requisition Raised</SelectItem>
                <SelectItem value="purchase_order_placed">Purchase Order Placed</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
                <SelectItem value="working">Working</SelectItem>
                <SelectItem value="under_repair">Under Repair</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
                <SelectItem value="drop">Drop</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="default_service_engagement" render={({ field }: any) => (
          <FormItem>
            <FormLabel>Service Engagement</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || "under_warranty"}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select service type" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="under_warranty">Under Warranty</SelectItem>
                <SelectItem value="under_amc">Under AMC</SelectItem>
                <SelectItem value="need_based_support">Need Based Support</SelectItem>
                <SelectItem value="no_service_support">No Service Support</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      {/* Purchase Date */}
      <FormField control={form.control} name="default_purchase_date" render={({ field }: any) => (
        <FormItem><FormLabel>Purchase Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
      )} />

      {/* Description */}
      <FormField control={form.control} name="description" render={({ field }: any) => (
        <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Detailed description of the asset..." className="resize-none" rows={3} {...field} /></FormControl><FormMessage /></FormItem>
      )} />
    </>
  );
}

type DefinitionField = {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  options: string[] | null;
  is_required: boolean;
  placeholder: string | null;
  help_text: string | null;
  sort_order: number;
};

/** Dynamic custom fields tab driven by Asset Definition Master */
function CustomFieldsTab({ 
  categoryId, 
  assetMasterId,
  customValues,
  onCustomValuesChange,
}: { 
  categoryId: string;
  assetMasterId?: string;
  customValues: Record<string, string>;
  onCustomValuesChange: (values: Record<string, string>) => void;
}) {
  const [definitionFields, setDefinitionFields] = useState<DefinitionField[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (categoryId) {
      fetchDefinitionFields(categoryId);
    } else {
      setDefinitionFields([]);
    }
  }, [categoryId]);

  const fetchDefinitionFields = async (catId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("asset_definition_fields")
      .select("id, field_name, field_label, field_type, options, is_required, placeholder, help_text, sort_order")
      .eq("category_id", catId)
      .eq("status", "active")
      .order("sort_order");

    if (data) {
      setDefinitionFields(data as DefinitionField[]);
    }
    setLoading(false);
  };

  const updateValue = (fieldId: string, value: string) => {
    onCustomValuesChange({ ...customValues, [fieldId]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!categoryId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Select an Asset Category in the Basic tab first to see custom fields.
      </div>
    );
  }

  if (definitionFields.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No custom fields defined for this category. Configure them in the Asset Definition Master.
      </div>
    );
  }

  const FieldLabel = ({ field: f }: { field: DefinitionField }) => (
    <div className="flex items-center gap-1.5">
      <FormLabel>{f.field_label}{f.is_required && " *"}</FormLabel>
      {f.help_text && (
        <div className="relative group">
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2.5 py-1.5 text-xs rounded-md border bg-popover text-popover-foreground shadow-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 max-w-xs text-wrap">
            {f.help_text}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {definitionFields.map((field) => {
        const value = customValues[field.id] || "";

        if (field.field_type === "text") {
          return (
            <div key={field.id}>
              <FieldLabel field={field} />
              <Input
                className="mt-1.5"
                placeholder={field.placeholder || ""}
                value={value}
                onChange={(e) => updateValue(field.id, e.target.value)}
              />
            </div>
          );
        }

        if (field.field_type === "number") {
          return (
            <div key={field.id}>
              <FieldLabel field={field} />
              <Input
                className="mt-1.5"
                type="number"
                placeholder={field.placeholder || ""}
                value={value}
                onChange={(e) => updateValue(field.id, e.target.value)}
              />
            </div>
          );
        }

        if (field.field_type === "date") {
          return (
            <div key={field.id}>
              <FieldLabel field={field} />
              <Input
                className="mt-1.5"
                type="date"
                value={value}
                onChange={(e) => updateValue(field.id, e.target.value)}
              />
            </div>
          );
        }

        if (field.field_type === "select" && field.options) {
          return (
            <div key={field.id}>
              <FieldLabel field={field} />
              <Select value={value || "none"} onValueChange={(v) => updateValue(field.id, v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={field.placeholder || "Select..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not Selected</SelectItem>
                  {(field.options as string[]).map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        if (field.field_type === "boolean") {
          return (
            <div key={field.id} className="flex items-center space-x-2 rounded-md border p-4">
              <Checkbox
                checked={value === "true"}
                onCheckedChange={(checked) => updateValue(field.id, checked ? "true" : "false")}
              />
              <FormLabel>{field.field_label}{field.is_required && " *"}</FormLabel>
              {field.help_text && (
                <div className="relative group">
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2.5 py-1.5 text-xs rounded-md border bg-popover text-popover-foreground shadow-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 max-w-xs text-wrap">
                    {field.help_text}
                  </div>
                </div>
              )}
            </div>
          );
        }

        if (field.field_type === "textarea") {
          return (
            <div key={field.id}>
              <FieldLabel field={field} />
              <Textarea
                className="mt-1.5 resize-none"
                rows={3}
                placeholder={field.placeholder || ""}
                value={value}
                onChange={(e) => updateValue(field.id, e.target.value)}
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

export function AssetMasterFormDialog({
  open,
  onOpenChange,
  editingAsset,
  onSuccess,
}: AssetMasterFormDialogProps) {
  const { toast } = useToast();
  const [categoryRefreshKey, setCategoryRefreshKey] = useState(0);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchVendors = async () => {
      const { data } = await supabase
        .from("vendors")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (data) setVendors(data);
    };
    fetchVendors();
  }, []);

  const form = useForm<AssetMasterFormData>({
    resolver: zodResolver(assetMasterSchema),
    defaultValues: {
      name: "",
      category_id: "",
      brand: "",
      model: "",
      manufacturer: "",
      description: "",
      material: "",
      finish_color: "",
      load_capacity: "",
      sku: "",
      upc_barcode: "",
      hsn_code: "",
      criticality: "medium",
      investment_size: "medium",
      standard_price: 0,
      currency: "INR",
      unit_of_measure: "unit",
      default_vendor_id: "",
      default_oem_id: "",
      default_asset_status: "working",
      default_service_engagement: "under_warranty",
      default_purchase_date: "",
      weight_kg: null,
      dimensions_cm: "",
      power_consumption_watts: null,
      voltage_requirement: "",
      temperature_range: "",
      capacity: "",
      refrigerant_type: "",
      energy_rating: "",
      warranty_start_date: "",
      warranty_end_date: "",
      expected_lifespan_years: null,
      maintenance_frequency: "",
      certification_required: false,
      certifications: "",
      safety_requirements: "",
      installation_requirements: "",
      spare_parts_available: true,
      lead_time_days: null,
      min_order_quantity: 1,
      is_returnable: false,
      disposal_instructions: "",
      environment_impact: "",
      image_url: "",
      datasheet_url: "",
      manual_url: "",
    },
  });

  useEffect(() => {
    if (open) {
      setCategoryRefreshKey((k) => k + 1);
      if (editingAsset) {
        form.reset({
          name: editingAsset.name,
          category_id: editingAsset.category_id || "",
          brand: editingAsset.brand || "",
          model: editingAsset.model || "",
          manufacturer: editingAsset.manufacturer || "",
          description: editingAsset.description || "",
          material: (editingAsset as any).material || "",
          finish_color: (editingAsset as any).finish_color || "",
          load_capacity: (editingAsset as any).load_capacity || "",
          sku: editingAsset.sku || "",
          upc_barcode: editingAsset.upc_barcode || "",
          hsn_code: editingAsset.hsn_code || "",
          criticality: (editingAsset.criticality as "high" | "medium" | "low") || "medium",
          investment_size: (editingAsset.investment_size as "high" | "medium" | "low") || "medium",
          standard_price: editingAsset.standard_price || 0,
          currency: editingAsset.currency || "INR",
          unit_of_measure: editingAsset.unit_of_measure || "unit",
          default_vendor_id: editingAsset.default_vendor_id || "",
          default_oem_id: editingAsset.default_oem_id || "",
          default_asset_status: editingAsset.default_asset_status || "working",
          default_service_engagement: editingAsset.default_service_engagement || "under_warranty",
          default_purchase_date: editingAsset.default_purchase_date || "",
          weight_kg: editingAsset.weight_kg || null,
          dimensions_cm: editingAsset.dimensions_cm || "",
          power_consumption_watts: editingAsset.power_consumption_watts || null,
          voltage_requirement: editingAsset.voltage_requirement || "",
          temperature_range: editingAsset.temperature_range || "",
          capacity: editingAsset.capacity || "",
          refrigerant_type: editingAsset.refrigerant_type || "",
          energy_rating: editingAsset.energy_rating || "",
          warranty_start_date: editingAsset.warranty_start_date || "",
          warranty_end_date: editingAsset.warranty_end_date || "",
          expected_lifespan_years: editingAsset.expected_lifespan_years || null,
          maintenance_frequency: editingAsset.maintenance_frequency || "",
          certification_required: editingAsset.certification_required || false,
          certifications: editingAsset.certifications?.join(", ") || "",
          safety_requirements: editingAsset.safety_requirements || "",
          installation_requirements: editingAsset.installation_requirements || "",
          spare_parts_available: editingAsset.spare_parts_available ?? true,
          lead_time_days: editingAsset.lead_time_days || null,
          min_order_quantity: editingAsset.min_order_quantity || 1,
          is_returnable: editingAsset.is_returnable || false,
          disposal_instructions: editingAsset.disposal_instructions || "",
          environment_impact: editingAsset.environment_impact || "",
          image_url: editingAsset.image_url || "",
          datasheet_url: editingAsset.datasheet_url || "",
          manual_url: editingAsset.manual_url || "",
        });
        // Load custom values for editing
        loadCustomValues(editingAsset.id);
      } else {
        form.reset();
        setCustomValues({});
      }
    }
  }, [open, editingAsset, form]);

  const loadCustomValues = async (masterId: string) => {
    const { data } = await supabase
      .from("asset_master_custom_values")
      .select("field_id, value")
      .eq("asset_master_id", masterId);
    
    if (data) {
      const vals: Record<string, string> = {};
      data.forEach((row) => {
        vals[row.field_id] = row.value || "";
      });
      setCustomValues(vals);
    }
  };

  const saveCustomValues = async (masterId: string) => {
    const entries = Object.entries(customValues).filter(([, v]) => v !== "");
    if (entries.length === 0) return;

    // Delete existing custom values and re-insert
    await supabase
      .from("asset_master_custom_values")
      .delete()
      .eq("asset_master_id", masterId);

    const inserts = entries.map(([fieldId, value]) => ({
      asset_master_id: masterId,
      field_id: fieldId,
      value,
    }));

    await supabase.from("asset_master_custom_values").insert(inserts);
  };

  const onSubmit = async (data: AssetMasterFormData) => {
    const certArray = data.certifications
      ? data.certifications.split(",").map((c) => c.trim()).filter(Boolean)
      : null;

    const payload: Record<string, any> = {
      name: data.name,
      category_id: data.category_id,
      brand: data.brand || null,
      model: data.model || null,
      manufacturer: data.manufacturer || null,
      description: data.description || null,
      material: data.material || null,
      finish_color: data.finish_color || null,
      load_capacity: data.load_capacity || null,
      sku: data.sku || null,
      upc_barcode: data.upc_barcode || null,
      hsn_code: data.hsn_code || null,
      criticality: data.criticality,
      investment_size: data.investment_size,
      standard_price: data.standard_price || 0,
      currency: data.currency,
      unit_of_measure: data.unit_of_measure || "unit",
      default_vendor_id: data.default_vendor_id || null,
      default_oem_id: data.default_oem_id || null,
      default_asset_status: data.default_asset_status || "working",
      default_service_engagement: data.default_service_engagement || "under_warranty",
      default_purchase_date: data.default_purchase_date || null,
      weight_kg: data.weight_kg || null,
      dimensions_cm: data.dimensions_cm || null,
      power_consumption_watts: data.power_consumption_watts || null,
      voltage_requirement: data.voltage_requirement || null,
      temperature_range: data.temperature_range || null,
      capacity: data.capacity || null,
      refrigerant_type: data.refrigerant_type || null,
      energy_rating: data.energy_rating || null,
      warranty_start_date: data.warranty_start_date || null,
      warranty_end_date: data.warranty_end_date || null,
      expected_lifespan_years: data.expected_lifespan_years || null,
      maintenance_frequency: data.maintenance_frequency || null,
      certification_required: data.certification_required,
      certifications: certArray,
      safety_requirements: data.safety_requirements || null,
      installation_requirements: data.installation_requirements || null,
      spare_parts_available: data.spare_parts_available,
      lead_time_days: data.lead_time_days || null,
      min_order_quantity: data.min_order_quantity || 1,
      is_returnable: data.is_returnable,
      disposal_instructions: data.disposal_instructions || null,
      environment_impact: data.environment_impact || null,
      image_url: data.image_url || null,
      datasheet_url: data.datasheet_url || null,
      manual_url: data.manual_url || null,
    };

    if (editingAsset) {
      const { error } = await supabase
        .from("asset_masters")
        .update(payload as any)
        .eq("id", editingAsset.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update asset master", variant: "destructive" });
      } else {
        await saveCustomValues(editingAsset.id);
        toast({ title: "Success", description: "Asset master updated" });
        onOpenChange(false);
        onSuccess();
      }
    } else {
      const { data: insertedData, error } = await supabase.from("asset_masters").insert(payload as any).select("id").single();

      if (error) {
        toast({ title: "Error", description: "Failed to add asset master", variant: "destructive" });
      } else {
        if (insertedData) {
          await saveCustomValues(insertedData.id);
        }
        toast({ title: "Success", description: "Asset master added" });
        onOpenChange(false);
        onSuccess();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>
            {editingAsset ? "Edit Asset Master" : "Add Asset Master"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form 
            onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.log("Form validation errors:", errors);
              const firstError = Object.values(errors)[0];
              if (firstError?.message) {
                toast({ 
                  title: "Validation Error", 
                  description: String(firstError.message), 
                  variant: "destructive" 
                });
              }
            })} 
            className="flex flex-col flex-1 overflow-hidden"
          >
            <Tabs defaultValue="basic" className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="asset-details">Asset Details</TabsTrigger>
                  <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
                  <TabsTrigger value="compliance">Compliance</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                <TabsContent value="basic" className="mt-0 space-y-4 data-[state=active]:block">
                  {/* Asset Name — always visible */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Deep Freezer 500L" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Asset Category — replaces old category + asset type */}
                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <HierarchicalCategorySelector
                          value={field.value || null}
                          onChange={(categoryId) => {
                            field.onChange(categoryId || "");
                            if (!editingAsset) setCustomValues({});
                          }}
                          initialCategoryType={editingAsset?.categories?.type}
                          refreshKey={categoryRefreshKey}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* All remaining Basic fields */}
                  <BasicFieldsSection form={form} vendors={vendors} />
                </TabsContent>

                <TabsContent value="asset-details" className="mt-0 space-y-4">
                  <CustomFieldsTab
                    categoryId={form.watch("category_id")}
                    assetMasterId={editingAsset?.id}
                    customValues={customValues}
                    onCustomValuesChange={setCustomValues}
                  />
                </TabsContent>

                <TabsContent value="lifecycle" className="mt-0 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="warranty_start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Warranty Start Date</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="warranty_end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Warranty End Date</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="expected_lifespan_years"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expected Lifespan (Years)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="e.g. 10"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="maintenance_frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maintenance Frequency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "none"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Not Specified</SelectItem>
                            {maintenanceFrequencyOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="lead_time_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lead Time (Days)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="e.g. 15"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormDescription>
                            Days required for procurement
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="min_order_quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Min Order Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="e.g. 1"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="compliance" className="mt-0 space-y-4">
                  <FormField
                    control={form.control}
                    name="certification_required"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Certification Required</FormLabel>
                          <FormDescription>
                            Does this asset require certifications to operate?
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="certifications"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Certifications</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Comma-separated e.g. ISO 9001, BIS"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Enter certifications separated by commas
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="safety_requirements"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Safety Requirements</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Safety precautions and requirements..."
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="installation_requirements"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Installation Requirements</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Installation guidelines and prerequisites..."
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="spare_parts_available"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Spare Parts Available</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="is_returnable"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Returnable</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="disposal_instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Disposal Instructions</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="How to properly dispose of this asset..."
                            className="resize-none"
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="environment_impact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Environmental Impact</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "none"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select impact level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Not Specified</SelectItem>
                            <SelectItem value="minimal">Minimal</SelectItem>
                            <SelectItem value="moderate">Moderate</SelectItem>
                            <SelectItem value="significant">Significant</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="documents" className="mt-0 space-y-4">
                  <FormField
                    control={form.control}
                    name="image_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Image URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="datasheet_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Datasheet URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="manual_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manual URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </div>
            </Tabs>

            <div className="flex justify-end gap-2 p-6 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingAsset ? "Update Asset Master" : "Add Asset Master"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
