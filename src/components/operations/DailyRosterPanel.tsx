import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, subDays, addDays, startOfWeek, endOfWeek } from "date-fns";
import { Plus, Copy, Users, Calendar, Brain, AlertCircle, Loader2 } from "lucide-react";
import { RosterEmployeeCard } from "./RosterEmployeeCard";
import { RosterShiftDropZone } from "./RosterShiftDropZone";
import { WeeklyRosterView } from "./WeeklyRosterView";
import { LeaveEmployeesList } from "./LeaveEmployeesList";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

interface DailyRosterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  rosterDate: string;
}

const SHIFT_TYPES = ["morning", "afternoon", "evening", "night"] as const;

export function DailyRosterPanel({ open, onOpenChange, storeId, rosterDate }: DailyRosterPanelProps) {
  const queryClient = useQueryClient();
  const [addingShift, setAddingShift] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [activeTab, setActiveTab] = useState("daily");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [rebalanceSuggestions, setRebalanceSuggestions] = useState<any[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data: roster } = useQuery({
    queryKey: ["daily-roster", storeId, rosterDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_rosters")
        .select("*, employees(id, name, department, position), role_master(id, name)")
        .eq("store_id", storeId)
        .eq("roster_date", rosterDate)
        .order("shift_type");
      if (error) throw error;
      return data;
    },
    enabled: open && !!storeId,
  });

  const { data: storeEmployees } = useQuery({
    queryKey: ["store-employees", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, department, position")
        .eq("store_id", storeId)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open && !!storeId,
  });

  const { data: roles } = useQuery({
    queryKey: ["roles-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_master")
        .select("id, name, shift_type")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: leaveRecords } = useQuery({
    queryKey: ["leave-on-date", storeId, rosterDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, employees:employee_id(id, name, department, position)")
        .eq("status", "approved")
        .lte("start_date", rosterDate)
        .gte("end_date", rosterDate);
      if (error) throw error;
      // Filter by store employees
      const storeEmpIds = storeEmployees?.map(e => e.id) || [];
      return data?.filter(l => storeEmpIds.includes(l.employee_id)) || [];
    },
    enabled: open && !!storeId && !!storeEmployees,
  });

  const addToRosterMutation = useMutation({
    mutationFn: async ({ employeeId, roleId, shiftType }: { employeeId: string; roleId: string; shiftType: string }) => {
      const { error } = await supabase.from("daily_rosters").insert({
        store_id: storeId,
        roster_date: rosterDate,
        employee_id: employeeId,
        role_id: roleId,
        shift_type: shiftType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-roster", storeId, rosterDate] });
      toast.success("Employee added to roster");
      setSelectedEmployeeId("");
      setSelectedRoleId("");
      setAddingShift(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const removeFromRosterMutation = useMutation({
    mutationFn: async (rosterId: string) => {
      const { error } = await supabase.from("daily_rosters").delete().eq("id", rosterId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-roster", storeId, rosterDate] });
      toast.success("Removed from roster");
    },
    onError: (e) => toast.error(e.message),
  });

  const moveShiftMutation = useMutation({
    mutationFn: async ({ rosterId, newShift }: { rosterId: string; newShift: string }) => {
      const { error } = await supabase
        .from("daily_rosters")
        .update({ shift_type: newShift })
        .eq("id", rosterId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-roster", storeId, rosterDate] });
      toast.success("Employee moved to new shift");
    },
    onError: (e) => toast.error(e.message),
  });

  const copyPreviousMutation = useMutation({
    mutationFn: async () => {
      const prevDate = format(subDays(new Date(rosterDate), 1), "yyyy-MM-dd");
      const { data: prevRoster, error: fetchError } = await supabase
        .from("daily_rosters")
        .select("employee_id, role_id, shift_type")
        .eq("store_id", storeId)
        .eq("roster_date", prevDate);
      if (fetchError) throw fetchError;
      if (!prevRoster?.length) throw new Error("No roster found for the previous day");

      const newEntries = prevRoster.map((r) => ({
        store_id: storeId,
        roster_date: rosterDate,
        employee_id: r.employee_id,
        role_id: r.role_id,
        shift_type: r.shift_type,
      }));

      const { error } = await supabase.from("daily_rosters").upsert(newEntries, {
        onConflict: "store_id,roster_date,employee_id",
      });
      if (error) throw error;
      return newEntries.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["daily-roster", storeId, rosterDate] });
      toast.success(`Copied ${count} entries from previous day`);
    },
    onError: (e) => toast.error(e.message),
  });

  const copyWeekMutation = useMutation({
    mutationFn: async () => {
      const prevWeekStart = format(subDays(startOfWeek(new Date(rosterDate), { weekStartsOn: 1 }), 7), "yyyy-MM-dd");
      const prevWeekEnd = format(subDays(endOfWeek(new Date(rosterDate), { weekStartsOn: 1 }), 7), "yyyy-MM-dd");

      const { data: prevWeekRoster, error: fetchError } = await supabase
        .from("daily_rosters")
        .select("employee_id, role_id, shift_type, roster_date")
        .eq("store_id", storeId)
        .gte("roster_date", prevWeekStart)
        .lte("roster_date", prevWeekEnd);
      if (fetchError) throw fetchError;
      if (!prevWeekRoster?.length) throw new Error("No roster found for previous week");

      const currentWeekStart = startOfWeek(new Date(rosterDate), { weekStartsOn: 1 });
      const newEntries = prevWeekRoster.map((r) => {
        const prevDay = new Date(r.roster_date);
        const dayOffset = Math.round((prevDay.getTime() - new Date(prevWeekStart).getTime()) / (1000 * 60 * 60 * 24));
        const newDate = format(addDays(currentWeekStart, dayOffset), "yyyy-MM-dd");
        return {
          store_id: storeId,
          roster_date: newDate,
          employee_id: r.employee_id,
          role_id: r.role_id,
          shift_type: r.shift_type,
        };
      });

      const { error } = await supabase.from("daily_rosters").upsert(newEntries, {
        onConflict: "store_id,roster_date,employee_id",
      });
      if (error) throw error;
      return newEntries.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["daily-roster"] });
      toast.success(`Copied ${count} entries from previous week`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAIRebalance = async () => {
    setIsRebalancing(true);
    setRebalanceSuggestions(null);
    try {
      const leaveEmpIds = leaveRecords?.map(l => l.employee_id) || [];
      const leaveEmpNames = leaveRecords?.map(l => (l.employees as any)?.name) || [];
      const currentRoster = roster?.map(r => ({
        id: r.id,
        employeeName: (r.employees as any)?.name,
        employeeId: r.employee_id,
        shift: r.shift_type,
        role: (r.role_master as any)?.name,
        roleId: r.role_id,
      })) || [];
      const availableEmps = storeEmployees
        ?.filter(e => !leaveEmpIds.includes(e.id))
        .map(e => ({ id: e.id, name: e.name, department: e.department, position: e.position })) || [];

      const { data, error } = await supabase.functions.invoke("ai-insights", {
        body: {
          type: "roster_rebalance",
          context: {
            currentRoster,
            availableEmployees: availableEmps,
            onLeave: leaveEmpNames,
            shifts: SHIFT_TYPES,
            roles: roles?.map(r => ({ id: r.id, name: r.name, shiftType: r.shift_type })) || [],
            date: rosterDate,
          },
        },
      });

      if (error) throw error;
      setRebalanceSuggestions(data?.suggestions || []);
      if (data?.summary) toast.info(data.summary);
    } catch (e: any) {
      toast.error(e.message || "AI rebalance failed");
    } finally {
      setIsRebalancing(false);
    }
  };

  const applyRebalanceMutation = useMutation({
    mutationFn: async (suggestions: any[]) => {
      for (const s of suggestions) {
        if (s.action === "move") {
          await supabase
            .from("daily_rosters")
            .update({ shift_type: s.toShift, role_id: s.roleId || undefined })
            .eq("id", s.rosterId);
        } else if (s.action === "add") {
          await supabase.from("daily_rosters").insert({
            store_id: storeId,
            roster_date: rosterDate,
            employee_id: s.employeeId,
            role_id: s.roleId,
            shift_type: s.shift,
          });
        } else if (s.action === "remove") {
          await supabase.from("daily_rosters").delete().eq("id", s.rosterId);
        }
      }
      return suggestions.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["daily-roster", storeId, rosterDate] });
      setRebalanceSuggestions(null);
      toast.success(`Applied ${count} AI suggestions`);
    },
    onError: (e) => toast.error(e.message),
  });

  const rosteredEmployeeIds = roster?.map((r) => r.employee_id) || [];
  const leaveEmployeeIds = leaveRecords?.map(l => l.employee_id) || [];
  const availableEmployees = storeEmployees?.filter(
    (e) => !rosteredEmployeeIds.includes(e.id) && !leaveEmployeeIds.includes(e.id)
  ) || [];

  const getShiftRoster = (shift: string) => roster?.filter((r) => r.shift_type === shift) || [];

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const rosterId = active.id as string;
    const targetShift = over.id as string;
    const entry = roster?.find(r => r.id === rosterId);
    if (!entry || entry.shift_type === targetShift) return;

    moveShiftMutation.mutate({ rosterId, newShift: targetShift });
  };

  const activeDragEntry = activeDragId ? roster?.find(r => r.id === activeDragId) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Roster — {format(new Date(rosterDate), "dd MMM yyyy")}
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly"><Calendar className="h-3.5 w-3.5 mr-1" />Weekly</TabsTrigger>
            <TabsTrigger value="leave"><AlertCircle className="h-3.5 w-3.5 mr-1" />Leave</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="mt-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{roster?.length || 0} assigned</Badge>
              <Badge variant="secondary">{availableEmployees.length} available</Badge>
              {leaveRecords && leaveRecords.length > 0 && (
                <Badge variant="destructive" className="text-xs">{leaveRecords.length} on leave</Badge>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => copyPreviousMutation.mutate()} disabled={copyPreviousMutation.isPending}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Previous Day
              </Button>
              <Button variant="outline" size="sm" onClick={handleAIRebalance} disabled={isRebalancing}>
                {isRebalancing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Brain className="h-3.5 w-3.5 mr-1.5" />}
                AI Rebalance
              </Button>
            </div>

            {rebalanceSuggestions && rebalanceSuggestions.length > 0 && (
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                <p className="text-sm font-medium">AI Suggestions:</p>
                {rebalanceSuggestions.map((s, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    • {s.description || `${s.action}: ${s.employeeName || ""} → ${s.toShift || s.shift}`}
                  </p>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="h-7 text-xs" onClick={() => applyRebalanceMutation.mutate(rebalanceSuggestions)}>
                    Apply All
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setRebalanceSuggestions(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-5">
                {SHIFT_TYPES.map((shift) => {
                  const shiftRoster = getShiftRoster(shift);
                  return (
                    <RosterShiftDropZone key={shift} shiftType={shift} rosterEntries={shiftRoster}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold capitalize">{shift} Shift</h4>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAddingShift(addingShift === shift ? null : shift)}>
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>

                      {addingShift === shift && (
                        <div className="p-3 rounded-lg border bg-muted/30 mb-2 space-y-2">
                          <div>
                            <Label className="text-xs">Employee</Label>
                            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select employee" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableEmployees.map((e) => (
                                  <SelectItem key={e.id} value={e.id}>{e.name} — {e.position}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Role</Label>
                            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                {roles?.filter((r) => r.shift_type === shift).map((r) => (
                                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button size="sm" className="w-full h-7 text-xs" disabled={!selectedEmployeeId || !selectedRoleId}
                            onClick={() => addToRosterMutation.mutate({ employeeId: selectedEmployeeId, roleId: selectedRoleId, shiftType: shift })}>
                            Add to {shift} shift
                          </Button>
                        </div>
                      )}

                      {shiftRoster.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No employees assigned — drag here or click Add</p>
                      ) : (
                        <div className="space-y-1.5">
                          {shiftRoster.map((entry: any) => (
                            <RosterEmployeeCard
                              key={entry.id}
                              id={entry.id}
                              employee={entry.employees}
                              shiftType={entry.shift_type}
                              roleName={entry.role_master?.name}
                              onRemove={() => removeFromRosterMutation.mutate(entry.id)}
                              draggable
                            />
                          ))}
                        </div>
                      )}
                      <Separator className="mt-3" />
                    </RosterShiftDropZone>
                  );
                })}
              </div>

              <DragOverlay>
                {activeDragEntry ? (
                  <div className="opacity-80">
                    <RosterEmployeeCard
                      id={activeDragEntry.id}
                      employee={(activeDragEntry as any).employees}
                      shiftType={(activeDragEntry as any).shift_type}
                      roleName={(activeDragEntry as any).role_master?.name}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </TabsContent>

          <TabsContent value="weekly" className="mt-4">
            <WeeklyRosterView
              storeId={storeId}
              rosterDate={rosterDate}
              onCopyWeek={() => copyWeekMutation.mutate()}
              isCopying={copyWeekMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="leave" className="mt-4">
            <LeaveEmployeesList
              storeId={storeId}
              rosterDate={rosterDate}
              leaveRecords={leaveRecords || []}
              rosteredEmployeeIds={rosteredEmployeeIds}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
