import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Plus, Edit2, Trash2, AlertCircle } from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";
import { Scheme, SchemeRuleType } from "@/types/schemes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronsUpDown } from "lucide-react";

/** Flat editable shape covering every scheme variant's fields. */
type SchemeForm = {
  [key: string]: any;
  rule_type?: SchemeRuleType;
  target_categories?: string[];
  target_products?: string[];
  price_min?: number | null;
  price_max?: number | null;
  dia_charge_min?: number | null;
  dia_charge_max?: number | null;
  making_charge_min?: number | null;
  making_charge_max?: number | null;
};

type CatalogProduct = {
  id: string;
  title: string;
  product_type: string | null;
  base_price: number | null;
};

const fmt = (n: number | null | undefined) =>
  n == null ? "" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const RULE_TYPES: { value: SchemeRuleType; label: string; description: string }[] = [
  { value: "generic", label: "Universal", description: "Applies to all products" },
  { value: "category", label: "Category", description: "Targets specific categories" },
  { value: "category_dia", label: "Category + Diamond Charge", description: "Category with diamond charge range" },
  { value: "category_making", label: "Category + Making Charge", description: "Category with making charge range" },
  { value: "category_price", label: "Category + Price", description: "Category with price range" },
  { value: "product", label: "Individual Product", description: "Targets specific products" },
];

const DISCOUNT_TYPES = [
  "percentage",
  "fixed",
  "buy_x_get_y",
  "tiered",
  "bundle",
  "cashback",
  "free_shipping",
  "second_at_discount",
];

const DISCOUNT_BASIS = ["product_price", "dia_charge", "making_charge", "total_eligible"];

function SchemeDialog({
  scheme,
  open,
  onOpenChange,
  products = [],
  categories = [],
}: {
  scheme?: Scheme | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products?: CatalogProduct[];
  categories?: string[];
}) {
  const [formData, setFormData] = useState<SchemeForm>(
    (scheme as SchemeForm) || {
      rule_type: "generic",
      discount_type: "percentage",
      discount_basis: "product_price",
      status: "active",
      priority: 0,
      is_auto_apply: true,
    }
  );

  useEffect(() => {
    if (scheme) {
      setFormData(scheme as SchemeForm);
    }
  }, [scheme]);

  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: SchemeForm) => {
      setError(null);

      // Validate required fields
      if (!data.name?.trim()) {
        throw new Error("Scheme name is required");
      }
      if (!data.start_date) {
        throw new Error("Start date is required");
      }
      if (!data.end_date) {
        throw new Error("End date is required");
      }
      if (data.discount_type === "percentage" && !data.discount_value) {
        throw new Error("Discount value is required");
      }

      // Ensure dates are in ISO format (YYYY-MM-DD)
      const normalizeDate = (dateStr: string): string => {
        if (!dateStr) return dateStr;
        // If already in YYYY-MM-DD format, return as-is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        // If in DD/MM/YYYY format, convert to YYYY-MM-DD
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
          const [day, month, year] = dateStr.split("/");
          return `${year}-${month}-${day}`;
        }
        return dateStr;
      };

      const preparedData = {
        ...data,
        start_date: normalizeDate(data.start_date || ""),
        end_date: normalizeDate(data.end_date || ""),
      };

      if (scheme?.id) {
        const { error } = await supabase
          .from("schemes")
          .update(preparedData as any)
          .eq("id", scheme.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("schemes").insert([preparedData as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schemes"] });
      onOpenChange(false);
      setFormData({
        rule_type: "generic",
        discount_type: "percentage",
        discount_basis: "product_price",
        status: "active",
        priority: 0,
        is_auto_apply: true,
      });
      setError(null);
    },
    onError: (err: any) => {
      const errorMessage = err.message || "Failed to save scheme. Please try again.";
      setError(errorMessage);
      console.error("Scheme creation error:", err);
    },
  });

  const ruleType = formData.rule_type as SchemeRuleType;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{scheme ? "Edit Scheme" : "Create Scheme"}</DialogTitle>
          <DialogDescription>
            Configure discount rules and targeting criteria
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid gap-4">
            <div>
              <Label htmlFor="name">Scheme Name</Label>
              <Input
                id="name"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Summer Sale"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Scheme details..."
              />
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date || ""}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date || ""}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          {/* Rule Type */}
          <div>
            <Label htmlFor="rule_type">Targeting Type</Label>
            <Select value={ruleType} onValueChange={(value) => setFormData({ ...formData, rule_type: value as SchemeRuleType })}>
              <SelectTrigger id="rule_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RULE_TYPES.map((rt) => (
                  <SelectItem key={rt.value} value={rt.value}>
                    <div>
                      <div className="font-medium">{rt.label}</div>
                      <div className="text-xs text-muted-foreground">{rt.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category/Product Selection */}
          {(ruleType === "category" || ruleType === "category_dia" || ruleType === "category_making" || ruleType === "category_price") && (
            <div>
              <Label>Categories</Label>
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div key={cat} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`cat-${cat}`}
                      checked={(formData.target_categories || []).includes(cat)}
                      onChange={(e) => {
                        const current = formData.target_categories || [];
                        setFormData({
                          ...formData,
                          target_categories: e.target.checked
                            ? [...current, cat]
                            : current.filter((c) => c !== cat),
                        });
                      }}
                    />
                    <Label htmlFor={`cat-${cat}`} className="font-normal cursor-pointer">
                      {cat}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ruleType === "product" && (
            <div>
              <Label>Products</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2">
                {products.map((prod) => (
                  <div key={prod.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`prod-${prod.id}`}
                      checked={(formData.target_products || []).includes(prod.id)}
                      onChange={(e) => {
                        const current = formData.target_products || [];
                        setFormData({
                          ...formData,
                          target_products: e.target.checked
                            ? [...current, prod.id]
                            : current.filter((p) => p !== prod.id),
                        });
                      }}
                    />
                    <Label htmlFor={`prod-${prod.id}`} className="font-normal cursor-pointer">
                      {prod.title} - {fmt(prod.base_price)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Price/Charge Ranges */}
          {ruleType === "category_price" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price_min">Min Price</Label>
                <Input
                  id="price_min"
                  type="number"
                  value={formData.price_min ?? ""}
                  onChange={(e) => setFormData({ ...formData, price_min: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
              <div>
                <Label htmlFor="price_max">Max Price</Label>
                <Input
                  id="price_max"
                  type="number"
                  value={formData.price_max ?? ""}
                  onChange={(e) => setFormData({ ...formData, price_max: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
            </div>
          )}

          {ruleType === "category_dia" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dia_min">Min Diamond Charge</Label>
                <Input
                  id="dia_min"
                  type="number"
                  value={formData.dia_charge_min ?? ""}
                  onChange={(e) => setFormData({ ...formData, dia_charge_min: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
              <div>
                <Label htmlFor="dia_max">Max Diamond Charge</Label>
                <Input
                  id="dia_max"
                  type="number"
                  value={formData.dia_charge_max ?? ""}
                  onChange={(e) => setFormData({ ...formData, dia_charge_max: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
            </div>
          )}

          {ruleType === "category_making" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="making_min">Min Making Charge</Label>
                <Input
                  id="making_min"
                  type="number"
                  value={formData.making_charge_min ?? ""}
                  onChange={(e) => setFormData({ ...formData, making_charge_min: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
              <div>
                <Label htmlFor="making_max">Max Making Charge</Label>
                <Input
                  id="making_max"
                  type="number"
                  value={formData.making_charge_max ?? ""}
                  onChange={(e) => setFormData({ ...formData, making_charge_max: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
            </div>
          )}

          {/* Discount Configuration */}
          <div className="border-t pt-4 space-y-4">
            <div>
              <Label htmlFor="discount_type">Discount Type</Label>
              <Select value={formData.discount_type || ""} onValueChange={(value) => setFormData({ ...formData, discount_type: value as any })}>
                <SelectTrigger id="discount_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISCOUNT_TYPES.map((dt) => (
                    <SelectItem key={dt} value={dt}>
                      {dt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="discount_basis">Apply Discount To</Label>
              <Select value={formData.discount_basis || ""} onValueChange={(value) => setFormData({ ...formData, discount_basis: value as any })}>
                <SelectTrigger id="discount_basis">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISCOUNT_BASIS.map((db) => (
                    <SelectItem key={db} value={db}>
                      {db}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="discount_value">Discount Value</Label>
                <Input
                  id="discount_value"
                  type="number"
                  value={formData.discount_value || ""}
                  onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                  placeholder={formData.discount_type === "percentage" ? "%" : "₹"}
                />
              </div>
              <div>
                <Label htmlFor="max_discount">Max Discount Amount (₹)</Label>
                <Input
                  id="max_discount"
                  type="number"
                  value={formData.max_discount_amount ?? ""}
                  onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
            </div>
          </div>

          {/* Priority & Auto-Apply */}
          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority ?? 0}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value ? parseInt(e.target.value) : 0 })}
                placeholder="Higher = higher priority"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="auto_apply"
                checked={formData.is_auto_apply ?? true}
                onCheckedChange={(checked) => setFormData({ ...formData, is_auto_apply: checked })}
              />
              <Label htmlFor="auto_apply" className="font-normal cursor-pointer">
                Auto-apply at checkout
              </Label>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 border-t pt-4">
            <Switch
              id="status"
              checked={formData.status === "active"}
              onCheckedChange={(checked) => setFormData({ ...formData, status: checked ? "active" : "inactive" })}
            />
            <Label htmlFor="status" className="font-normal cursor-pointer">
              Active
            </Label>
          </div>
        </div>

        <div className="flex gap-2 justify-end border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate(formData)} disabled={mutation.isPending || !formData.name}>
            {scheme ? "Update" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SchemeConfigMaster() {
  const [searchQuery, setSearchQuery] = useState("");
  const [ruleTypeFilter, setRuleTypeFilter] = useState<SchemeRuleType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState<Scheme | null>(null);
  const [deleteConfirmScheme, setDeleteConfirmScheme] = useState<Scheme | null>(null);

  const queryClient = useQueryClient();

  const { data: schemes = [], isLoading: schemesLoading } = useQuery({
    queryKey: ["schemes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schemes").select("*").order("priority", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Scheme[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["catalog_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_products")
        .select("id,title,product_type,base_price")
        .eq("status", "active")
        .order("product_type", { ascending: true })
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CatalogProduct[];
    },
  });

  const categories = Array.from(new Set(products.map((p) => p.product_type).filter(Boolean))).sort() as string[];

  const deleteMutation = useMutation({
    mutationFn: async (schemeId: string) => {
      const { error } = await supabase.from("schemes").delete().eq("id", schemeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schemes"] });
      setDeleteConfirmScheme(null);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (scheme: Scheme) => {
      const { error } = await supabase
        .from("schemes")
        .update({ status: scheme.status === "active" ? "inactive" : "active" })
        .eq("id", scheme.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schemes"] });
    },
  });

  let filteredSchemes = schemes;

  if (searchQuery) {
    filteredSchemes = filteredSchemes.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  if (ruleTypeFilter !== "all") {
    filteredSchemes = filteredSchemes.filter((s) => s.rule_type === ruleTypeFilter);
  }

  if (statusFilter !== "all") {
    filteredSchemes = filteredSchemes.filter((s) => s.status === statusFilter);
  }

  const getSchemeDescription = (scheme: Scheme): string => {
    const lines: string[] = [];
    lines.push(RULE_TYPES.find((rt) => rt.value === scheme.rule_type)?.label || scheme.rule_type);

    if (scheme.rule_type === "category" || scheme.rule_type === "category_dia" || scheme.rule_type === "category_making" || scheme.rule_type === "category_price") {
      const cats = (scheme.target_categories || []).join(", ");
      lines.push(`Categories: ${cats || "—"}`);
    }

    if (scheme.rule_type === "product") {
      const prods = (scheme.target_products || []).length;
      lines.push(`Products: ${prods} selected`);
    }

    if (scheme.rule_type === "category_price") {
      lines.push(`Price Range: ${fmt(scheme.price_min)} - ${fmt(scheme.price_max)}`);
    }

    if (scheme.rule_type === "category_dia") {
      lines.push(`Diamond Charge: ${scheme.dia_charge_min || 0} - ${scheme.dia_charge_max || "∞"}`);
    }

    if (scheme.rule_type === "category_making") {
      lines.push(`Making Charge: ${scheme.making_charge_min || 0} - ${scheme.making_charge_max || "∞"}`);
    }

    return lines.join(" • ");
  };

  return (
    <div className="space-y-6 p-6">
      <BackButton />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Scheme Config Master</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage discount schemes and promotional offers
          </p>
        </div>
        <Button onClick={() => { setEditingScheme(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Scheme
        </Button>
      </div>

      <SchemeDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingScheme(null);
        }}
        scheme={editingScheme}
        products={products}
        categories={categories}
      />

      <Card>
        <CardHeader>
          <CardTitle>Schemes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search schemes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={ruleTypeFilter} onValueChange={(v: any) => setRuleTypeFilter(v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {RULE_TYPES.map((rt) => (
                  <SelectItem key={rt.value} value={rt.value}>
                    {rt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {schemesLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading schemes...</p>
          ) : filteredSchemes.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                {schemes.length === 0 ? "No schemes created yet" : "No schemes match your filters"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scheme Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden lg:table-cell">Targeting</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead className="hidden md:table-cell">Period</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSchemes.map((scheme) => (
                    <TableRow key={scheme.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{scheme.name}</div>
                          <div className="text-xs text-muted-foreground">{scheme.description || "—"}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {RULE_TYPES.find((rt) => rt.value === scheme.rule_type)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="text-sm text-muted-foreground">{getSchemeDescription(scheme)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">
                            {scheme.discount_type === "percentage"
                              ? `${scheme.discount_value}%`
                              : fmt(scheme.discount_value)}{" "}
                            {scheme.discount_type}
                          </div>
                          <div className="text-xs text-muted-foreground">on {scheme.discount_basis}</div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-xs">
                          {scheme.start_date} to {scheme.end_date}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          <Badge
                            variant={scheme.status === "active" ? "default" : "secondary"}
                            className="cursor-pointer"
                            onClick={() => toggleStatusMutation.mutate(scheme)}
                          >
                            {scheme.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingScheme(scheme);
                              setDialogOpen(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmScheme(scheme)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmScheme} onOpenChange={(open) => !open && setDeleteConfirmScheme(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scheme?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmScheme?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmScheme && deleteMutation.mutate(deleteConfirmScheme.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
