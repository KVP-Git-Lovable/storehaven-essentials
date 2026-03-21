import { useDroppable } from "@dnd-kit/core";
import { ReactNode } from "react";

interface RosterShiftDropZoneProps {
  shiftType: string;
  rosterEntries: any[];
  children: ReactNode;
}

export function RosterShiftDropZone({ shiftType, children }: RosterShiftDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({ id: shiftType });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg p-3 transition-colors ${
        isOver ? "bg-primary/10 ring-2 ring-primary/30 ring-dashed" : ""
      }`}
    >
      {children}
    </div>
  );
}
