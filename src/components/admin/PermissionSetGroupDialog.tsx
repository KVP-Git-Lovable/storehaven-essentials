import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PermissionSetGroup {
  id: string;
  name: string;
  description: string | null;
  status: string;
}

interface PermissionSetGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: PermissionSetGroup | null;
  onSuccess: () => void;
}

export function PermissionSetGroupDialog({
  open,
  onOpenChange,
  group,
  onSuccess,
}: PermissionSetGroupDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description || "");
      setStatus(group.status);
    } else {
      setName("");
      setDescription("");
      setStatus("active");
    }
  }, [group, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Group name is required",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      if (group) {
        // Update existing group
        const { error } = await supabase
          .from("permission_set_groups")
          .update({
            name: name.trim(),
            description: description.trim() || null,
            status,
          })
          .eq("id", group.id);

        if (error) throw error;

        toast({
          title: "Group Updated",
          description: "Permission set group has been updated successfully.",
        });
      } else {
        // Create new group
        const { error } = await supabase.from("permission_set_groups").insert({
          name: name.trim(),
          description: description.trim() || null,
          status,
        });

        if (error) throw error;

        toast({
          title: "Group Created",
          description: "Permission set group has been created successfully.",
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save group",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {group ? "Edit Permission Set Group" : "Create Permission Set Group"}
            </DialogTitle>
            <DialogDescription>
              {group
                ? "Update the permission set group details."
                : "Create a new permission set group to assign to users."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Finance Team Access"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description for this group"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {group ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
