import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { OPERATORS_BY_TYPE, type EntityDef, type FilterCondition } from "@/lib/listViewSchema";

interface Props {
  entity: EntityDef;
  value: FilterCondition;
  onChange: (next: FilterCondition) => void;
  onRemove: () => void;
}

export function FilterRow({ entity, value, onChange, onRemove }: Props) {
  const fieldMeta = entity.fields.find((f) => f.key === value.field) || entity.fields[0];
  const operators = OPERATORS_BY_TYPE[fieldMeta.type];
  const opMeta = operators.find((o) => o.value === value.operator) || operators[0];

  return (
    <div className="flex items-center gap-2">
      <Select
        value={value.field}
        onValueChange={(field) => {
          const newMeta = entity.fields.find((f) => f.key === field)!;
          const newOps = OPERATORS_BY_TYPE[newMeta.type];
          onChange({ field, operator: newOps[0].value, value: "" });
        }}
      >
        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {entity.fields.map((f) => (
            <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={value.operator} onValueChange={(operator) => onChange({ ...value, operator })}>
        <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {operators.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {opMeta.needsValue && (
        fieldMeta.type === "enum" && fieldMeta.options ? (
          <Select value={String(value.value ?? "")} onValueChange={(v) => onChange({ ...value, value: v })}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {fieldMeta.options.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            className="flex-1"
            type={fieldMeta.type === "number" || value.operator === "last_n_days" ? "number" : fieldMeta.type === "date" ? "date" : "text"}
            value={String(value.value ?? "")}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
            placeholder="Value"
          />
        )
      )}

      <Button variant="ghost" size="icon" onClick={onRemove}><X className="h-4 w-4" /></Button>
    </div>
  );
}
