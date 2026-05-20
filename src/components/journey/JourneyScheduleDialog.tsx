import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  type JourneySchedule,
  type ScheduleFrequency,
  type ScheduleType,
  type RelativeRule,
  type RelativeUnit,
  type RetriggerMode,
  computeNextRun,
  formatIst,
  summarizeSchedule,
  WEEKDAY_SHORT,
} from "@/lib/journeySchedule";
import { ENTITY_LIST, ENTITY_SCHEMAS, type EntityKey } from "@/lib/listViewSchema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journeyId: string;
  journeyName?: string;
  existing?: JourneySchedule | null;
}

const DEFAULT_TIME = "09:00";

export function JourneyScheduleDialog({ open, onOpenChange, journeyId, journeyName, existing }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [type, setType] = useState<ScheduleType>("one_time");
  const [frequency, setFrequency] = useState<ScheduleFrequency>("daily");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState<string>(DEFAULT_TIME);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [monthOfQuarter, setMonthOfQuarter] = useState<number>(1);
  // Relative
  const [relEntity, setRelEntity] = useState<EntityKey | "">("");
  const [relField, setRelField] = useState<string>("");
  const [relRule, setRelRule] = useState<RelativeRule>("after");
  const [relOffset, setRelOffset] = useState<number>(0);
  const [relUnit, setRelUnit] = useState<RelativeUnit>("days");
  const [retrigger, setRetrigger] = useState<RetriggerMode>("once");

  // Hydrate from existing
  useEffect(() => {
    if (!open) return;
    if (existing) {
      setType(existing.type);
      setFrequency((existing.frequency as ScheduleFrequency) || "daily");
      setDate(existing.execution_date ? new Date(existing.execution_date + "T00:00:00") : undefined);
      setTime((existing.execution_time || DEFAULT_TIME).slice(0, 5));
      setDaysOfWeek(existing.days_of_week || []);
      setDayOfMonth(existing.day_of_month || 1);
      setMonthOfQuarter(existing.month_of_quarter || 1);
      setRelEntity(((existing.relative_entity as EntityKey) || "") as EntityKey | "");
      setRelField(existing.relative_field || "");
      setRelRule((existing.relative_rule as RelativeRule) || "after");
      setRelOffset(existing.relative_offset ?? 0);
      setRelUnit((existing.relative_unit as RelativeUnit) || "days");
      setRetrigger((existing.retrigger_mode as RetriggerMode) || "once");
    } else {
      setType("one_time");
      setFrequency("daily");
      setDate(undefined);
      setTime(DEFAULT_TIME);
      setDaysOfWeek([]);
      setDayOfMonth(1);
      setMonthOfQuarter(1);
      setRelEntity("");
      setRelField("");
      setRelRule("after");
      setRelOffset(0);
      setRelUnit("days");
      setRetrigger("once");
    }
  }, [open, existing]);

  const draft: JourneySchedule = useMemo(() => ({
    journey_id: journeyId,
    type,
    frequency: type === "recurring" ? frequency : null,
    execution_date: type === "one_time" && date ? format(date, "yyyy-MM-dd") : null,
    execution_time: time || null,
    days_of_week: type === "recurring" && frequency === "weekly" ? daysOfWeek : null,
    day_of_month: type === "recurring" && (frequency === "monthly" || frequency === "quarterly") ? dayOfMonth : null,
    month_of_quarter: type === "recurring" && frequency === "quarterly" ? monthOfQuarter : null,
    relative_entity: type === "relative" ? (relEntity || null) : null,
    relative_field: type === "relative" ? (relField || null) : null,
    relative_rule: type === "relative" ? relRule : null,
    relative_offset: type === "relative" && relRule !== "on" ? relOffset : null,
    relative_unit: type === "relative" && relRule !== "on" ? relUnit : null,
    retrigger_mode: type === "relative" ? retrigger : null,
  }), [journeyId, type, frequency, date, time, daysOfWeek, dayOfMonth, monthOfQuarter, relEntity, relField, relRule, relOffset, relUnit, retrigger]);

  const summary = summarizeSchedule(draft);
  const nextRun = computeNextRun(draft);

  const validate = (): string | null => {
    if (!time) return "Time is required";
    if (type === "one_time" && !date) return "Pick a date";
    if (type === "recurring" && frequency === "weekly" && daysOfWeek.length === 0) return "Select at least one day of week";
    if (type === "recurring" && (frequency === "monthly" || frequency === "quarterly") && (dayOfMonth < 1 || dayOfMonth > 31)) {
      return "Day of month must be between 1 and 31";
    }
    if (type === "relative") {
      if (!relEntity) return "Select a base entity";
      if (!relField) return "Select a date field";
      if (relRule !== "on" && (relOffset < 0 || !Number.isFinite(relOffset))) return "Offset must be a non-negative number";
    }
    return null;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const err = validate();
      if (err) throw new Error(err);
      const payload = {
        ...draft,
        timezone: "Asia/Kolkata",
        // Relative schedules need a non-null next_run_at so the sweep picks them up;
        // process-journeys re-arms it to now()+1h on every sweep.
        next_run_at: type === "relative"
          ? new Date().toISOString()
          : (nextRun ? nextRun.toISOString() : null),
        created_by: user?.id || null,
      };
      const { error } = await (supabase as any)
        .from("journey_schedules")
        .upsert(payload, { onConflict: "journey_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Schedule saved");
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to save schedule"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("journey_schedules")
        .delete()
        .eq("journey_id", journeyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Schedule removed");
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to remove schedule"),
  });

  const toggleDay = (d: number) => {
    setDaysOfWeek((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Schedule Journey{journeyName ? ` — ${journeyName}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-1">
          {/* Type segmented control */}
          <div>
            <Label>Type</Label>
            <div className="mt-1 inline-flex flex-wrap rounded-md border border-input p-1">
              <button
                type="button"
                onClick={() => setType("one_time")}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-sm transition-colors",
                  type === "one_time" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                One-time
              </button>
              <button
                type="button"
                onClick={() => setType("recurring")}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-sm transition-colors",
                  type === "recurring" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                Recurring
              </button>
              <button
                type="button"
                onClick={() => setType("relative")}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-sm transition-colors",
                  type === "relative" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                Relative Date
              </button>
            </div>
          </div>

          {type === "one_time" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Time (IST)</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
          )}

          {type === "recurring" && (
            <div className="space-y-3">
              <div>
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as ScheduleFrequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {frequency === "weekly" && (
                <div>
                  <Label>Days of week</Label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {WEEKDAY_SHORT.map((label, idx) => {
                      const active = daysOfWeek.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleDay(idx)}
                          className={cn(
                            "px-3 py-1.5 text-sm rounded-md border transition-colors",
                            active ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(frequency === "monthly" || frequency === "quarterly") && (
                <div className="grid grid-cols-2 gap-3">
                  {frequency === "quarterly" && (
                    <div>
                      <Label>Month within quarter</Label>
                      <Select value={String(monthOfQuarter)} onValueChange={(v) => setMonthOfQuarter(parseInt(v, 10))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1st month (Jan / Apr / Jul / Oct)</SelectItem>
                          <SelectItem value="2">2nd month (Feb / May / Aug / Nov)</SelectItem>
                          <SelectItem value="3">3rd month (Mar / Jun / Sep / Dec)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label>Day of month</Label>
                    <Select value={String(dayOfMonth)} onValueChange={(v) => setDayOfMonth(parseInt(v, 10))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">If the month has fewer days, it runs on the last day.</p>
                  </div>
                </div>
              )}

              <div>
                <Label>Time (IST)</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
          )}

          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{summary || "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Next run: {formatIst(nextRun)}</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {existing && (
            <Button
              variant="ghost"
              className="text-destructive mr-auto"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              Delete schedule
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
