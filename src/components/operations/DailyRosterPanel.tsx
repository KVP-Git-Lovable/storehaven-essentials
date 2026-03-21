import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { Plus, Copy, Users, Trash2 } from "lucide-react";
import { RosterEmployeeCard } from "./RosterEmployeeCard";

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

  const rosteredEmployeeIds = roster?.map((r) => r.employee_id) || [];
  const availableEmployees = storeEmployees?.filter((e) => !rosteredEmployeeIds.includes(e.id)) || [];

  const getShiftRoster = (shift: string) => roster?.filter((r) => r.shift_type === shift) || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Daily Roster — {format(new Date(rosterDate), "dd MMM yyyy")}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-1 mb-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{roster?.length || 0} assigned</Badge>
            <Badge variant="secondary">{availableEmployees.length} available</Badge>
          </div>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => copyPreviousMutation.mutate()} disabled={copyPreviousMutation.isPending}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy Previous Day
          </Button>
        </div>

        <div className="space-y-5">
          {SHIFT_TYPES.map((shift) => {
            const shiftRoster = getShiftRoster(shift);
            return (
              <div key={shift}>
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
                  <p className="text-xs text-muted-foreground py-2">No employees assigned</p>
                ) : (
                  <div className="space-y-1.5">
                    {shiftRoster.map((entry: any) => (
                      <RosterEmployeeCard
                        key={entry.id}
                        employee={entry.employees}
                        shiftType={entry.shift_type}
                        roleName={entry.role_master?.name}
                        onRemove={() => removeFromRosterMutation.mutate(entry.id)}
                      />
                    ))}
                  </div>
                )}
                <Separator className="mt-3" />
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
