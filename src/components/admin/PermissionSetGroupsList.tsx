import { useState, useEffect } from "react";
import { Loader2, Plus, Users, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PermissionSetGroupDialog } from "./PermissionSetGroupDialog";

interface PermissionSetGroup {
  id: string;
  name: string;
  description: string | null;
  status: string;
  user_count?: number;
}

interface PermissionSetGroupsListProps {
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  refreshTrigger?: number;
  onRefresh: () => void;
}

export function PermissionSetGroupsList({
  selectedGroupId,
  onSelectGroup,
  refreshTrigger,
  onRefresh,
}: PermissionSetGroupsListProps) {
  const [groups, setGroups] = useState<PermissionSetGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionSetGroup | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<PermissionSetGroup | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchGroups();
  }, [refreshTrigger]);

  const fetchGroups = async () => {
    setIsLoading(true);

    // Fetch groups with user count
    const { data: groupsData } = await supabase
      .from("permission_set_groups")
      .select("*")
      .order("name");

    if (groupsData) {
      // Fetch user counts for each group
      const groupsWithCounts = await Promise.all(
        groupsData.map(async (group) => {
          const { count } = await supabase
            .from("user_permission_set_groups")
            .select("*", { count: "exact", head: true })
            .eq("group_id", group.id);

          return {
            ...group,
            user_count: count || 0,
          };
        })
      );

      setGroups(groupsWithCounts);

      // Auto-select first group if none selected
      if (!selectedGroupId && groupsWithCounts.length > 0) {
        onSelectGroup(groupsWithCounts[0].id);
      }
    }

    setIsLoading(false);
  };

  const handleAddGroup = () => {
    setEditingGroup(null);
    setDialogOpen(true);
  };

  const handleEditGroup = (group: PermissionSetGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGroup(group);
    setDialogOpen(true);
  };

  const handleDeleteClick = (group: PermissionSetGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingGroup(group);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingGroup) return;

    try {
      const { error } = await supabase
        .from("permission_set_groups")
        .delete()
        .eq("id", deletingGroup.id);

      if (error) throw error;

      toast({
        title: "Group Deleted",
        description: `"${deletingGroup.name}" has been deleted.`,
      });

      if (selectedGroupId === deletingGroup.id) {
        onSelectGroup(null);
      }

      fetchGroups();
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete group",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingGroup(null);
    }
  };

  const handleDialogSuccess = () => {
    fetchGroups();
    onRefresh();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <Button onClick={handleAddGroup} className="w-full" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Group
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No permission set groups yet.
              <br />
              Click "Add Group" to create one.
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                onClick={() => onSelectGroup(group.id)}
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedGroupId === group.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{group.name}</span>
                    {group.status === "inactive" && (
                      <Badge
                        variant="secondary"
                        className={
                          selectedGroupId === group.id
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : ""
                        }
                      >
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <div
                    className={`flex items-center gap-1 text-sm ${
                      selectedGroupId === group.id
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Users className="h-3 w-3" />
                    {group.user_count} user{group.user_count !== 1 ? "s" : ""}
                  </div>
                </div>

                <div
                  className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                    selectedGroupId === group.id ? "opacity-100" : ""
                  }`}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 ${
                      selectedGroupId === group.id
                        ? "hover:bg-primary-foreground/20"
                        : ""
                    }`}
                    onClick={(e) => handleEditGroup(group, e)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 ${
                      selectedGroupId === group.id
                        ? "hover:bg-primary-foreground/20"
                        : ""
                    }`}
                    onClick={(e) => handleDeleteClick(group, e)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <PermissionSetGroupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        group={editingGroup}
        onSuccess={handleDialogSuccess}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permission Set Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingGroup?.name}"? This will
              remove all permission assignments and unlink all users from this
              group. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
