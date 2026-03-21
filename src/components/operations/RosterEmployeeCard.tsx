import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, User, GripVertical } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";

interface RosterEmployeeCardProps {
  id?: string;
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
  draggable?: boolean;
}

export function RosterEmployeeCard({ id, employee, shiftType, roleName, onRemove, compact, draggable }: RosterEmployeeCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id || employee.id,
    disabled: !draggable,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

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
    <div
      ref={draggable ? setNodeRef : undefined}
      style={style}
      className={`flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors group ${
        isDragging ? "opacity-50 shadow-lg ring-2 ring-primary/30" : ""
      }`}
    >
      {draggable && (
        <button {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
      )}
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
