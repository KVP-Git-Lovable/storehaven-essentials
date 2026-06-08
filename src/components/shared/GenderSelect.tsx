import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

interface Props {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function GenderSelect({ value, onChange, disabled, placeholder = "Select gender", className }: Props) {
  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => onChange(v || null)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {GENDER_OPTIONS.map((g) => (
          <SelectItem key={g} value={g}>{g}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function formatDOB(value: string | null | undefined): string {
  if (!value) return "—";
  // Accept ISO date "yyyy-mm-dd" or full ISO timestamp
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}