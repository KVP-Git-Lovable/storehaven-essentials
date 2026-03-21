import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Edit, Trash2, CheckCircle, Clock, Camera, MapPin,
  ListChecks, Building, AlertTriangle
} from "lucide-react";

interface TaskInstanceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: any;
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
}

export function TaskInstanceDetailDialog({
  open,
  onOpenChange,
  task,
  onEdit,
  onDelete,
  onComplete,
}: TaskInstanceDetailDialogProps) {
  const queryClient = useQueryClient();

  // Fetch master checklist items for this task
  const { data: masterChecklistItems } = useQuery({
    queryKey: ["task-master-checklist", task?.task_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_master_checklist_items")
        .select("*")
        .eq("task_master_id", task.task_id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!task?.task_id && open,
  });

  // Fetch instance checklist completion state
  const { data: instanceChecklistItems } = useQuery({
    queryKey: ["task-instance-checklist", task?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_instance_checklist_items")
        .select("*")
        .eq("task_instance_id", task.id);
      if (error) throw error;
      return data;
    },
    enabled: !!task?.id && open,
  });

  const toggleCheckMutation = useMutation({
    mutationFn: async ({ checklistItemId, isChecked }: { checklistItemId: string; isChecked: boolean }) => {
      const existing = instanceChecklistItems?.find(i => i.checklist_item_id === checklistItemId);

      if (existing) {
        const { error } = await supabase
          .from("task_instance_checklist_items")
          .update({
            is_checked: isChecked,
            checked_at: isChecked ? new Date().toISOString() : null,
            checked_by: isChecked ? "Current User" : null,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("task_instance_checklist_items")
          .insert({
            task_instance_id: task.id,
            checklist_item_id: checklistItemId,
            is_checked: isChecked,
            checked_at: isChecked ? new Date().toISOString() : null,
            checked_by: isChecked ? "Current User" : null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-instance-checklist", task?.id] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!task) return null;

  const isChecked = (checklistItemId: string) =>
    instanceChecklistItems?.find(i => i.checklist_item_id === checklistItemId)?.is_checked || false;

  const checkedCount = masterChecklistItems?.filter(m => isChecked(m.id)).length || 0;
  const totalCount = masterChecklistItems?.length || 0;

  const statusColorMap: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    overdue: "bg-red-100 text-red-800",
    escalated: "bg-orange-100 text-orange-800",
    handed_over: "bg-purple-100 text-purple-800",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {task.task_master?.name}
            <Badge className={statusColorMap[task.status] || ""}>{task.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Store</span>
              <div className="flex items-center gap-1.5 font-medium">
                <Building className="h-3.5 w-3.5" />
                {task.stores?.name || "-"}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Role</span>
              <div className="font-medium">{task.role_master?.name || "-"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Scheduled</span>
              <div className="font-medium flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {task.scheduled_time?.slice(0, 5)} — {task.due_time?.slice(0, 5)}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Category</span>
              <div className="font-medium capitalize">{task.task_master?.category}</div>
            </div>
            {task.completed_at && (
              <div>
                <span className="text-muted-foreground">Completed At</span>
                <div className="font-medium">{format(new Date(task.completed_at), "HH:mm, dd MMM")}</div>
              </div>
            )}
            {task.assigned_to && (
              <div>
                <span className="text-muted-foreground">Assigned To</span>
                <div className="font-medium">{task.assigned_to}</div>
              </div>
            )}
          </div>

          {/* Requirements */}
          <div className="flex gap-3">
            {task.task_master?.requires_photo_evidence && (
              <Badge variant="outline" className="gap-1">
                <Camera className="h-3 w-3" /> Photo Required
              </Badge>
            )}
            {task.task_master?.requires_gps_verification && (
              <Badge variant="outline" className="gap-1">
                <MapPin className="h-3 w-3" /> GPS Required
              </Badge>
            )}
          </div>

          {task.notes && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <span className="text-muted-foreground font-medium">Notes: </span>
              {task.notes}
            </div>
          )}

          {/* Checklist Section */}
          {totalCount > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-sm">Checklist</h4>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {checkedCount}/{totalCount} completed
                  </span>
                </div>

                <div className="space-y-2">
                  {masterChecklistItems?.map((item) => {
                    const checked = isChecked(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                          checked ? "bg-primary/5 border-primary/20" : "hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            toggleCheckMutation.mutate({
                              checklistItemId: item.id,
                              isChecked: !!v,
                            })
                          }
                          disabled={task.status === "completed"}
                        />
                        <span className={`text-sm flex-1 ${checked ? "line-through text-muted-foreground" : ""}`}>
                          {item.title}
                        </span>
                        {item.is_required && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Required</Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <Separator />
          <div className="flex gap-2 justify-end">
            {task.status !== "completed" && (
              <Button variant="default" size="sm" onClick={onComplete}>
                <CheckCircle className="h-4 w-4 mr-1" /> Complete
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
