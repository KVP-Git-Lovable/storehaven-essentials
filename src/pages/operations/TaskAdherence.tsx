import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  Search, CheckCircle, Clock, AlertTriangle, XCircle, 
  Camera, MapPin, Play, RefreshCw, Building, TrendingUp,
  AlertCircle, ArrowRight, Users, List, CalendarDays, User
} from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { TaskInstanceDetailDialog } from "@/components/operations/TaskInstanceDetailDialog";
import { DailyRosterPanel } from "@/components/operations/DailyRosterPanel";
import { DayPlannerView } from "@/components/operations/DayPlannerView";

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'escalated' | 'handed_over';

const statusConfig: Record<TaskStatus, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-4 w-4" />, label: "Pending" },
  in_progress: { color: "bg-blue-100 text-blue-800", icon: <Play className="h-4 w-4" />, label: "In Progress" },
  completed: { color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-4 w-4" />, label: "Completed" },
  overdue: { color: "bg-red-100 text-red-800", icon: <XCircle className="h-4 w-4" />, label: "Overdue" },
  escalated: { color: "bg-orange-100 text-orange-800", icon: <AlertTriangle className="h-4 w-4" />, label: "Escalated" },
  handed_over: { color: "bg-purple-100 text-purple-800", icon: <ArrowRight className="h-4 w-4" />, label: "Handed Over" },
};

export default function TaskAdherence() {
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [handoverDialogOpen, setHandoverDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [targetRoleId, setTargetRoleId] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "dayplan">("list");
  const [rosterOpen, setRosterOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_master").select("id, name, shift_type").eq("status", "active").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: taskInstances, isLoading } = useQuery({
    queryKey: ["task-instances", selectedStore, selectedDate],
    queryFn: async () => {
      let query = supabase
        .from("task_instances")
        .select(`
          *,
          task_master(name, category, requires_photo_evidence, requires_gps_verification),
          role_master(name, shift_type),
          stores(name)
        `)
        .eq("scheduled_date", selectedDate)
        .order("scheduled_time", { ascending: true });

      if (selectedStore) {
        query = query.eq("store_id", selectedStore);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedDate,
  });

  const { data: completions } = useQuery({
    queryKey: ["task-completions", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_completions")
        .select("task_instance_id, is_on_time")
        .gte("completion_time", `${selectedDate}T00:00:00`)
        .lte("completion_time", `${selectedDate}T23:59:59`);
      if (error) throw error;
      return data;
    },
  });

  const generateTasksMutation = useMutation({
    mutationFn: async () => {
      // Get all template items with their related data
      const { data: templateItems, error: templateError } = await supabase
        .from("task_template_items")
        .select(`
          *,
          task_template(store_id),
          frequency_master(frequency_type, days_of_week)
        `);
      
      if (templateError) throw templateError;

      const today = new Date();
      const dayOfWeek = today.getDay();
      const targetStores = selectedStore ? [selectedStore] : stores?.map(s => s.id) || [];

      const instancesToCreate: any[] = [];

      for (const item of templateItems || []) {
        // Check frequency
        const freq = item.frequency_master;
        if (freq?.frequency_type === 'weekly') {
          if (!freq.days_of_week?.includes(dayOfWeek)) continue;
        }

        // Determine which stores this applies to
        const storeIds = item.task_template?.store_id 
          ? [item.task_template.store_id] 
          : targetStores;

        for (const storeId of storeIds) {
          // Calculate scheduled time based on time window
          let scheduledTime = "09:00:00";
          let dueTime = "17:00:00";

          if (item.time_window === "opening") {
            scheduledTime = "09:00:00";
            dueTime = "09:30:00";
          } else if (item.time_window === "closing") {
            scheduledTime = "20:00:00";
            dueTime = "21:00:00";
          } else if (item.time_window === "periodic") {
            // Generate multiple instances for periodic tasks
            const interval = item.periodic_interval_mins || 120;
            for (let hour = 9; hour < 21; hour += Math.floor(interval / 60)) {
              instancesToCreate.push({
                template_item_id: item.id,
                store_id: storeId,
                task_id: item.task_id,
                role_id: item.role_id,
                scheduled_date: selectedDate,
                scheduled_time: `${hour.toString().padStart(2, '0')}:00:00`,
                due_time: `${(hour + 1).toString().padStart(2, '0')}:00:00`,
                status: 'pending',
              });
            }
            continue;
          }

          instancesToCreate.push({
            template_item_id: item.id,
            store_id: storeId,
            task_id: item.task_id,
            role_id: item.role_id,
            scheduled_date: selectedDate,
            scheduled_time: scheduledTime,
            due_time: dueTime,
            status: 'pending',
          });
        }
      }

      if (instancesToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from("task_instances")
          .upsert(instancesToCreate, { onConflict: 'template_item_id,store_id,scheduled_date,scheduled_time' });
        
        if (insertError) throw insertError;
      }

      return instancesToCreate.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["task-instances"] });
      toast.success(`Generated ${count} task instances`);
    },
    onError: (error) => toast.error(error.message),
  });

  const startTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("task_instances")
        .update({ status: 'in_progress', started_at: new Date().toISOString(), assigned_to: 'Current User' })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-instances"] });
      toast.success("Task started");
    },
    onError: (error) => toast.error(error.message),
  });

  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, notes, photoUrl }: { taskId: string; notes: string; photoUrl: string }) => {
      const now = new Date();
      const task = taskInstances?.find(t => t.id === taskId);
      const isOnTime = task?.due_time ? now.toTimeString().slice(0, 8) <= task.due_time : true;

      // Create completion record
      const { error: completionError } = await supabase
        .from("task_completions")
        .insert({
          task_instance_id: taskId,
          completed_by: 'Current User',
          photo_evidence_url: photoUrl || null,
          notes: notes || null,
          is_on_time: isOnTime,
        });
      
      if (completionError) throw completionError;

      // Update task instance
      const { error: updateError } = await supabase
        .from("task_instances")
        .update({ status: 'completed', completed_at: now.toISOString() })
        .eq("id", taskId);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-instances"] });
      queryClient.invalidateQueries({ queryKey: ["task-completions"] });
      toast.success("Task completed successfully");
      setCompleteDialogOpen(false);
      setSelectedTask(null);
      setCompletionNotes("");
      setPhotoUrl("");
    },
    onError: (error) => toast.error(error.message),
  });

  const handoverTaskMutation = useMutation({
    mutationFn: async ({ taskId, notes, targetRoleId }: { taskId: string; notes: string; targetRoleId: string }) => {
      const now = new Date();
      const task = taskInstances?.find(t => t.id === taskId);
      
      // Update task instance with handover details
      const { error: updateError } = await supabase
        .from("task_instances")
        .update({ 
          status: 'handed_over', 
          handed_over_at: now.toISOString(),
          handed_over_from: task?.role_id,
          role_id: targetRoleId,
          notes: notes ? `[Handover] ${notes}` : task?.notes,
        })
        .eq("id", taskId);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-instances"] });
      toast.success("Task handed over to next shift");
      setHandoverDialogOpen(false);
      setSelectedTask(null);
      setHandoverNotes("");
      setTargetRoleId("");
    },
    onError: (error) => toast.error(error.message),
  });

  const bulkHandoverMutation = useMutation({
    mutationFn: async ({ targetRoleId, notes }: { targetRoleId: string; notes: string }) => {
      const now = new Date();
      const incompleteTasks = taskInstances?.filter(t => 
        t.status === 'pending' || t.status === 'in_progress' || t.status === 'overdue'
      ) || [];
      
      if (incompleteTasks.length === 0) {
        throw new Error("No incomplete tasks to hand over");
      }

      for (const task of incompleteTasks) {
        const { error } = await supabase
          .from("task_instances")
          .update({ 
            status: 'handed_over', 
            handed_over_at: now.toISOString(),
            handed_over_from: task.role_id,
            role_id: targetRoleId,
            notes: notes ? `[Bulk Handover] ${notes}` : task.notes,
          })
          .eq("id", task.id);
        
        if (error) throw error;
      }
      
      return incompleteTasks.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["task-instances"] });
      toast.success(`${count} tasks handed over to next shift`);
      setHandoverDialogOpen(false);
      setHandoverNotes("");
      setTargetRoleId("");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("task_instances").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-instances"] });
      toast.success("Task deleted");
      setDetailDialogOpen(false);
      setSelectedTask(null);
    },
    onError: (error) => toast.error(error.message),
  });

  // Calculate stats
  const totalTasks = taskInstances?.length || 0;
  const completedTasks = taskInstances?.filter(t => t.status === 'completed').length || 0;
  const overdueTasks = taskInstances?.filter(t => t.status === 'overdue').length || 0;
  const inProgressTasks = taskInstances?.filter(t => t.status === 'in_progress').length || 0;
  const handedOverTasks = taskInstances?.filter(t => t.status === 'handed_over').length || 0;
  const incompleteTasks = taskInstances?.filter(t => 
    t.status === 'pending' || t.status === 'in_progress' || t.status === 'overdue'
  ).length || 0;
  const adherenceRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const onTimeCompletions = completions?.filter(c => c.is_on_time).length || 0;
  const onTimeRate = completions && completions.length > 0 
    ? Math.round((onTimeCompletions / completions.length) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Adherence</h1>
          <p className="text-muted-foreground">Monitor and complete daily store operations</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedStore && (
            <Button variant="outline" onClick={() => setRosterOpen(true)}>
              <Users className="mr-2 h-4 w-4" />
              Manage Roster
            </Button>
          )}
          {incompleteTasks > 0 && (
            <Button 
              variant="outline" 
              onClick={() => {
                setSelectedTask(null);
                setHandoverDialogOpen(true);
              }}
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              Shift Handover ({incompleteTasks})
            </Button>
          )}
          <Button onClick={() => generateTasksMutation.mutate()} disabled={generateTasksMutation.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${generateTasksMutation.isPending ? 'animate-spin' : ''}`} />
            Generate Tasks
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Tasks" value={totalTasks} icon={Clock} iconColor="text-blue-500" />
        <StatCard title="Completed" value={completedTasks} icon={CheckCircle} iconColor="text-green-500" />
        <StatCard title="Overdue" value={overdueTasks} icon={AlertCircle} iconColor="text-red-500" />
        <StatCard title="Adherence Rate" value={`${adherenceRate}%`} icon={TrendingUp} iconColor="text-purple-500" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label>Store</Label>
              <Select value={selectedStore || "_all"} onValueChange={(v) => setSelectedStore(v === "_all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Stores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Stores</SelectItem>
                  {stores?.map((store) => (
                    <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as any)}>
                <ToggleGroupItem value="list" aria-label="List view" className="px-3">
                  <List className="h-4 w-4 mr-1.5" /> List
                </ToggleGroupItem>
                <ToggleGroupItem value="dayplan" aria-label="Day plan view" className="px-3">
                  <CalendarDays className="h-4 w-4 mr-1.5" /> Day Plan
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading tasks...</div>
          ) : !taskInstances || taskInstances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tasks scheduled for this date.</p>
              <p className="text-sm">Click "Generate Tasks" to create task instances from templates.</p>
            </div>
          ) : viewMode === "dayplan" ? (
            <DayPlannerView
              storeId={selectedStore}
              selectedDate={selectedDate}
              taskInstances={taskInstances}
              onTaskClick={(task) => {
                setSelectedTask(task);
                setDetailDialogOpen(true);
              }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taskInstances.map((task) => {
                  const config = statusConfig[task.status as TaskStatus];
                  return (
                    <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                      setSelectedTask(task);
                      setDetailDialogOpen(true);
                    }}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{task.task_master?.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            {task.task_master?.category}
                            {task.task_master?.requires_photo_evidence && (
                              <Camera className="h-3 w-3 text-blue-500" />
                            )}
                            {task.task_master?.requires_gps_verification && (
                              <MapPin className="h-3 w-3 text-red-500" />
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          {task.stores?.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {task.role_master?.name}
                          <div className="text-xs text-muted-foreground capitalize">
                            {task.role_master?.shift_type} shift
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {task.assigned_to ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {task.assigned_to}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{task.scheduled_time?.slice(0, 5)}</TableCell>
                      <TableCell>{task.due_time?.slice(0, 5)}</TableCell>
                      <TableCell>
                        <Badge className={`flex items-center gap-1 w-fit ${config.color}`}>
                          {config.icon}
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {task.status === 'pending' && (
                            <>
                              <Button size="sm" onClick={() => startTaskMutation.mutate(task.id)}>
                                <Play className="h-4 w-4 mr-1" /> Start
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  setSelectedTask(task);
                                  setHandoverDialogOpen(true);
                                }}
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {task.status === 'in_progress' && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  setSelectedTask(task);
                                  setCompleteDialogOpen(true);
                                }}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" /> Complete
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  setSelectedTask(task);
                                  setHandoverDialogOpen(true);
                                }}
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {task.status === 'completed' && (
                            <span className="text-sm text-muted-foreground">
                              {task.completed_at && format(new Date(task.completed_at), "HH:mm")}
                            </span>
                          )}
                          {task.status === 'handed_over' && (
                            <div className="text-xs text-muted-foreground">
                              {task.handed_over_at && format(new Date(task.handed_over_at), "HH:mm")}
                              {task.notes && <div className="italic">{task.notes}</div>}
                            </div>
                          )}
                          {(task.status === 'overdue' || task.status === 'escalated') && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedTask(task);
                                setHandoverDialogOpen(true);
                              }}
                            >
                              <ArrowRight className="h-4 w-4 mr-1" /> Handover
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Task: {selectedTask?.task_master?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedTask?.task_master?.requires_photo_evidence && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Camera className="h-4 w-4" /> Photo Evidence (Required)
                </Label>
                <Input
                  type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="Enter photo URL or upload"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Completion Notes</Label>
              <Textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Any observations or notes..."
              />
            </div>
            <Button
              onClick={() => completeTaskMutation.mutate({
                taskId: selectedTask?.id,
                notes: completionNotes,
                photoUrl: photoUrl,
              })}
              disabled={selectedTask?.task_master?.requires_photo_evidence && !photoUrl}
            >
              <CheckCircle className="h-4 w-4 mr-2" /> Mark as Complete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={handoverDialogOpen} onOpenChange={setHandoverDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedTask 
                ? `Handover Task: ${selectedTask?.task_master?.name}` 
                : `Shift Handover (${incompleteTasks} tasks)`
              }
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Hand Over To (Role/Shift)</Label>
              <Select value={targetRoleId} onValueChange={setTargetRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select next shift role" />
                </SelectTrigger>
                <SelectContent>
                  {roles?.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name} ({role.shift_type} shift)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Handover Notes</Label>
              <Textarea
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                placeholder="Important context for the next shift..."
                rows={4}
              />
            </div>
            {!selectedTask && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium mb-2">Tasks to be handed over:</p>
                <ul className="space-y-1 text-muted-foreground">
                  {taskInstances?.filter(t => 
                    t.status === 'pending' || t.status === 'in_progress' || t.status === 'overdue'
                  ).slice(0, 5).map(t => (
                    <li key={t.id} className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {t.status}
                      </Badge>
                      {t.task_master?.name}
                    </li>
                  ))}
                  {incompleteTasks > 5 && (
                    <li className="text-muted-foreground">...and {incompleteTasks - 5} more</li>
                  )}
                </ul>
              </div>
            )}
            <Button
              onClick={() => {
                if (selectedTask) {
                  handoverTaskMutation.mutate({
                    taskId: selectedTask.id,
                    notes: handoverNotes,
                    targetRoleId: targetRoleId,
                  });
                } else {
                  bulkHandoverMutation.mutate({
                    targetRoleId: targetRoleId,
                    notes: handoverNotes,
                  });
                }
              }}
              disabled={!targetRoleId || handoverTaskMutation.isPending || bulkHandoverMutation.isPending}
            >
              <ArrowRight className="h-4 w-4 mr-2" /> 
              {selectedTask ? "Handover Task" : `Handover All (${incompleteTasks})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TaskInstanceDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        task={selectedTask}
        storeId={selectedStore}
        rosterDate={selectedDate}
        onEdit={() => {
          setDetailDialogOpen(false);
          setCompleteDialogOpen(true);
        }}
        onDelete={() => {
          if (selectedTask && confirm("Are you sure you want to delete this task?")) {
            deleteTaskMutation.mutate(selectedTask.id);
          }
        }}
        onComplete={() => {
          setDetailDialogOpen(false);
          setCompleteDialogOpen(true);
        }}
      />

      {selectedStore && (
        <DailyRosterPanel
          open={rosterOpen}
          onOpenChange={setRosterOpen}
          storeId={selectedStore}
          rosterDate={selectedDate}
        />
      )}
    </div>
  );
}
