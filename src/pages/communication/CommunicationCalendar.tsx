import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Mail, MessageSquare, Phone, Calendar as CalendarIcon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/shared/BackButton";
import {
  expandToCalendarEvents,
  formatIst,
  type JourneySchedule,
} from "@/lib/journeySchedule";
import { CalendarDayDetails, type DayEvent } from "@/components/communication/CalendarDayDetails";

const IST_OFFSET_MIN = 330;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CHANNEL_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "voice", label: "Voice" },
];

function istParts(d: Date) {
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return {
    year: ist.getUTCFullYear(),
    month0: ist.getUTCMonth(),
    day: ist.getUTCDate(),
    hour: ist.getUTCHours(),
    minute: ist.getUTCMinutes(),
  };
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function format12hIst(d: Date) {
  const p = istParts(d);
  const period = p.hour >= 12 ? "PM" : "AM";
  const hh = ((p.hour + 11) % 12) + 1;
  return `${hh}:${pad(p.minute)} ${period}`;
}

function dayKeyIst(d: Date) {
  const p = istParts(d);
  return `${p.year}-${pad(p.month0 + 1)}-${pad(p.day)}`;
}

function deriveChannels(canvas_data: any): string[] {
  const nodes: any[] = Array.isArray(canvas_data?.nodes) ? canvas_data.nodes : [];
  const messageNodes = nodes.filter((n) => n.type === "message" || n.data?.type === "message");
  const channels = Array.from(
    new Set(
      messageNodes
        .map((n) => (n.data?.channel || n.data?.messageChannel || "").toLowerCase())
        .filter(Boolean),
    ),
  );
  return channels;
}

function deriveFirstMessagePreview(canvas_data: any): string | null {
  const nodes: any[] = Array.isArray(canvas_data?.nodes) ? canvas_data.nodes : [];
  const messageNode = nodes.find((n) => n.type === "message" || n.data?.type === "message");
  if (!messageNode) return null;
  const d = messageNode.data || {};
  return d.message || d.body || d.content || d.templateName || d.template_name || null;
}

const CHANNEL_STYLES: Record<string, { chip: string; icon: any; label: string }> = {
  whatsapp: { chip: "bg-green-100 text-green-800 hover:bg-green-200", icon: MessageSquare, label: "WhatsApp" },
  email: { chip: "bg-blue-100 text-blue-800 hover:bg-blue-200", icon: Mail, label: "Email" },
  sms: { chip: "bg-amber-100 text-amber-800 hover:bg-amber-200", icon: Phone, label: "SMS" },
  voice: { chip: "bg-purple-100 text-purple-800 hover:bg-purple-200", icon: Phone, label: "Voice" },
};

interface CalEvent {
  id: string;
  journey_id: string;
  journey_name: string;
  channel: string;
  start: Date;
  preview: string | null;
  canvas_data?: any;
}

function startOfMonthIst(year: number, month0: number): Date {
  // First moment of month in IST = (year, month0, 1, 00:00 IST) -> UTC
  return new Date(Date.UTC(year, month0, 1) - IST_OFFSET_MIN * 60_000);
}
function endOfMonthIst(year: number, month0: number): Date {
  return new Date(Date.UTC(year, month0 + 1, 1) - IST_OFFSET_MIN * 60_000 - 1);
}

export default function CommunicationCalendar() {
  const navigate = useNavigate();
  const today = new Date();
  const todayIst = istParts(today);
  const [viewYear, setViewYear] = useState(todayIst.year);
  const [viewMonth, setViewMonth] = useState(todayIst.month0); // 0-indexed
  const [channelFilter, setChannelFilter] = useState<string[]>([]);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const { data: journeys = [], isLoading } = useQuery({
    queryKey: ["communication-calendar-journeys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journeys")
        .select("id, name, status, canvas_data, schedule:journey_schedules(*)")
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  const monthStart = startOfMonthIst(viewYear, viewMonth);
  const monthEnd = endOfMonthIst(viewYear, viewMonth);

  const allEvents = useMemo<CalEvent[]>(() => {
    const now = new Date();
    const out: CalEvent[] = [];
    (journeys as any[]).forEach((j) => {
      const schedule: JourneySchedule | null = Array.isArray(j.schedule) ? j.schedule[0] : j.schedule;
      if (!schedule) return;
      const channels = deriveChannels(j.canvas_data);
      if (channels.length === 0) return;
      const preview = deriveFirstMessagePreview(j.canvas_data);
      const expanded = expandToCalendarEvents(
        { ...schedule, journey_id: j.id },
        monthStart,
        monthEnd,
        j.name,
      );
      expanded.forEach((ev, idx) => {
        if (ev.start <= now) return;
        channels.forEach((ch) => {
          out.push({
            id: `${j.id}-${idx}-${ch}-${ev.start.getTime()}`,
            journey_id: j.id,
            journey_name: j.name,
            channel: ch,
            start: ev.start,
            preview,
            canvas_data: j.canvas_data,
          });
        });
      });
    });
    return out;
  }, [journeys, monthStart.getTime(), monthEnd.getTime()]);

  const filteredEvents = useMemo(() => {
    if (channelFilter.length === 0) return allEvents;
    return allEvents.filter((e) => channelFilter.includes(e.channel));
  }, [allEvents, channelFilter]);

  // Bucket events by IST day key
  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    filteredEvents.forEach((e) => {
      const k = dayKeyIst(e.start);
      const arr = m.get(k) || [];
      arr.push(e);
      m.set(k, arr);
    });
    // sort each bucket by time
    m.forEach((arr) => arr.sort((a, b) => a.start.getTime() - b.start.getTime()));
    return m;
  }, [filteredEvents]);

  // Build 6-week grid (42 days)
  const gridDays = useMemo(() => {
    // Find Sunday on/before the 1st (in IST)
    const firstOfMonthUtc = new Date(Date.UTC(viewYear, viewMonth, 1));
    const firstDow = firstOfMonthUtc.getUTCDay(); // 0=Sun
    const cells: { year: number; month0: number; day: number; isCurrent: boolean; isToday: boolean; key: string }[] = [];
    for (let i = 0; i < 42; i++) {
      const offset = i - firstDow;
      const d = new Date(Date.UTC(viewYear, viewMonth, 1 + offset));
      const y = d.getUTCFullYear();
      const m0 = d.getUTCMonth();
      const day = d.getUTCDate();
      const key = `${y}-${pad(m0 + 1)}-${pad(day)}`;
      cells.push({
        year: y,
        month0: m0,
        day,
        isCurrent: m0 === viewMonth && y === viewYear,
        isToday: y === todayIst.year && m0 === todayIst.month0 && day === todayIst.day,
        key,
      });
    }
    return cells;
  }, [viewYear, viewMonth, todayIst.year, todayIst.month0, todayIst.day]);

  function goPrev() {
    let m = viewMonth - 1;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    setViewMonth(m); setViewYear(y);
  }
  function goNext() {
    let m = viewMonth + 1;
    let y = viewYear;
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m); setViewYear(y);
  }
  function goToday() { setViewYear(todayIst.year); setViewMonth(todayIst.month0); }

  const renderChip = (e: CalEvent, compact = true) => {
    const style = CHANNEL_STYLES[e.channel] || CHANNEL_STYLES.whatsapp;
    const Icon = style.icon;
    return (
      <TooltipProvider key={e.id} delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(ev) => { ev.stopPropagation(); navigate(`/communication/journeys/${e.journey_id}`); }}
              className={cn(
                "w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium truncate transition-colors text-left",
                style.chip,
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="shrink-0">{format12hIst(e.start)}</span>
              <span className="truncate">{e.journey_name}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <div className="font-semibold">{e.journey_name}</div>
              <div className="text-xs text-muted-foreground">
                {style.label} · {formatIst(e.start)}
              </div>
              {e.preview && (
                <div className="text-xs border-t pt-1 mt-1 line-clamp-3">{e.preview}</div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <BackButton />
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <CalendarIcon className="h-6 w-6" />
          Communication Calendar
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upcoming scheduled communications across all active journeys.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goPrev} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
            <Button variant="outline" size="icon" onClick={goNext} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <CardTitle className="ml-2 text-lg md:text-xl">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </CardTitle>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-full sm:w-64">
              <MultiSelectCombobox
                options={CHANNEL_OPTIONS}
                selected={channelFilter}
                onChange={setChannelFilter}
                placeholder="All channels"
                searchPlaceholder="Filter channels..."
                maxDisplayedBadges={2}
              />
            </div>
            <CardDescription className="whitespace-nowrap">
              Showing {filteredEvents.length} {filteredEvents.length === 1 ? "event" : "events"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {/* DOW header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DOW_LABELS.map((d) => (
              <div key={d} className="text-xs font-semibold text-muted-foreground text-center py-1">
                {d}
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 42 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {gridDays.map((cell, i) => {
                const events = eventsByDay.get(cell.key) || [];
                const visible = events.slice(0, 3);
                const hidden = events.length - visible.length;
                const isSelected = selectedDayKey === cell.key;
                const weekIndex = Math.floor(i / 7);
                const isLastInWeek = i % 7 === 6;
                const selectedWeekIndex = selectedDayKey
                  ? Math.floor(gridDays.findIndex((c) => c.key === selectedDayKey) / 7)
                  : -1;
                const shouldInjectPanel = isLastInWeek && selectedWeekIndex === weekIndex;
                const selectedCell = shouldInjectPanel ? gridDays.find((c) => c.key === selectedDayKey) : null;
                const selectedEvents: DayEvent[] = selectedCell
                  ? (eventsByDay.get(selectedCell.key) || []).map((e) => ({
                      id: e.id,
                      journey_id: e.journey_id,
                      journey_name: e.journey_name,
                      channel: e.channel,
                      start: e.start,
                      canvas_data: e.canvas_data,
                    }))
                  : [];

                return (
                  <Fragment key={cell.key}>
                    <button
                      type="button"
                      onClick={() => setSelectedDayKey((prev) => (prev === cell.key ? null : cell.key))}
                      className={cn(
                        "min-h-[96px] border rounded-md p-1.5 flex flex-col gap-1 bg-card text-left transition-colors hover:bg-accent/40",
                        !cell.isCurrent && "opacity-50 bg-muted/40",
                        cell.isToday && "ring-2 ring-primary",
                        isSelected && "ring-2 ring-primary bg-primary/5 shadow-sm",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-xs font-semibold",
                          cell.isToday ? "text-primary" : "text-foreground",
                        )}>
                          {cell.day}
                        </span>
                        {events.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">{events.length}</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        {visible.map((e) => renderChip(e))}
                        {hidden > 0 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(ev) => ev.stopPropagation()}
                                className="text-[11px] text-muted-foreground hover:text-foreground hover:underline text-left px-1.5 cursor-pointer"
                              >
                                +{hidden} more
                              </span>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-2 space-y-1" align="start" onClick={(e) => e.stopPropagation()}>
                              <div className="text-xs font-semibold mb-1 px-1">
                                {cell.day} {MONTH_NAMES[cell.month0]} {cell.year}
                              </div>
                              {events.map((e) => renderChip(e))}
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </button>
                    {shouldInjectPanel && selectedCell && (
                      <div key={`panel-${selectedCell.key}`} className="col-span-7 mt-1 mb-2">
                        <div className="mb-2 px-1 text-sm font-semibold text-foreground">
                          {selectedCell.day} {MONTH_NAMES[selectedCell.month0]} {selectedCell.year}
                        </div>
                        <CalendarDayDetails dayKey={selectedCell.key} events={selectedEvents} />
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}

          {!isLoading && filteredEvents.length === 0 && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              No scheduled communications this month.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
