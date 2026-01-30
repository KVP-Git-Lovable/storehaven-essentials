import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ColumnVisibilityDropdownProps {
  visibleColumns: Record<string, boolean>;
  onToggle: (column: string) => void;
}

const columnLabels: Record<string, string> = {
  photo: "Photo",
  username: "User Name",
  email: "Email",
  role: "Role",
  manager: "Reporting Manager",
  status: "Active Status",
};

export function ColumnVisibilityDropdown({
  visibleColumns,
  onToggle,
}: ColumnVisibilityDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Columns3 className="h-4 w-4" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {Object.entries(columnLabels).map(([key, label]) => (
          <DropdownMenuCheckboxItem
            key={key}
            checked={visibleColumns[key]}
            onCheckedChange={() => onToggle(key)}
          >
            {label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
