import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
  isToday,
} from "date-fns";

type MaintenanceTask = {
  id: string;
  asset: string;
  asset_id: string | null;
  store_id: string | null;
  task_type: string;
  frequency: string;
  last_done: string;
  next_due: string;
  assigned_to: string;
  status: string;
  store?: { name: string } | null;
};

type MaintenanceCalendarViewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedules: MaintenanceTask[];
  onTaskClick: (task: MaintenanceTask) => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MaintenanceCalendarView({
  open,
  onOpenChange,
  schedules,
  onTaskClick,
}: MaintenanceCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    // Add padding days for the start of the week
    const startPadding = getDay(start);
    const paddingDays: Date[] = [];
    for (let i = startPadding - 1; i >= 0; i--) {
      const paddingDate = new Date(start);
      paddingDate.setDate(paddingDate.getDate() - (i + 1));
      paddingDays.push(paddingDate);
    }

    return [...paddingDays, ...days];
  }, [currentMonth]);

  const getTasksForDay = (date: Date) => {
    return schedules.filter((task) => {
      const taskDate = new Date(task.next_due);
      return isSameDay(taskDate, date);
    });
  };

  const getTaskColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-primary text-primary-foreground";
      case "due-soon":
        return "bg-warning text-warning-foreground";
      case "overdue":
        return "bg-destructive text-destructive-foreground";
      case "completed":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-primary text-primary-foreground";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>PM Calendar</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium min-w-[140px] text-center">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 auto-rows-[100px]">
            {calendarDays.map((day, index) => {
              const dayTasks = getTasksForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={index}
                  className={`border-b border-r p-1 ${
                    !isCurrentMonth ? "bg-muted/30" : ""
                  }`}
                >
                  <div
                    className={`text-sm mb-1 ${
                      isCurrentDay
                        ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center"
                        : isCurrentMonth
                          ? "text-foreground"
                          : "text-muted-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1 overflow-auto max-h-[70px]">
                    {dayTasks.slice(0, 3).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => onTaskClick(task)}
                        className={`w-full text-left text-xs px-1 py-0.5 rounded truncate ${getTaskColor(task.status)} hover:opacity-80 transition-opacity`}
                      >
                        {task.asset}
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <p className="text-xs text-muted-foreground px-1">
                        +{dayTasks.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex-shrink-0 flex items-center gap-4 pt-4 border-t">
          <span className="text-sm text-muted-foreground">Status:</span>
          <div className="flex items-center gap-2">
            <Badge variant="default">Scheduled</Badge>
            <Badge variant="secondary">Due Soon</Badge>
            <Badge variant="destructive">Overdue</Badge>
            <Badge variant="outline">Completed</Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
