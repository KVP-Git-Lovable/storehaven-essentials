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
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
};

// Hours for time sidebar (00:00 - 23:00)
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Convert time string (HH:MM:SS) to minutes from midnight
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + (minutes || 0);
};

// Calculate task position and height based on time
const getTaskPosition = (startTime: string, endTime?: string | null) => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = endTime ? timeToMinutes(endTime) : startMinutes + 60;
  const top = (startMinutes / (24 * 60)) * 100;
  const height = Math.max(((endMinutes - startMinutes) / (24 * 60)) * 100, 2);
  return { top: `${top}%`, height: `${height}%` };
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

  // Day View Component with 24-hour time sidebar
  const DayView = () => {
    const dayTasks = getTasksForDay(currentDate);

    return (
      <div className="flex flex-col">
        {/* Time Grid */}
        <div className="flex overflow-auto max-h-[600px]">
          {/* Time Sidebar */}
          <div className="w-16 flex-shrink-0 border-r bg-muted/10">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[50px] border-b flex items-start justify-end pr-2 pt-1"
              >
                <span className="text-xs text-muted-foreground">
                  {hour.toString().padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day Column */}
          <div className="flex-1 relative" style={{ height: `${24 * 50}px` }}>
            {/* Hour lines */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute w-full border-b border-dashed border-muted"
                style={{ top: `${(hour / 24) * 100}%` }}
              />
            ))}

            {/* Tasks */}
            {dayTasks.map((task) => {
              const position = task.scheduled_start_time 
                ? getTaskPosition(task.scheduled_start_time, task.scheduled_end_time)
                : { top: "2%", height: "4%" };
              return (
                <button
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className={`absolute left-1 right-1 rounded border px-2 py-1 text-left overflow-hidden ${getTaskColor(task)} hover:opacity-80 transition-opacity`}
                  style={{ top: position.top, height: position.height, minHeight: "24px" }}
                >
                  <div className="flex items-center gap-1.5">
                    {getStatusIcon(task)}
                    <span className="text-xs font-medium truncate">{task.asset}</span>
                  </div>
                  <div className="text-[10px] opacity-75 truncate">
                    {task.scheduled_start_time?.slice(0, 5)}
                    {task.scheduled_end_time && ` - ${task.scheduled_end_time.slice(0, 5)}`}
                    {task.store && ` • ${task.store.name}`}
                  </div>
                </button>
              );
            })}

            {/* Empty state */}
            {dayTasks.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                No maintenance tasks scheduled for this day
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Week View Component with 24-hour time sidebar
  const WeekView = () => {
    return (
      <div className="flex flex-col">
        {/* Fixed Header Row */}
        <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b bg-muted/20">
          <div className="border-r" />
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

        {/* Scrollable Time Grid */}
        <div className="overflow-auto max-h-[500px]">
          <div className="grid grid-cols-[64px_repeat(7,1fr)]" style={{ height: `${24 * 50}px` }}>
            {/* Time Sidebar */}
            <div className="border-r bg-muted/10">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="h-[50px] border-b flex items-start justify-end pr-2 pt-1"
                >
                  <span className="text-xs text-muted-foreground">
                    {hour.toString().padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Day Columns */}
            {calendarDays.map((day, idx) => {
              const dayTasks = getTasksForDay(day);
              return (
                <div
                  key={idx}
                  className={`relative border-r last:border-r-0 ${isToday(day) ? "bg-primary/5" : ""}`}
                >
                  {/* Hour lines */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute w-full border-b border-dashed border-muted"
                      style={{ top: `${(hour / 24) * 100}%` }}
                    />
                  ))}

                  {/* Tasks */}
                  {dayTasks.map((task) => {
                    const position = task.scheduled_start_time
                      ? getTaskPosition(task.scheduled_start_time, task.scheduled_end_time)
                      : { top: "2%", height: "4%" };
                    return (
                      <button
                        key={task.id}
                        onClick={() => onTaskClick(task)}
                        className={`absolute left-0.5 right-0.5 rounded border px-1 py-0.5 text-left overflow-hidden ${getTaskColor(task)} hover:opacity-80 transition-opacity`}
                        style={{ top: position.top, height: position.height, minHeight: "20px" }}
                      >
                        <div className="flex items-center gap-1">
                          {getStatusIcon(task)}
                          <span className="text-[10px] font-medium truncate">{task.asset}</span>
                        </div>
                        <div className="text-[9px] opacity-75 truncate">
                          {task.scheduled_start_time?.slice(0, 5)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 md:p-4 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigatePrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="font-semibold text-sm md:text-lg min-w-0 text-center">{getHeaderTitle()}</h3>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <ToggleGroup
              type="single"
              value={calendarMode}
              onValueChange={(value) => value && setCalendarMode(value as CalendarMode)}
              className="bg-muted rounded-lg p-1"
            >
              <ToggleGroupItem value="day" className="px-2 md:px-3 py-1 text-xs md:text-sm">
                Day
              </ToggleGroupItem>
              <ToggleGroupItem value="week" className="px-2 md:px-3 py-1 text-xs md:text-sm">
                Week
              </ToggleGroupItem>
              <ToggleGroupItem value="month" className="px-2 md:px-3 py-1 text-xs md:text-sm">
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
