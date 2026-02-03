import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, AlertCircle, CheckCircle, Wrench, Store, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  getDay,
  isToday,
  isBefore,
  startOfDay,
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
  pm_checklist_master_id?: string | null;
};

type CalendarMode = "day" | "week" | "month";

type PMCalendarViewProps = {
  schedules: MaintenanceTask[];
  onTaskClick: (task: MaintenanceTask) => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PMCalendarView({ schedules, onTaskClick }: PMCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");

  const navigatePrev = () => {
    if (calendarMode === "month") setCurrentDate(subMonths(currentDate, 1));
    else if (calendarMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const navigateNext = () => {
    if (calendarMode === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (calendarMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const handleDateClick = (date: Date) => {
    setCurrentDate(date);
    setCalendarMode("day");
  };

  const calendarDays = useMemo(() => {
    if (calendarMode === "day") {
      return [currentDate];
    }
    if (calendarMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    }
    // Month view
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
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
  }, [currentDate, calendarMode]);

  const getTasksForDay = (date: Date) => {
    return schedules.filter((task) => {
      const taskDate = new Date(task.next_due);
      return isSameDay(taskDate, date);
    });
  };

  const getTaskStatus = (task: MaintenanceTask) => {
    if (task.status === "completed") return "completed";
    const dueDate = new Date(task.next_due);
    const today = startOfDay(new Date());
    if (isBefore(dueDate, today)) return "overdue";
    if (isSameDay(dueDate, today)) return "due-today";
    return "scheduled";
  };

  const getTaskColor = (task: MaintenanceTask) => {
    const status = getTaskStatus(task);
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30";
      case "overdue":
        return "bg-destructive/20 text-destructive border-destructive/30";
      case "due-today":
        return "bg-warning/20 text-warning-foreground border-warning/30";
      default:
        return "bg-primary/20 text-primary border-primary/30";
    }
  };

  const getStatusIcon = (task: MaintenanceTask) => {
    const status = getTaskStatus(task);
    switch (status) {
      case "completed":
        return <CheckCircle className="h-3 w-3" />;
      case "overdue":
        return <AlertCircle className="h-3 w-3" />;
      case "due-today":
        return <Clock className="h-3 w-3" />;
      default:
        return <Wrench className="h-3 w-3" />;
    }
  };

  // Stats for the current month
  const monthStats = useMemo(() => {
    const monthTasks = schedules.filter((task) => {
      const taskDate = new Date(task.next_due);
      return isSameMonth(taskDate, currentDate);
    });

    const today = startOfDay(new Date());
    return {
      total: monthTasks.length,
      scheduled: monthTasks.filter((t) => t.status === "scheduled" && !isBefore(new Date(t.next_due), today)).length,
      completed: monthTasks.filter((t) => t.status === "completed").length,
      overdue: monthTasks.filter((t) => t.status !== "completed" && isBefore(new Date(t.next_due), today)).length,
      dueToday: monthTasks.filter((t) => t.status !== "completed" && isSameDay(new Date(t.next_due), today)).length,
    };
  }, [schedules, currentDate]);

  // Upcoming tasks (next 7 days)
  const upcomingTasks = useMemo(() => {
    const today = startOfDay(new Date());
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return schedules
      .filter((task) => {
        const dueDate = new Date(task.next_due);
        return task.status !== "completed" && dueDate >= today && dueDate <= nextWeek;
      })
      .sort((a, b) => new Date(a.next_due).getTime() - new Date(b.next_due).getTime())
      .slice(0, 5);
  }, [schedules]);

  const getHeaderTitle = () => {
    if (calendarMode === "day") return format(currentDate, "EEEE, MMMM d, yyyy");
    if (calendarMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    }
    return format(currentDate, "MMMM yyyy");
  };

  // Day View Component
  const DayView = () => {
    const dayTasks = getTasksForDay(currentDate);
    return (
      <div className="p-4 space-y-3 min-h-[400px]">
        {dayTasks.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No maintenance tasks scheduled for this day
          </div>
        ) : (
          dayTasks.map((task) => (
            <button
              key={task.id}
              onClick={() => onTaskClick(task)}
              className="w-full text-left p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`${getTaskColor(task)} shrink-0`}>
                      {getStatusIcon(task)}
                      <span className="ml-1 capitalize">{getTaskStatus(task).replace("-", " ")}</span>
                    </Badge>
                    <span className="text-xs text-muted-foreground capitalize">{task.frequency}</span>
                  </div>
                  <p className="font-medium truncate">{task.asset}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {task.store && (
                      <span className="flex items-center gap-1">
                        <Store className="h-3 w-3" />
                        {task.store.name}
                      </span>
                    )}
                    <span>Type: {task.task_type}</span>
                    <span>Assigned: {task.assigned_to}</span>
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    );
  };

  // Week View Component
  const WeekView = () => (
    <>
      <div className="grid grid-cols-7 border-b bg-muted/20">
        {calendarDays.map((day, idx) => (
          <div
            key={idx}
            className={`p-2 text-center border-r last:border-r-0 ${isToday(day) ? "bg-primary/5" : ""}`}
          >
            <p className="text-xs text-muted-foreground">{WEEKDAYS[idx]}</p>
            <button
              onClick={() => handleDateClick(day)}
              className={`text-sm font-medium hover:text-primary ${
                isToday(day)
                  ? "bg-primary text-primary-foreground w-7 h-7 rounded-full flex items-center justify-center mx-auto"
                  : ""
              }`}
            >
              {format(day, "d")}
            </button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 min-h-[300px]">
        {calendarDays.map((day, idx) => {
          const dayTasks = getTasksForDay(day);
          return (
            <div key={idx} className="border-r last:border-r-0 border-b p-1 min-h-[120px]">
              <div className="space-y-1 overflow-auto max-h-[200px]">
                {dayTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    className={`w-full text-left text-xs px-1.5 py-1 rounded border truncate flex flex-col gap-0.5 ${getTaskColor(task)} hover:opacity-80 transition-opacity`}
                  >
                    <span className="font-medium truncate">{task.asset}</span>
                    <span className="text-[10px] opacity-75 truncate">{task.store?.name}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  // Month View Component
  const MonthView = () => (
    <>
      <div className="grid grid-cols-7 border-b bg-muted/20">
        {WEEKDAYS.map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-[90px]">
        {calendarDays.map((day, index) => {
          const dayTasks = getTasksForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={index}
              className={`border-b border-r p-1 ${!isCurrentMonth ? "bg-muted/30" : ""} ${isCurrentDay ? "bg-primary/5" : ""}`}
            >
              <button
                onClick={() => handleDateClick(day)}
                className={`text-sm mb-1 w-full text-left hover:text-primary ${
                  isCurrentDay
                    ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center font-medium"
                    : isCurrentMonth
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {format(day, "d")}
              </button>
              <div className="space-y-0.5 overflow-auto max-h-[60px]">
                {dayTasks.slice(0, 2).map((task) => (
                  <button
                    key={task.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskClick(task);
                    }}
                    className={`w-full text-left text-xs px-1.5 py-0.5 rounded border truncate flex items-center gap-1 ${getTaskColor(task)} hover:opacity-80 transition-opacity`}
                  >
                    {getStatusIcon(task)}
                    <span className="truncate">{task.asset}</span>
                  </button>
                ))}
                {dayTasks.length > 2 && (
                  <p className="text-xs text-muted-foreground px-1">+{dayTasks.length - 2} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

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
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Scheduled</p>
            <p className="text-xl font-bold text-primary">{monthStats.scheduled}</p>
          </CardContent>
        </Card>
        <Card className="bg-warning/10 border-warning/20">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Due Today</p>
            <p className="text-xl font-bold text-warning">{monthStats.dueToday}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Completed</p>
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
          {/* Header with Mode Toggle */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={navigatePrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="font-semibold text-lg min-w-[200px] text-center">{getHeaderTitle()}</h3>
              <Button variant="outline" size="icon" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <ToggleGroup
              type="single"
              value={calendarMode}
              onValueChange={(value) => value && setCalendarMode(value as CalendarMode)}
              className="bg-muted rounded-lg p-1"
            >
              <ToggleGroupItem value="day" className="px-3 py-1 text-sm">
                Day
              </ToggleGroupItem>
              <ToggleGroupItem value="week" className="px-3 py-1 text-sm">
                Week
              </ToggleGroupItem>
              <ToggleGroupItem value="month" className="px-3 py-1 text-sm">
                Month
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Calendar Content */}
          {calendarMode === "day" && <DayView />}
          {calendarMode === "week" && <WeekView />}
          {calendarMode === "month" && <MonthView />}

          {/* Legend */}
          <div className="flex items-center gap-4 p-3 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground">Legend:</span>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-xs">
                <Wrench className="h-3 w-3 mr-1" /> Scheduled
              </Badge>
              <Badge variant="outline" className="bg-warning/20 text-warning-foreground border-warning/30 text-xs">
                <Clock className="h-3 w-3 mr-1" /> Due Today
              </Badge>
              <Badge variant="outline" className="bg-green-500/20 text-green-700 border-green-500/30 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" /> Completed
              </Badge>
              <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30 text-xs">
                <AlertCircle className="h-3 w-3 mr-1" /> Overdue
              </Badge>
            </div>
          </div>
        </div>

        {/* Upcoming Tasks Sidebar */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming Tasks
            </CardTitle>
            <p className="text-xs text-muted-foreground">Next 7 days</p>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No upcoming tasks
              </p>
            ) : (
              upcomingTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className="w-full text-left p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className={`p-1 rounded ${getTaskColor(task)}`}>
                      {getStatusIcon(task)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.asset}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(new Date(task.next_due), "MMM d")}</span>
                        {task.store && <span>• {task.store.name}</span>}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
