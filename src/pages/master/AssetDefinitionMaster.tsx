import { useState, useEffect } from "react";
import { Plus, Search, Loader2, Edit, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Category = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
};

type DefinitionField = {
  id: string;
  category_id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  options: string[] | null;
  is_required: boolean;
  placeholder: string | null;
  sort_order: number;
  status: string;
  created_at: string;
};

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "boolean", label: "Yes / No" },
  { value: "textarea", label: "Long Text" },
];

export default function AssetDefinitionMaster() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [fields, setFields] = useState<DefinitionField[]>([]);
  const [loading, setLoading] = useState(true);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<DefinitionField | null>(null);
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);
  const { toast } = useToast();

  // Form state
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [isRequired, setIsRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState("");
  const [optionsText, setOptionsText] = useState("");

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCategoryId) {
      fetchFields(selectedCategoryId);
    } else {
      setFields([]);
    }
  }, [selectedCategoryId]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, type, parent_id")
      .eq("status", "active")
      .order("name");

    if (!error && data) {
      setCategories(data);
    }
    setLoading(false);
  };

  const fetchFields = async (categoryId: string) => {
    setFieldsLoading(true);
    const { data, error } = await supabase
      .from("asset_definition_fields")
      .select("*")
      .eq("category_id", categoryId)
      .order("sort_order", { ascending: true });

    if (!error) {
      setFields((data as DefinitionField[]) || []);
    }
    setFieldsLoading(false);
  };

  const generateFieldName = (label: string): string => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 50);
  };

  const resetForm = () => {
    setFieldLabel("");
    setFieldType("text");
    setIsRequired(false);
    setPlaceholder("");
    setOptionsText("");
    setEditingField(null);
  };

  const handleOpenDialog = (field?: DefinitionField) => {
    if (field) {
      setEditingField(field);
      setFieldLabel(field.field_label);
      setFieldType(field.field_type);
      setIsRequired(field.is_required);
      setPlaceholder(field.placeholder || "");
      setOptionsText(
        field.options ? (field.options as string[]).join(", ") : ""
      );
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!fieldLabel.trim()) {
      toast({ title: "Error", description: "Field label is required", variant: "destructive" });
      return;
    }

    if (!selectedCategoryId) {
      toast({ title: "Error", description: "Select a category first", variant: "destructive" });
      return;
    }

    const fieldName = editingField ? editingField.field_name : generateFieldName(fieldLabel);
    const options =
      fieldType === "select" && optionsText.trim()
        ? optionsText.split(",").map((o) => o.trim()).filter(Boolean)
        : null;

    const payload = {
      category_id: selectedCategoryId,
      field_name: fieldName,
      field_label: fieldLabel.trim(),
      field_type: fieldType,
      options: options as any,
      is_required: isRequired,
      placeholder: placeholder.trim() || null,
      sort_order: editingField ? editingField.sort_order : fields.length,
    };

    if (editingField) {
      const { error } = await supabase
        .from("asset_definition_fields")
        .update(payload)
        .eq("id", editingField.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update field", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Field updated" });
        setDialogOpen(false);
        resetForm();
        fetchFields(selectedCategoryId);
      }
    } else {
      const { error } = await supabase
        .from("asset_definition_fields")
        .insert(payload);

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Error", description: "A field with this name already exists for this category", variant: "destructive" });
        } else {
          toast({ title: "Error", description: "Failed to add field", variant: "destructive" });
        }
      } else {
        toast({ title: "Success", description: "Field added" });
        setDialogOpen(false);
        resetForm();
        fetchFields(selectedCategoryId);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteFieldId) return;

    const { error } = await supabase
      .from("asset_definition_fields")
      .delete()
      .eq("id", deleteFieldId);

    if (error) {
      toast({ title: "Error", description: "Failed to delete field", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Field deleted" });
      if (selectedCategoryId) fetchFields(selectedCategoryId);
    }
    setDeleteFieldId(null);
  };

  // Build category path
  const getCategoryPath = (categoryId: string): string => {
    const path: string[] = [];
    let current = categories.find((c) => c.id === categoryId);
    while (current) {
      path.unshift(current.name);
      current = categories.find((c) => c.id === current?.parent_id);
    }
    return path.join(" → ");
  };

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">Asset Definition Master</h1>
        <p className="text-muted-foreground">Define custom fields for each asset category</p>
      </div>

      {/* Category Selector */}
      <div className="flex items-end gap-4">
        <div className="flex-1 max-w-md">
          <Label className="mb-2 block text-sm font-medium">Select Category</Label>
          <SearchableSelect
            options={categories.map((c) => ({
              value: c.id,
              label: c.name,
              subtitle: getCategoryPath(c.id),
            }))}
            value={selectedCategoryId}
            onValueChange={setSelectedCategoryId}
            placeholder="Choose a category..."
            searchPlaceholder="Search categories..."
            emptyMessage="No categories found"
          />
        </div>
        {selectedCategoryId && (
          <Button className="gap-2" onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4" />
            Add Field
          </Button>
        )}
      </div>

      {/* Selected category info */}
      {selectedCategory && (
        <div className="text-sm text-muted-foreground">
          Category Path: <span className="font-medium text-foreground">{getCategoryPath(selectedCategoryId)}</span>
          {" · "}
          Type: <Badge variant="outline" className="text-xs">{selectedCategory.type}</Badge>
        </div>
      )}

      {/* Fields Table */}
      {selectedCategoryId ? (
        fieldsLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead>Field Label</TableHead>
                  <TableHead>Field Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Options</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No fields defined for this category. Click "Add Field" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  fields.map((field, idx) => (
                    <TableRow key={field.id}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{field.field_label}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{field.field_name}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {FIELD_TYPES.find((t) => t.value === field.field_type)?.label || field.field_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {field.is_required ? (
                          <Badge variant="default" className="text-xs">Required</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Optional</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {field.field_type === "select" && field.options ? (
                          <span className="text-xs text-muted-foreground">
                            {(field.options as string[]).join(", ")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenDialog(field)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteFieldId(field.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )
      ) : (
        <div className="text-center py-12 text-muted-foreground border rounded-xl bg-card">
          Select a category above to define its asset fields
        </div>
      )}

      {/* Add/Edit Field Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(isOpen) => {
        setDialogOpen(isOpen);
        if (!isOpen) resetForm();
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingField ? "Edit Field" : "Add Field"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Field Label *</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Serial Number"
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
              />
            </div>

            <div>
              <Label>Field Type</Label>
              <Select value={fieldType} onValueChange={setFieldType}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {fieldType === "select" && (
              <div>
                <Label>Dropdown Options</Label>
                <Input
                  className="mt-1.5"
                  placeholder="Comma-separated e.g. Option A, Option B, Option C"
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter options separated by commas
                </p>
              </div>
            )}

            <div>
              <Label>Placeholder Text</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Enter serial number..."
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-required"
                checked={isRequired}
                onCheckedChange={(checked) => setIsRequired(!!checked)}
              />
              <Label htmlFor="is-required">Required field</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                {editingField ? "Update" : "Add Field"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteFieldId} onOpenChange={() => setDeleteFieldId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this field definition and any associated values across all asset masters.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
