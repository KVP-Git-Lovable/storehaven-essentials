import { Edit, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
};

type MaintenanceDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: MaintenanceTask | null;
  onEdit: () => void;
  onClone: () => void;
  onDeleted: () => void;
};

export function MaintenanceDetailsDialog({
  open,
  onOpenChange,
  task,
  onEdit,
  onClone,
  onDeleted,
}: MaintenanceDetailsDialogProps) {
  const { toast } = useToast();

  if (!task) return null;

  const handleDelete = async () => {
    const { error } = await supabase
      .from("maintenance_tasks")
      .delete()
      .eq("id", task.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete schedule",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Deleted",
        description: "Maintenance schedule has been deleted.",
      });
      onOpenChange(false);
      onDeleted();
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "scheduled":
        return "default";
      case "due-soon":
        return "secondary";
      case "overdue":
        return "destructive";
      case "completed":
        return "outline";
      default:
        return "default";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Maintenance Schedule Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant={getStatusVariant(task.status)} className="capitalize">
              {task.status}
            </Badge>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={onClone}>
                <Copy className="h-4 w-4 mr-1" />
                Clone
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Maintenance Schedule</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this maintenance schedule? This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div>
              <p className="text-sm text-muted-foreground">Asset</p>
              <p className="font-medium">{task.asset}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Store</p>
              <p className="font-medium">{task.store?.name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Task Type</p>
              <p className="font-medium">{task.task_type}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Frequency</p>
              <p className="font-medium capitalize">{task.frequency}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Done</p>
              <p className="font-medium">
                {task.last_done === "-"
                  ? "-"
                  : new Date(task.last_done).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Next Due</p>
              <p className="font-medium">
                {new Date(task.next_due).toLocaleDateString()}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Assigned To</p>
              <p className="font-medium">{task.assigned_to}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
