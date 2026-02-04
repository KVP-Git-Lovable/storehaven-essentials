import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

import { HierarchicalCategorySelector } from "./HierarchicalCategorySelector";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const assetMasterSchema = z.object({
  // Basic Information
  name: z.string().trim().min(1, "Asset name is required").max(100, "Name must be less than 100 characters"),
  category_id: z.string().min(1, "Category is required"),
  brand: z.string().max(100, "Brand must be less than 100 characters").optional(),
  model: z.string().max(100, "Model must be less than 100 characters").optional(),
  manufacturer: z.string().max(150, "Manufacturer must be less than 150 characters").optional(),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  
  // Identifiers
  sku: z.string().max(50, "SKU must be less than 50 characters").optional(),
  upc_barcode: z.string().max(50, "Barcode must be less than 50 characters").optional(),
  hsn_code: z.string().max(20, "HSN code must be less than 20 characters").optional(),
  
  // Classification
  criticality: z.enum(["high", "medium", "low"]),
  investment_size: z.enum(["high", "medium", "low"]),
  
  // Pricing
  standard_price: z.coerce.number().min(0, "Price must be 0 or more").optional(),
  currency: z.string().default("INR"),
  unit_of_measure: z.string().max(30, "Unit must be less than 30 characters").optional(),
  
  // Physical Specifications
  weight_kg: z.coerce.number().min(0, "Weight must be 0 or more").optional().nullable(),
  dimensions_cm: z.string().max(50, "Dimensions must be less than 50 characters").optional(),
  
  // Technical Specifications (for refrigeration/ice cream equipment)
  power_consumption_watts: z.coerce.number().min(0).optional().nullable(),
  voltage_requirement: z.string().max(30).optional(),
  temperature_range: z.string().max(50).optional(),
  capacity: z.string().max(100).optional(),
  refrigerant_type: z.string().max(50).optional(),
  energy_rating: z.string().max(20).optional(),
  
  // Lifecycle
  warranty_months: z.coerce.number().min(0).optional().nullable(),
  expected_lifespan_years: z.coerce.number().min(0).optional().nullable(),
  maintenance_frequency: z.string().max(30).optional(),
  lead_time_days: z.coerce.number().min(0).optional().nullable(),
  min_order_quantity: z.coerce.number().min(1).optional().nullable(),
  
  // Compliance & Safety
  certification_required: z.boolean().default(false),
  certifications: z.string().optional(), // Will be converted to array
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
  sku?: string | null;
  upc_barcode?: string | null;
  hsn_code?: string | null;
  unit_of_measure?: string | null;
  standard_price?: number | null;
  currency?: string | null;
  weight_kg?: number | null;
  dimensions_cm?: string | null;
  power_consumption_watts?: number | null;
  voltage_requirement?: string | null;
  temperature_range?: string | null;
  capacity?: string | null;
  refrigerant_type?: string | null;
  energy_rating?: string | null;
  warranty_months?: number | null;
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
  // Count/Quantity Units
  { value: "unit", label: "Unit (Ea)" },
  { value: "piece", label: "Piece (Pc)" },
  { value: "set", label: "Set" },
  { value: "pair", label: "Pair" },
  { value: "dozen", label: "Dozen (Dz)" },
  { value: "pack", label: "Pack" },
  { value: "box", label: "Box" },
  { value: "carton", label: "Carton" },
  // Length Units
  { value: "meter", label: "Meter (m)" },
  { value: "centimeter", label: "Centimeter (cm)" },
  { value: "millimeter", label: "Millimeter (mm)" },
  { value: "feet", label: "Feet (ft)" },
  { value: "inch", label: "Inch (in)" },
  // Weight Units
  { value: "kilogram", label: "Kilogram (kg)" },
  { value: "gram", label: "Gram (g)" },
  { value: "pound", label: "Pound (lb)" },
  { value: "ton", label: "Ton" },
  // Volume/Capacity Units
  { value: "liter", label: "Liter (L)" },
  { value: "milliliter", label: "Milliliter (mL)" },
  { value: "cubic-meter", label: "Cubic Meter (m³)" },
  { value: "gallon", label: "Gallon" },
  // Area Units
  { value: "square-meter", label: "Square Meter (m²)" },
  { value: "square-feet", label: "Square Feet (sq ft)" },
  // Electrical Units
  { value: "watt", label: "Watt (W)" },
  { value: "kilowatt", label: "Kilowatt (kW)" },
  { value: "ampere", label: "Ampere (A)" },
  { value: "volt", label: "Volt (V)" },
  // Time Units
  { value: "hour", label: "Hour (hr)" },
  { value: "day", label: "Day" },
  { value: "month", label: "Month" },
  // Other
  { value: "roll", label: "Roll" },
  { value: "sheet", label: "Sheet" },
  { value: "bundle", label: "Bundle" },
  { value: "lot", label: "Lot" },
];

export function AssetMasterFormDialog({
  open,
  onOpenChange,
  editingAsset,
  onSuccess,
}: AssetMasterFormDialogProps) {
  const { toast } = useToast();
  const [categoryRefreshKey, setCategoryRefreshKey] = useState(0);

  const form = useForm<AssetMasterFormData>({
    resolver: zodResolver(assetMasterSchema),
    defaultValues: {
      name: "",
      category_id: "",
      brand: "",
      model: "",
      manufacturer: "",
      description: "",
      sku: "",
      upc_barcode: "",
      hsn_code: "",
      criticality: "medium",
      investment_size: "medium",
      standard_price: 0,
      currency: "INR",
      unit_of_measure: "unit",
      weight_kg: null,
      dimensions_cm: "",
      power_consumption_watts: null,
      voltage_requirement: "",
      temperature_range: "",
      capacity: "",
      refrigerant_type: "",
      energy_rating: "",
      warranty_months: 12,
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
          sku: editingAsset.sku || "",
          upc_barcode: editingAsset.upc_barcode || "",
          hsn_code: editingAsset.hsn_code || "",
          criticality: (editingAsset.criticality as "high" | "medium" | "low") || "medium",
          investment_size: (editingAsset.investment_size as "high" | "medium" | "low") || "medium",
          standard_price: editingAsset.standard_price || 0,
          currency: editingAsset.currency || "INR",
          unit_of_measure: editingAsset.unit_of_measure || "unit",
          weight_kg: editingAsset.weight_kg || null,
          dimensions_cm: editingAsset.dimensions_cm || "",
          power_consumption_watts: editingAsset.power_consumption_watts || null,
          voltage_requirement: editingAsset.voltage_requirement || "",
          temperature_range: editingAsset.temperature_range || "",
          capacity: editingAsset.capacity || "",
          refrigerant_type: editingAsset.refrigerant_type || "",
          energy_rating: editingAsset.energy_rating || "",
          warranty_months: editingAsset.warranty_months || 12,
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
      } else {
        form.reset();
      }
    }
  }, [open, editingAsset, form]);

  const onSubmit = async (data: AssetMasterFormData) => {
    const certArray = data.certifications
      ? data.certifications.split(",").map((c) => c.trim()).filter(Boolean)
      : null;

    const payload = {
      name: data.name,
      category_id: data.category_id,
      brand: data.brand || null,
      model: data.model || null,
      manufacturer: data.manufacturer || null,
      description: data.description || null,
      sku: data.sku || null,
      upc_barcode: data.upc_barcode || null,
      hsn_code: data.hsn_code || null,
      criticality: data.criticality,
      investment_size: data.investment_size,
      standard_price: data.standard_price || 0,
      currency: data.currency,
      unit_of_measure: data.unit_of_measure || "unit",
      weight_kg: data.weight_kg || null,
      dimensions_cm: data.dimensions_cm || null,
      power_consumption_watts: data.power_consumption_watts || null,
      voltage_requirement: data.voltage_requirement || null,
      temperature_range: data.temperature_range || null,
      capacity: data.capacity || null,
      refrigerant_type: data.refrigerant_type || null,
      energy_rating: data.energy_rating || null,
      warranty_months: data.warranty_months || null,
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
        .update(payload)
        .eq("id", editingAsset.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update asset master", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Asset master updated" });
        onOpenChange(false);
        onSuccess();
      }
    } else {
      const { error } = await supabase.from("asset_masters").insert(payload);

      if (error) {
        toast({ title: "Error", description: "Failed to add asset master", variant: "destructive" });
      } else {
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
              // Show first validation error to user
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
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
                  <TabsTrigger value="compliance">Compliance</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                <TabsContent value="basic" className="mt-0 space-y-4 data-[state=active]:block">
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

                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <HierarchicalCategorySelector
                          value={field.value || null}
                          onChange={(categoryId) => field.onChange(categoryId || "")}
                          initialCategoryType={editingAsset?.categories?.type}
                          refreshKey={categoryRefreshKey}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="brand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Blue Star" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. DF-500" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="manufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manufacturer</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Blue Star Ltd" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU</FormLabel>
                          <FormControl>
                            <Input placeholder="Internal SKU" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="upc_barcode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UPC/Barcode</FormLabel>
                          <FormControl>
                            <Input placeholder="Barcode number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hsn_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>HSN Code</FormLabel>
                          <FormControl>
                            <Input placeholder="For GST" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="criticality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Criticality *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select criticality" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {criticalityOptions.map((opt) => (
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
                    <FormField
                      control={form.control}
                      name="investment_size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Investment Size *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select investment size" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {investmentOptions.map((opt) => (
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
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="standard_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Standard Price</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="INR">INR (₹)</SelectItem>
                              <SelectItem value="USD">USD ($)</SelectItem>
                              <SelectItem value="EUR">EUR (€)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="unit_of_measure"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit of Measure</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "unit"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select unit" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {unitOfMeasureOptions.map((opt) => (
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
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Detailed description of the asset..."
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="lifecycle" className="mt-0 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="warranty_months"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Warranty (Months)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="e.g. 24"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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

                  <div className="flex gap-6">
                    <FormField
                      control={form.control}
                      name="spare_parts_available"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Spare Parts Available</FormLabel>
                            <FormDescription>
                              Spare parts are readily available
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="is_returnable"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Returnable</FormLabel>
                            <FormDescription>
                              Asset can be returned to vendor
                            </FormDescription>
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
                            placeholder="Instructions for end-of-life disposal..."
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
                        <FormLabel>Environment Impact</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "none"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select impact level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Not Assessed</SelectItem>
                            <SelectItem value="low">Low Impact</SelectItem>
                            <SelectItem value="medium">Medium Impact</SelectItem>
                            <SelectItem value="high">High Impact</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="compliance" className="mt-0 space-y-4">
                  <FormField
                    control={form.control}
                    name="certification_required"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Certification Required</FormLabel>
                          <FormDescription>
                            This asset requires specific certifications
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
                          <Input placeholder="e.g. BIS, FSSAI, ISO 9001 (comma separated)" {...field} />
                        </FormControl>
                        <FormDescription>
                          Enter multiple certifications separated by commas
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
                            placeholder="Space, electrical, ventilation requirements..."
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
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
                        <FormLabel>Product Image URL</FormLabel>
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
                        <FormLabel>Technical Datasheet URL</FormLabel>
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
                        <FormLabel>User Manual URL</FormLabel>
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

            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingAsset ? "Update" : "Add"} Asset Master
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
