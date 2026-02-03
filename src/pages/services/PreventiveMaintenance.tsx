import { useState, useEffect } from "react";
import { Plus, Calendar, CheckCircle, Clock, AlertTriangle, Loader2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MaintenanceFormDialog } from "@/components/maintenance/MaintenanceFormDialog";
import { MaintenanceDetailsDialog } from "@/components/maintenance/MaintenanceDetailsDialog";
import { MaintenanceCalendarView } from "@/components/maintenance/MaintenanceCalendarView";
import { useStoreAccess } from "@/hooks/useStoreAccess";

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

export default function PreventiveMaintenance() {
  const [schedules, setSchedules] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit" | "clone">("add");
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { toast } = useToast();
  const { accessibleStoreIds, isAdmin, loading: accessLoading } = useStoreAccess();

  useEffect(() => {
    if (!accessLoading) {
      fetchSchedules();
    }
  }, [accessLoading, accessibleStoreIds]);

  const fetchSchedules = async () => {
    const storeIds = Array.from(accessibleStoreIds);
    
    // Fetch maintenance tasks with their linked asset data
    let query = supabase
      .from("maintenance_tasks")
      .select(`
        *, 
        store:store_id(name), 
        pm_checklist_master_id,
        asset_record:asset_id(id, asset_status, asset_master_id)
      `)
      .order("created_at", { ascending: false });
    
    if (!isAdmin && storeIds.length > 0) {
      query = query.in("store_id", storeIds);
    }
    
    const { data, error } = await query;

    if (error) {
      toast({ title: "Error", description: "Failed to load schedules", variant: "destructive" });
    } else {
      // Filter out tasks linked to orphaned assets or assets without valid asset_master
      const validSchedules = (data || []).filter(task => {
        // If no asset linked, exclude the task (orphan PM task)
        if (!task.asset_id) return false;
        
        // If linked asset is orphaned or has no master, exclude
        const assetRecord = task.asset_record as { id: string; asset_status: string; asset_master_id: string | null } | null;
        if (!assetRecord) return false;
        if (assetRecord.asset_status === "orphaned") return false;
        if (!assetRecord.asset_master_id) return false;
        
        return true;
      });
      
      setSchedules(validSchedules);
    }
    setLoading(false);
  };

  const handleAddClick = () => {
    setSelectedTask(null);
    setFormMode("add");
    setFormOpen(true);
  };

  const handleRowClick = (task: MaintenanceTask) => {
    setSelectedTask(task);
    setDetailsOpen(true);
  };

  const handleEdit = () => {
    setDetailsOpen(false);
    setFormMode("edit");
    setFormOpen(true);
  };

  const handleClone = () => {
    setDetailsOpen(false);
    setFormMode("clone");
    setFormOpen(true);
  };

  const handleCalendarTaskClick = (task: MaintenanceTask) => {
    setSelectedTask(task);
    setCalendarOpen(false);
    setDetailsOpen(true);
  };

  const stats = [
    { 
      title: "Total Schedules", 
      value: schedules.length.toString(), 
      icon: Calendar, 
      iconColor: "bg-primary/10 text-primary" 
    },
    { 
      title: "Completed", 
      value: schedules.filter(s => s.status === "completed").length.toString(), 
      icon: CheckCircle, 
      iconColor: "bg-success/10 text-success" 
    },
    { 
      title: "Due Soon", 
      value: schedules.filter(s => s.status === "due-soon").length.toString(), 
      icon: Clock, 
      iconColor: "bg-warning/10 text-warning" 
    },
    { 
      title: "Overdue", 
      value: schedules.filter(s => s.status === "overdue").length.toString(), 
      icon: AlertTriangle, 
      iconColor: "bg-destructive/10 text-destructive" 
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Preventive Maintenance</h1>
          <p className="text-muted-foreground">Schedule and track routine maintenance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setCalendarOpen(true)}>
            <CalendarDays className="h-4 w-4" />
            Calendar
          </Button>
          <Button className="gap-2" onClick={handleAddClick}>
            <Plus className="h-4 w-4" />
            Add Schedule
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Task Type</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Last Done</TableHead>
              <TableHead>Next Due</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((schedule) => (
              <TableRow 
                key={schedule.id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(schedule)}
              >
                <TableCell className="font-medium">{schedule.asset}</TableCell>
                <TableCell>{schedule.store?.name || "-"}</TableCell>
                <TableCell>{schedule.task_type}</TableCell>
                <TableCell className="capitalize">{schedule.frequency}</TableCell>
                <TableCell>
                  {schedule.last_done === "-" ? "-" : new Date(schedule.last_done).toLocaleDateString()}
                </TableCell>
                <TableCell>{new Date(schedule.next_due).toLocaleDateString()}</TableCell>
                <TableCell>{schedule.assigned_to}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      schedule.status === "scheduled" ? "default" :
                      schedule.status === "due-soon" ? "secondary" :
                      schedule.status === "overdue" ? "destructive" : "outline"
                    }
                  >
                    {schedule.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {schedules.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No maintenance schedules found. Click "Add Schedule" to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <MaintenanceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initialData={selectedTask}
        onSuccess={fetchSchedules}
      />

      <MaintenanceDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        task={selectedTask}
        onEdit={handleEdit}
        onClone={handleClone}
        onDeleted={fetchSchedules}
      />

      <MaintenanceCalendarView
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        schedules={schedules}
        onTaskClick={handleCalendarTaskClick}
      />
    </div>
  );
}
