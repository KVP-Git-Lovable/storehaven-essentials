import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, User } from "lucide-react";

interface RosterEmployeeCardProps {
  employee: {
    id: string;
    name: string;
    department: string;
    position: string;
  };
  shiftType?: string;
  roleName?: string;
  onRemove?: () => void;
  compact?: boolean;
}

export function RosterEmployeeCard({ employee, shiftType, roleName, onRemove, compact }: RosterEmployeeCardProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-3 w-3 text-primary" />
        </div>
        <span className="font-medium truncate">{employee.name}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors group">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <User className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{employee.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {employee.position} · {employee.department}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {roleName && <Badge variant="outline" className="text-[10px] px-1.5">{roleName}</Badge>}
        {shiftType && (
          <Badge variant="secondary" className="text-[10px] px-1.5 capitalize">{shiftType}</Badge>
        )}
      </div>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
