import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, addDays } from "date-fns";
import { Copy, User } from "lucide-react";

interface WeeklyRosterViewProps {
  storeId: string;
  rosterDate: string;
  onCopyWeek: () => void;
  isCopying: boolean;
}

const SHIFT_TYPES = ["morning", "afternoon", "evening", "night"];
const SHIFT_COLORS: Record<string, string> = {
  morning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  afternoon: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  evening: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  night: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
};

export function WeeklyRosterView({ storeId, rosterDate, onCopyWeek, isCopying }: WeeklyRosterViewProps) {
  const weekStart = startOfWeek(new Date(rosterDate), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data: weekRoster, isLoading } = useQuery({
    queryKey: ["weekly-roster", storeId, weekStartStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_rosters")
        .select("*, employees(id, name, department, position)")
        .eq("store_id", storeId)
        .gte("roster_date", weekStartStr)
        .lte("roster_date", weekEndStr)
        .order("shift_type");
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const getRosterForDay = (date: Date, shift: string) =>
    weekRoster?.filter(
      (r) => r.roster_date === format(date, "yyyy-MM-dd") && r.shift_type === shift
    ) || [];

  const isToday = (date: Date) => format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const isSelected = (date: Date) => format(date, "yyyy-MM-dd") === rosterDate;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">
          Week of {format(weekStart, "dd MMM")} — {format(addDays(weekStart, 6), "dd MMM yyyy")}
        </h4>
        <Button variant="outline" size="sm" onClick={onCopyWeek} disabled={isCopying}>
          <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Previous Week
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading week roster...</div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <div className="min-w-[600px] px-2">
            {/* Header row */}
            <div className="grid grid-cols-8 gap-1 mb-2">
              <div className="text-xs font-medium text-muted-foreground py-1">Shift</div>
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`text-center text-xs py-1 rounded ${
                    isSelected(day)
                      ? "bg-primary text-primary-foreground font-bold"
                      : isToday(day)
                      ? "bg-primary/10 font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  <div>{format(day, "EEE")}</div>
                  <div>{format(day, "dd")}</div>
                </div>
              ))}
            </div>

            {/* Shift rows */}
            {SHIFT_TYPES.map((shift) => (
              <div key={shift} className="grid grid-cols-8 gap-1 mb-1">
                <div className="flex items-center">
                  <Badge variant="outline" className={`text-[10px] capitalize ${SHIFT_COLORS[shift]}`}>
                    {shift}
                  </Badge>
                </div>
                {weekDays.map((day) => {
                  const entries = getRosterForDay(day, shift);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`border rounded p-1 min-h-[40px] text-[10px] ${
                        isSelected(day) ? "border-primary/40" : "border-border/50"
                      }`}
                    >
                      {entries.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-0.5">
                          {entries.map((e: any) => (
                            <div key={e.id} className="flex items-center gap-0.5 truncate">
                              <User className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                              <span className="truncate">{(e.employees as any)?.name?.split(" ")[0]}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
