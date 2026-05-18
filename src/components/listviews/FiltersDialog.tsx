import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { FilterRow } from "@/components/listviews/FilterRow";
import type { FieldDef, FilterCondition } from "@/lib/listViewSchema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableFields: FieldDef[];
  initialFilters: FilterCondition[];
  onSave: (filters: FilterCondition[]) => void;
}

export function FiltersDialog({ open, onOpenChange, availableFields, initialFilters, onSave }: Props) {
  const [filters, setFilters] = useState<FilterCondition[]>([]);

  useEffect(() => {
    if (open) setFilters(initialFilters);
  }, [open, initialFilters]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {availableFields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add fields to this list view (Gear → Select Fields to Display) before adding filters.
            </p>
          ) : (
            <>
              {filters.length === 0 && (
                <p className="text-sm text-muted-foreground">No filters — all rows will match.</p>
              )}
              {filters.map((f, idx) => (
                <FilterRow
                  key={idx}
                  fields={availableFields}
                  value={f}
                  onChange={(next) => setFilters(filters.map((x, i) => (i === idx ? next : x)))}
                  onRemove={() => setFilters(filters.filter((_, i) => i !== idx))}
                />
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setFilters([...filters, { field: availableFields[0].key, operator: "eq", value: "" }])
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Add filter
              </Button>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onSave(filters); onOpenChange(false); }}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}