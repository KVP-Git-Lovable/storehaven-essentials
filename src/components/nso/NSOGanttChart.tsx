import { useState, useRef, useCallback, useMemo } from "react";
import { format, differenceInDays, addDays, parseISO, startOfDay, min, max } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Clock, AlertCircle, GripVertical } from "lucide-react";

interface StoreSection {
  id: string;
  checklist_id: string;
  name: string;
  sort_order: number;
  is_custom: boolean;
}

interface StoreTask {
  id: string;
  section_id: string;
  checklist_id: string;
  name: string;
  description: string | null;
  owner: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  sort_order: number;
  is_custom: boolean;
}

interface NSOGanttChartProps {
  sections: StoreSection[];
  tasks: StoreTask[];
  onTaskUpdate: (taskId: string, startDate: string, endDate: string) => void;
  onTaskClick: (task: StoreTask) => void;
}

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  pending: { color: "bg-muted", icon: Clock },
  in_progress: { color: "bg-blue-500", icon: AlertCircle },
  completed: { color: "bg-green-500", icon: CheckCircle2 },
  blocked: { color: "bg-destructive", icon: AlertCircle },
};

const DAY_WIDTH = 32;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 60;
const LEFT_PANEL_WIDTH = 280;

export function NSOGanttChart({ sections, tasks, onTaskUpdate, onTaskClick }: NSOGanttChartProps) {
  const [dragging, setDragging] = useState<{
    taskId: string;
    type: "move" | "resize-start" | "resize-end";
    initialX: number;
    initialStartDate: Date;
    initialEndDate: Date;
  } | null>(null);
  
  const [tempDates, setTempDates] = useState<{
    taskId: string;
    startDate: Date;
    endDate: Date;
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Calculate date range from all tasks
  const { startDate: chartStartDate, endDate: chartEndDate, totalDays } = useMemo(() => {
    const tasksWithDates = tasks.filter((t) => t.start_date && t.end_date);
    if (tasksWithDates.length === 0) {
      const today = startOfDay(new Date());
      return { startDate: today, endDate: addDays(today, 30), totalDays: 31 };
    }

    const allStartDates = tasksWithDates.map((t) => parseISO(t.start_date!));
    const allEndDates = tasksWithDates.map((t) => parseISO(t.end_date!));
    
    const minDate = addDays(min(allStartDates), -3);
    const maxDate = addDays(max(allEndDates), 7);
    const days = differenceInDays(maxDate, minDate) + 1;

    return { startDate: minDate, endDate: maxDate, totalDays: Math.max(days, 31) };
  }, [tasks]);

  // Generate date headers
  const dateHeaders = useMemo(() => {
    const headers: { date: Date; isWeekend: boolean; isToday: boolean }[] = [];
    const today = startOfDay(new Date());
    
    for (let i = 0; i < totalDays; i++) {
      const date = addDays(chartStartDate, i);
      const dayOfWeek = date.getDay();
      headers.push({
        date,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isToday: differenceInDays(date, today) === 0,
      });
    }
    return headers;
  }, [chartStartDate, totalDays]);

  // Get task bar position and width
  const getTaskPosition = useCallback((task: StoreTask) => {
    if (!task.start_date || !task.end_date) return null;
    
    const taskStart = tempDates?.taskId === task.id ? tempDates.startDate : parseISO(task.start_date);
    const taskEnd = tempDates?.taskId === task.id ? tempDates.endDate : parseISO(task.end_date);
    
    const left = differenceInDays(taskStart, chartStartDate) * DAY_WIDTH;
    const width = (differenceInDays(taskEnd, taskStart) + 1) * DAY_WIDTH;
    
    return { left, width };
  }, [chartStartDate, tempDates]);

  // Mouse handlers for drag and drop
  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    task: StoreTask,
    type: "move" | "resize-start" | "resize-end"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!task.start_date || !task.end_date) return;
    
    setDragging({
      taskId: task.id,
      type,
      initialX: e.clientX,
      initialStartDate: parseISO(task.start_date),
      initialEndDate: parseISO(task.end_date),
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    
    const deltaX = e.clientX - dragging.initialX;
    const daysDelta = Math.round(deltaX / DAY_WIDTH);
    
    let newStartDate = dragging.initialStartDate;
    let newEndDate = dragging.initialEndDate;
    
    if (dragging.type === "move") {
      newStartDate = addDays(dragging.initialStartDate, daysDelta);
      newEndDate = addDays(dragging.initialEndDate, daysDelta);
    } else if (dragging.type === "resize-start") {
      newStartDate = addDays(dragging.initialStartDate, daysDelta);
      if (differenceInDays(newEndDate, newStartDate) < 0) {
        newStartDate = newEndDate;
      }
    } else if (dragging.type === "resize-end") {
      newEndDate = addDays(dragging.initialEndDate, daysDelta);
      if (differenceInDays(newEndDate, newStartDate) < 0) {
        newEndDate = newStartDate;
      }
    }
    
    setTempDates({
      taskId: dragging.taskId,
      startDate: newStartDate,
      endDate: newEndDate,
    });
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    if (dragging && tempDates) {
      onTaskUpdate(
        tempDates.taskId,
        format(tempDates.startDate, "yyyy-MM-dd"),
        format(tempDates.endDate, "yyyy-MM-dd")
      );
    }
    setDragging(null);
    setTempDates(null);
  }, [dragging, tempDates, onTaskUpdate]);

  // Build row data with sections and tasks
  const rows = useMemo(() => {
    const result: { type: "section" | "task"; data: StoreSection | StoreTask }[] = [];
    
    sections.forEach((section) => {
      result.push({ type: "section", data: section });
      const sectionTasks = tasks.filter((t) => t.section_id === section.id);
      sectionTasks.forEach((task) => {
        result.push({ type: "task", data: task });
      });
    });
    
    return result;
  }, [sections, tasks]);

  const chartWidth = totalDays * DAY_WIDTH;
  const chartHeight = rows.length * ROW_HEIGHT;

  return (
    <TooltipProvider>
      <div 
        className="border rounded-lg bg-card overflow-hidden select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Header row */}
        <div className="flex border-b">
          {/* Left panel header */}
          <div 
            className="flex-shrink-0 border-r bg-muted/50 px-4 flex items-center font-medium"
            style={{ width: LEFT_PANEL_WIDTH, height: HEADER_HEIGHT }}
          >
            Task / Section
          </div>
          
          {/* Date headers */}
          <div 
            ref={scrollContainerRef}
            className="overflow-x-auto flex-1"
            style={{ height: HEADER_HEIGHT }}
          >
            <div 
              className="flex h-full"
              style={{ width: chartWidth }}
            >
              {dateHeaders.map((header, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex-shrink-0 flex flex-col items-center justify-center text-xs border-r",
                    header.isWeekend && "bg-muted/30",
                    header.isToday && "bg-primary/10"
                  )}
                  style={{ width: DAY_WIDTH }}
                >
                  <span className="font-medium">{format(header.date, "d")}</span>
                  <span className="text-muted-foreground">{format(header.date, "EEE")}</span>
                  {(index === 0 || header.date.getDate() === 1) && (
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {format(header.date, "MMM")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex">
          {/* Left panel - task names */}
          <div 
            className="flex-shrink-0 border-r bg-card overflow-y-auto"
            style={{ width: LEFT_PANEL_WIDTH, maxHeight: 500 }}
          >
            {rows.map((row, index) => {
              if (row.type === "section") {
                const section = row.data as StoreSection;
                return (
                  <div
                    key={`section-${section.id}`}
                    className="px-4 flex items-center bg-muted/50 font-medium border-b"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <span className="truncate">{section.name}</span>
                    {section.is_custom && (
                      <Badge variant="secondary" className="ml-2 text-[10px] h-4">
                        Custom
                      </Badge>
                    )}
                  </div>
                );
              } else {
                const task = row.data as StoreTask;
                const StatusIcon = statusConfig[task.status]?.icon || Clock;
                return (
                  <div
                    key={`task-${task.id}`}
                    className="px-4 flex items-center gap-2 border-b hover:bg-accent/50 cursor-pointer"
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => onTaskClick(task)}
                  >
                    <StatusIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate text-sm">{task.name}</span>
                  </div>
                );
              }
            })}
          </div>

          {/* Right panel - Gantt bars */}
          <div 
            className="overflow-auto flex-1"
            style={{ maxHeight: 500 }}
            onScroll={(e) => {
              // Sync scroll with header
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
              }
            }}
          >
            <div style={{ width: chartWidth, height: chartHeight }}>
              {/* Grid background */}
              <div className="absolute" style={{ width: chartWidth, height: chartHeight }}>
                {dateHeaders.map((header, index) => (
                  <div
                    key={index}
                    className={cn(
                      "absolute top-0 bottom-0 border-r",
                      header.isWeekend && "bg-muted/20",
                      header.isToday && "bg-primary/5"
                    )}
                    style={{ left: index * DAY_WIDTH, width: DAY_WIDTH, height: chartHeight }}
                  />
                ))}
              </div>

              {/* Task bars */}
              <div className="relative" style={{ width: chartWidth, height: chartHeight }}>
                {rows.map((row, rowIndex) => {
                  if (row.type === "section") {
                    return (
                      <div
                        key={`section-bar-${row.data.id}`}
                        className="absolute w-full bg-muted/30 border-b"
                        style={{ top: rowIndex * ROW_HEIGHT, height: ROW_HEIGHT }}
                      />
                    );
                  }
                  
                  const task = row.data as StoreTask;
                  const position = getTaskPosition(task);
                  
                  if (!position) {
                    return (
                      <div
                        key={`task-bar-${task.id}`}
                        className="absolute w-full border-b"
                        style={{ top: rowIndex * ROW_HEIGHT, height: ROW_HEIGHT }}
                      />
                    );
                  }
                  
                  const isDragging = dragging?.taskId === task.id;
                  const statusColor = statusConfig[task.status]?.color || "bg-muted";
                  
                  return (
                    <div
                      key={`task-bar-${task.id}`}
                      className="absolute w-full border-b"
                      style={{ top: rowIndex * ROW_HEIGHT, height: ROW_HEIGHT }}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "absolute top-1.5 rounded-md flex items-center cursor-move transition-shadow group",
                              statusColor,
                              isDragging && "shadow-lg ring-2 ring-primary z-10",
                              task.status === "pending" && "text-muted-foreground",
                              task.status !== "pending" && "text-white"
                            )}
                            style={{
                              left: position.left + 2,
                              width: position.width - 4,
                              height: ROW_HEIGHT - 12,
                            }}
                            onMouseDown={(e) => handleMouseDown(e, task, "move")}
                          >
                            {/* Resize handle - start */}
                            <div
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 rounded-l-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              onMouseDown={(e) => handleMouseDown(e, task, "resize-start")}
                            >
                              <GripVertical className="h-3 w-3" />
                            </div>
                            
                            {/* Task content */}
                            <div className="flex-1 px-2 truncate text-xs font-medium">
                              {position.width > 60 && task.name}
                            </div>
                            
                            {/* Resize handle - end */}
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 rounded-r-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              onMouseDown={(e) => handleMouseDown(e, task, "resize-end")}
                            >
                              <GripVertical className="h-3 w-3" />
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-medium">{task.name}</p>
                            {task.owner && (
                              <p className="text-xs text-muted-foreground">Owner: {task.owner}</p>
                            )}
                            <p className="text-xs">
                              {task.start_date && format(parseISO(task.start_date), "MMM d")} - {" "}
                              {task.end_date && format(parseISO(task.end_date), "MMM d, yyyy")}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              {task.status.replace("_", " ")}
                            </Badge>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })}
                
                {/* Today line */}
                {dateHeaders.findIndex((h) => h.isToday) !== -1 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-destructive z-20"
                    style={{ 
                      left: dateHeaders.findIndex((h) => h.isToday) * DAY_WIDTH + DAY_WIDTH / 2,
                      height: chartHeight
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
