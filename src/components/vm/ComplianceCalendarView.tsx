import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Camera, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  isBefore,
  startOfDay,
} from "date-fns";

type ComplianceTask = {
  id: string;
  title: string;
  description: string | null;
  frequency: string;
  due_date: string;
  status: string;
  assigned_to: string | null;
  assigned_to_user_id: string | null;
  is_recurring: boolean | null;
  planogram_id: string | null;
  store_id: string | null;
  planogram: { id: string; title: string; zone: string } | null;
  store: { id: string; name: string } | null;
  assigned_user: { id: string; username: string } | null;
};

type ComplianceCalendarViewProps = {
  tasks: ComplianceTask[];
  onTaskClick: (task: ComplianceTask) => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ComplianceCalendarView({
  tasks,
  onTaskClick,
}: ComplianceCalendarViewProps) {
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
    return tasks.filter((task) => {
      const taskDate = new Date(task.due_date);
      return isSameDay(taskDate, date);
    });
  };

  const getTaskStatus = (task: ComplianceTask) => {
    if (task.status === "approved" || task.status === "completed") return "completed";
    if (task.status === "submitted") return "submitted";
    const dueDate = new Date(task.due_date);
    const today = startOfDay(new Date());
    if (isBefore(dueDate, today)) return "overdue";
    if (isSameDay(dueDate, today)) return "due-today";
    return "pending";
  };

  const getTaskColor = (task: ComplianceTask) => {
    const status = getTaskStatus(task);
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30";
      case "submitted":
        return "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30";
      case "overdue":
        return "bg-destructive/20 text-destructive border-destructive/30";
      case "due-today":
        return "bg-warning/20 text-warning-foreground border-warning/30";
      default:
        return "bg-primary/20 text-primary border-primary/30";
    }
  };

  const getStatusIcon = (task: ComplianceTask) => {
    const status = getTaskStatus(task);
    switch (status) {
      case "completed":
        return <CheckCircle className="h-3 w-3" />;
      case "submitted":
        return <Camera className="h-3 w-3" />;
      case "overdue":
        return <AlertCircle className="h-3 w-3" />;
      case "due-today":
        return <Clock className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  // Stats for the current month
  const monthStats = useMemo(() => {
    const monthTasks = tasks.filter((task) => {
      const taskDate = new Date(task.due_date);
      return isSameMonth(taskDate, currentMonth);
    });

    return {
      total: monthTasks.length,
      pending: monthTasks.filter(t => t.status === "pending").length,
      submitted: monthTasks.filter(t => t.status === "submitted").length,
      completed: monthTasks.filter(t => t.status === "approved").length,
      overdue: monthTasks.filter(t => {
        const dueDate = new Date(t.due_date);
        return t.status === "pending" && isBefore(dueDate, startOfDay(new Date()));
      }).length,
    };
  }, [tasks, currentMonth]);

  // Upcoming reminders (next 7 days)
  const upcomingReminders = useMemo(() => {
    const today = startOfDay(new Date());
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return tasks
      .filter((task) => {
        const dueDate = new Date(task.due_date);
        return (
          task.status === "pending" &&
          dueDate >= today &&
          dueDate <= nextWeek
        );
      })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 5);
  }, [tasks]);

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-muted/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">This Month</p>
            <p className="text-xl font-bold">{monthStats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-xl font-bold text-yellow-600">{monthStats.pending}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="text-xl font-bold text-blue-600">{monthStats.submitted}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Approved</p>
            <p className="text-xl font-bold text-green-600">{monthStats.completed}</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="text-xl font-bold text-destructive">{monthStats.overdue}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        {/* Calendar */}
        <div className="lg:col-span-3 rounded-xl border bg-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="font-semibold text-lg">
              {format(currentMonth, "MMMM yyyy")}
            </h3>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b bg-muted/20">
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
          <div className="grid grid-cols-7 auto-rows-[90px]">
            {calendarDays.map((day, index) => {
              const dayTasks = getTasksForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={index}
                  className={`border-b border-r p-1 ${
                    !isCurrentMonth ? "bg-muted/30" : ""
                  } ${isCurrentDay ? "bg-primary/5" : ""}`}
                >
                  <div
                    className={`text-sm mb-1 ${
                      isCurrentDay
                        ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center font-medium"
                        : isCurrentMonth
                          ? "text-foreground"
                          : "text-muted-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5 overflow-auto max-h-[60px]">
                    {dayTasks.slice(0, 2).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => onTaskClick(task)}
                        className={`w-full text-left text-xs px-1.5 py-0.5 rounded border truncate flex items-center gap-1 ${getTaskColor(task)} hover:opacity-80 transition-opacity`}
                      >
                        {getStatusIcon(task)}
                        <span className="truncate">{task.store?.name || task.title}</span>
                      </button>
                    ))}
                    {dayTasks.length > 2 && (
                      <p className="text-xs text-muted-foreground px-1">
                        +{dayTasks.length - 2} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 p-3 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground">Legend:</span>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-xs">
                <Clock className="h-3 w-3 mr-1" /> Pending
              </Badge>
              <Badge variant="outline" className="bg-warning/20 text-warning-foreground border-warning/30 text-xs">
                <Clock className="h-3 w-3 mr-1" /> Due Today
              </Badge>
              <Badge variant="outline" className="bg-blue-500/20 text-blue-700 border-blue-500/30 text-xs">
                <Camera className="h-3 w-3 mr-1" /> Submitted
              </Badge>
              <Badge variant="outline" className="bg-green-500/20 text-green-700 border-green-500/30 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" /> Approved
              </Badge>
              <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30 text-xs">
                <AlertCircle className="h-3 w-3 mr-1" /> Overdue
              </Badge>
            </div>
          </div>
        </div>

        {/* Upcoming Reminders Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Photo Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingReminders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming tasks in the next 7 days
                </p>
              ) : (
                upcomingReminders.map((task) => {
                  const dueDate = new Date(task.due_date);
                  const isDueToday = isToday(dueDate);
                  
                  return (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className="w-full text-left p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {task.store?.name}
                          </p>
                        </div>
                        {isDueToday && (
                          <Badge variant="secondary" className="bg-warning/20 text-warning-foreground text-xs shrink-0">
                            Today
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{format(dueDate, "EEE, MMM d 'at' h:mm a")}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {task.frequency}
                        </Badge>
                        {task.is_recurring && (
                          <Badge variant="outline" className="text-xs bg-primary/10">
                            Recurring
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
