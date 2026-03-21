import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle, Play, AlertTriangle, User, XCircle, ArrowRight } from "lucide-react";
import { RosterEmployeeCard } from "./RosterEmployeeCard";

interface DayPlannerViewProps {
  storeId: string;
  selectedDate: string;
  taskInstances: any[] | undefined;
  onTaskClick: (task: any) => void;
}

const SHIFT_ORDER = ["morning", "afternoon", "evening", "night"];
const SHIFT_COLORS: Record<string, string> = {
  morning: "border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
  afternoon: "border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/20",
  evening: "border-l-purple-400 bg-purple-50/50 dark:bg-purple-950/20",
  night: "border-l-slate-400 bg-slate-50/50 dark:bg-slate-950/20",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5 text-yellow-600" />,
  in_progress: <Play className="h-3.5 w-3.5 text-blue-600" />,
  completed: <CheckCircle className="h-3.5 w-3.5 text-green-600" />,
  overdue: <XCircle className="h-3.5 w-3.5 text-red-600" />,
  escalated: <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />,
  handed_over: <ArrowRight className="h-3.5 w-3.5 text-purple-600" />,
};

export function DayPlannerView({ storeId, selectedDate, taskInstances, onTaskClick }: DayPlannerViewProps) {
  const { data: roster } = useQuery({
    queryKey: ["daily-roster", storeId, selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_rosters")
        .select("*, employees(id, name, department, position), role_master(id, name)")
        .eq("store_id", storeId)
        .eq("roster_date", selectedDate)
        .order("shift_type");
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const getShiftTasks = (shift: string) =>
    taskInstances?.filter((t) => t.role_master?.shift_type === shift)
      .sort((a: any, b: any) => (a.scheduled_time || "").localeCompare(b.scheduled_time || "")) || [];

  const getShiftRoster = (shift: string) => roster?.filter((r: any) => r.shift_type === shift) || [];

  const getEmployeeForTask = (task: any) => {
    if (task.assigned_employee_id) {
      const entry = roster?.find((r: any) => r.employee_id === task.assigned_employee_id);
      return entry?.employees;
    }
    // Fallback: find employee in roster with matching role
    const entry = roster?.find((r: any) => r.role_id === task.role_id);
    return entry?.employees;
  };

  if (!storeId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Select a store to view the day planner.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {SHIFT_ORDER.map((shift) => {
        const tasks = getShiftTasks(shift);
        const shiftRoster = getShiftRoster(shift);

        return (
          <div key={shift} className={`rounded-lg border-l-4 p-4 ${SHIFT_COLORS[shift] || ""}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold capitalize text-base">{shift} Shift</h3>
                <Badge variant="outline" className="text-xs">{tasks.length} tasks</Badge>
              </div>
              {shiftRoster.length > 0 && (
                <div className="flex items-center gap-1">
                  {shiftRoster.slice(0, 3).map((r: any) => (
                    <RosterEmployeeCard key={r.id} employee={r.employees} compact />
                  ))}
                  {shiftRoster.length > 3 && (
                    <Badge variant="secondary" className="text-[10px]">+{shiftRoster.length - 3}</Badge>
                  )}
                </div>
              )}
            </div>

            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No tasks scheduled for this shift</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task: any) => {
                  const assignedEmployee = getEmployeeForTask(task);
                  return (
                    <Card
                      key={task.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => onTaskClick(task)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center text-xs text-muted-foreground min-w-[50px]">
                            <span className="font-mono">{task.scheduled_time?.slice(0, 5)}</span>
                            <span className="text-[10px]">to</span>
                            <span className="font-mono">{task.due_time?.slice(0, 5)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {STATUS_ICONS[task.status]}
                              <span className="font-medium text-sm truncate">{task.task_master?.name}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px] capitalize">{task.status}</Badge>
                              {task.role_master?.name && (
                                <span className="text-xs text-muted-foreground">{task.role_master.name}</span>
                              )}
                            </div>
                          </div>
                          {assignedEmployee ? (
                            <div className="flex items-center gap-1.5 text-xs shrink-0">
                              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-3 w-3 text-primary" />
                              </div>
                              <span className="text-muted-foreground max-w-[80px] truncate">{assignedEmployee.name}</span>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] shrink-0">Unassigned</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
