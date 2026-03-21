import { Badge } from "@/components/ui/badge";
import { User, CalendarOff } from "lucide-react";
import { format } from "date-fns";

interface LeaveEmployeesListProps {
  storeId: string;
  rosterDate: string;
  leaveRecords: any[];
  rosteredEmployeeIds: string[];
}

export function LeaveEmployeesList({ leaveRecords, rosteredEmployeeIds }: LeaveEmployeesListProps) {
  const conflicting = leaveRecords.filter(l => rosteredEmployeeIds.includes(l.employee_id));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarOff className="h-4 w-4 text-destructive" />
        <h4 className="text-sm font-semibold">Employees on Leave</h4>
        <Badge variant="destructive" className="text-xs">{leaveRecords.length}</Badge>
      </div>

      {leaveRecords.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No employees on leave for this date.</p>
      ) : (
        <div className="space-y-2">
          {leaveRecords.map((lr: any) => {
            const emp = lr.employees;
            const isConflict = rosteredEmployeeIds.includes(lr.employee_id);
            return (
              <div
                key={lr.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                  isConflict ? "border-destructive/50 bg-destructive/5" : "bg-card"
                }`}
              >
                <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{emp?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {emp?.position} · {lr.leave_type || "Leave"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(lr.start_date), "dd MMM")} — {format(new Date(lr.end_date), "dd MMM")}
                  </p>
                </div>
                {isConflict && (
                  <Badge variant="destructive" className="text-[10px] shrink-0">
                    ⚠ On Roster
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      {conflicting.length > 0 && (
        <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <p className="text-xs font-medium text-destructive">
            ⚠ {conflicting.length} employee(s) are on leave but still rostered.
            Use AI Rebalance to automatically fix conflicts.
          </p>
        </div>
      )}
    </div>
  );
}
