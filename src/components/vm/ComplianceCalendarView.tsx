import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Camera, Clock, AlertCircle, CheckCircle, Store } from "lucide-react";
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
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
  planogram: { id: string; title: string; zone: string } | null;
  store: { id: string; name: string } | null;
  assigned_user: { id: string; username: string } | null;
};

type CalendarMode = "day" | "week" | "month";

type ComplianceCalendarViewProps = {
  tasks: ComplianceTask[];
  onTaskClick: (task: ComplianceTask) => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const formatScheduledTime = (startTime?: string | null, endTime?: string | null) => {
  if (!startTime) return "Anytime";
  const start = startTime.substring(0, 5); // HH:MM
  if (!endTime) return start;
  const end = endTime.substring(0, 5);
  return `${start} - ${end}`;
};

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const getTaskPosition = (startTime: string, endTime?: string | null) => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = endTime ? timeToMinutes(endTime) : startMinutes + 60;
  const top = (startMinutes / (24 * 60)) * 100;
  const height = Math.max(((endMinutes - startMinutes) / (24 * 60)) * 100, 2);
  return { top: `${top}%`, height: `${height}%` };
};

export function ComplianceCalendarView({
  tasks,
  onTaskClick,
}: ComplianceCalendarViewProps) {
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
    return tasks.filter((task) => {
      const taskDate = new Date(task.due_date);
      return isSameDay(taskDate, date);
    }).sort((a, b) => {
      // Sort by scheduled time
      if (a.scheduled_start_time && b.scheduled_start_time) {
        return a.scheduled_start_time.localeCompare(b.scheduled_start_time);
      }
      if (a.scheduled_start_time) return -1;
      if (b.scheduled_start_time) return 1;
      return 0;
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
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  // Stats for the current month
  const monthStats = useMemo(() => {
    const monthTasks = tasks.filter((task) => {
      const taskDate = new Date(task.due_date);
      return isSameMonth(taskDate, currentDate);
    });

    return {
      total: monthTasks.length,
      pending: monthTasks.filter((t) => t.status === "pending").length,
      submitted: monthTasks.filter((t) => t.status === "submitted").length,
      completed: monthTasks.filter((t) => t.status === "approved").length,
      overdue: monthTasks.filter((t) => {
        const dueDate = new Date(t.due_date);
        return t.status === "pending" && isBefore(dueDate, startOfDay(new Date()));
      }).length,
    };
  }, [tasks, currentDate]);

  // Upcoming reminders (next 7 days)
  const upcomingReminders = useMemo(() => {
    const today = startOfDay(new Date());
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return tasks
      .filter((task) => {
        const dueDate = new Date(task.due_date);
        return task.status === "pending" && dueDate >= today && dueDate <= nextWeek;
      })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 5);
  }, [tasks]);

  const getHeaderTitle = () => {
    if (calendarMode === "day") return format(currentDate, "EEEE, MMMM d, yyyy");
    if (calendarMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    }
    return format(currentDate, "MMMM yyyy");
  };

  // Day View Component with Time Sidebar
  const DayView = () => {
    const dayTasks = getTasksForDay(currentDate);
    // All tasks render in time grid - tasks without time default to 09:00
    const allTasks = dayTasks.map((t) => ({
      ...t,
      scheduled_start_time: t.scheduled_start_time || "09:00:00",
    }));

    return (
      <div className="flex flex-col">
        {/* Time Grid */}
        <div className="flex overflow-auto" style={{ height: "600px" }}>
          {/* Time Sidebar */}
          <div className="w-16 shrink-0 border-r bg-muted/10">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[50px] border-b text-xs text-muted-foreground flex items-start justify-end pr-2 pt-1"
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Task Column */}
          <div className="flex-1 relative">
            {/* Hour Grid Lines */}
            {HOURS.map((hour) => (
              <div key={hour} className="h-[50px] border-b border-dashed border-muted/50" />
            ))}

            {/* Positioned Tasks */}
            {allTasks.map((task) => {
              const pos = getTaskPosition(task.scheduled_start_time!, task.scheduled_end_time);
              return (
                <button
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className={`absolute left-1 right-1 px-2 py-1 rounded border text-left overflow-hidden ${getTaskColor(task)} hover:opacity-80 transition-opacity z-10`}
                  style={{ top: pos.top, height: pos.height, minHeight: "24px" }}
                >
                  <div className="flex items-center gap-1 text-xs">
                    {getStatusIcon(task)}
                    <span className="font-medium truncate">{task.store?.name || task.title}</span>
                  </div>
                  <p className="text-[10px] opacity-75 truncate">
                    {formatScheduledTime(task.scheduled_start_time, task.scheduled_end_time)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {dayTasks.length === 0 && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No tasks scheduled for this day
          </div>
        )}
      </div>
    );
  };

  // Week View Component with Time Sidebar
  const WeekView = () => {
    return (
      <>
        {/* Day Headers */}
        <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b bg-muted/20">
          <div className="p-2 border-r" /> {/* Empty corner */}
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

        {/* Time Grid */}
        <div className="grid grid-cols-[64px_repeat(7,1fr)] overflow-auto" style={{ height: "500px" }}>
          {/* Time Sidebar */}
          <div className="border-r bg-muted/10">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[42px] border-b text-xs text-muted-foreground flex items-start justify-end pr-2 pt-1"
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {calendarDays.map((day, idx) => {
            // All tasks render in grid - tasks without time default to 09:00
            const dayTasks = getTasksForDay(day);
            const allTasks = dayTasks.map((t) => ({
              ...t,
              scheduled_start_time: t.scheduled_start_time || "09:00:00",
            }));
            return (
              <div key={idx} className="border-r last:border-r-0 relative">
                {/* Hour Grid Lines */}
                {HOURS.map((hour) => (
                  <div key={hour} className="h-[42px] border-b border-dashed border-muted/30" />
                ))}

                {/* Positioned Tasks */}
                {allTasks.map((task) => {
                  const pos = getTaskPosition(task.scheduled_start_time!, task.scheduled_end_time);
                  return (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={`absolute left-0.5 right-0.5 px-1 py-0.5 rounded border text-left overflow-hidden ${getTaskColor(task)} hover:opacity-80 transition-opacity z-10`}
                      style={{ top: pos.top, height: pos.height, minHeight: "20px" }}
                    >
                      <p className="text-[10px] font-medium truncate">{task.store?.name || task.title}</p>
                      <p className="text-[9px] opacity-75 truncate">
                        {task.scheduled_start_time?.substring(0, 5)}
                      </p>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  // Month View Component - Simplified grid with tasks inside cells
  const MonthView = () => {
    return (
      <div className="flex flex-col">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b bg-muted/20">
          {WEEKDAYS.map((day) => (
            <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Date Cells Grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const dayTasks = getTasksForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={index}
                className={`min-h-[100px] border-r border-b last:border-r-0 p-1 ${!isCurrentMonth ? "bg-muted/30" : ""} ${isCurrentDay ? "bg-primary/5" : ""}`}
              >
                {/* Date Header */}
                <button
                  onClick={() => handleDateClick(day)}
                  className={`mb-1 text-xs hover:text-primary ${
                    isCurrentDay
                      ? "bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center font-medium"
                      : isCurrentMonth
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                  }`}
                >
                  {format(day, "d")}
                </button>

                {/* Tasks inside the cell */}
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <button
                      key={task.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick(task);
                      }}
                      title={`${task.store?.name || task.title} • ${formatScheduledTime(task.scheduled_start_time, task.scheduled_end_time)}`}
                      className={`w-full text-left text-[9px] px-1 py-0.5 rounded border ${getTaskColor(task)} hover:opacity-80 transition-opacity truncate`}
                    >
                      <div className="flex items-center gap-0.5">
                        {getStatusIcon(task)}
                        <span className="truncate">{task.store?.name || task.title}</span>
                      </div>
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <button
                      onClick={() => handleDateClick(day)}
                      className="text-[9px] text-muted-foreground hover:text-primary"
                    >
                      +{dayTasks.length - 3} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
                          <p className="text-xs text-muted-foreground truncate">{task.store?.name}</p>
                        </div>
                        {isDueToday && (
                          <Badge variant="secondary" className="bg-warning/20 text-warning-foreground text-xs shrink-0">
                            Today
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {format(dueDate, "EEE, MMM d")} • {formatScheduledTime(task.scheduled_start_time, task.scheduled_end_time)}
                        </span>
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
