import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, ListChecks } from "lucide-react";

interface ChecklistItem {
  id?: string;
  title: string;
  sort_order: number;
  is_required: boolean;
}

interface TaskChecklistEditorProps {
  taskMasterId: string;
}

export function TaskChecklistEditor({ taskMasterId }: TaskChecklistEditorProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const queryClient = useQueryClient();

  const { data: savedItems, isLoading } = useQuery({
    queryKey: ["task-master-checklist", taskMasterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_master_checklist_items")
        .select("*")
        .eq("task_master_id", taskMasterId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!taskMasterId,
  });

  useEffect(() => {
    if (savedItems) {
      setItems(savedItems.map(i => ({
        id: i.id,
        title: i.title,
        sort_order: i.sort_order,
        is_required: i.is_required,
      })));
    }
  }, [savedItems]);

  const addMutation = useMutation({
    mutationFn: async (item: { title: string; sort_order: number; is_required: boolean }) => {
      const { error } = await supabase
        .from("task_master_checklist_items")
        .insert({ ...item, task_master_id: taskMasterId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-master-checklist", taskMasterId] });
      setNewTitle("");
      toast.success("Checklist item added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("task_master_checklist_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-master-checklist", taskMasterId] });
      toast.success("Item removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleRequiredMutation = useMutation({
    mutationFn: async ({ id, is_required }: { id: string; is_required: boolean }) => {
      const { error } = await supabase
        .from("task_master_checklist_items")
        .update({ is_required })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-master-checklist", taskMasterId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addMutation.mutate({
      title: newTitle.trim(),
      sort_order: items.length,
      is_required: true,
    });
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-primary" />
        <h4 className="font-medium text-sm">Checklist Items</h4>
        <span className="text-xs text-muted-foreground">({items.length} items)</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={item.id || idx} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">{item.title}</span>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  checked={item.is_required}
                  onCheckedChange={(checked) => {
                    if (item.id) {
                      toggleRequiredMutation.mutate({ id: item.id, is_required: !!checked });
                    }
                  }}
                />
                <Label className="text-xs text-muted-foreground">Required</Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => item.id && deleteMutation.mutate(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2">
            <Input
              placeholder="Add checklist item..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="text-sm"
            />
            <Button size="sm" onClick={handleAdd} disabled={!newTitle.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
