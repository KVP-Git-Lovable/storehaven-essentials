import { useState, useEffect } from "react";
import { Loader2, Search, UserPlus } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role_name?: string;
}

interface AssignUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  assignedUserIds: string[];
  onSuccess: () => void;
}

export function AssignUsersDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
  assignedUserIds,
  onSuccess,
}: AssignUsersDialogProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchUsers();
      setSelectedUserIds(new Set(assignedUserIds));
    }
  }, [open, assignedUserIds]);

  const fetchUsers = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select(`
        id,
        username,
        email,
        user_roles_master:role_id (name)
      `)
      .eq("status", "active")
      .order("username");

    if (data) {
      const usersWithRoles = data.map((u: any) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role_name: u.user_roles_master?.name || "No Role",
      }));
      setUsers(usersWithRoles);
    }
    setIsLoading(false);
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Remove all existing assignments for this group
      await supabase
        .from("user_permission_set_groups")
        .delete()
        .eq("group_id", groupId);

      // Insert new assignments
      if (selectedUserIds.size > 0) {
        const assignments = Array.from(selectedUserIds).map((userId) => ({
          user_id: userId,
          group_id: groupId,
        }));

        const { error } = await supabase
          .from("user_permission_set_groups")
          .insert(assignments);

        if (error) throw error;
      }

      toast({
        title: "Users Updated",
        description: `Users have been assigned to "${groupName}"`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to assign users",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCount = selectedUserIds.size;
  const originalCount = assignedUserIds.length;
  const hasChanges = selectedCount !== originalCount || 
    !assignedUserIds.every((id) => selectedUserIds.has(id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Assign Users to Group
          </DialogTitle>
          <DialogDescription>
            Select users to assign to "{groupName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="text-sm text-muted-foreground">
            {selectedCount} user{selectedCount !== 1 ? "s" : ""} selected
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            </div>
          ) : (
            <ScrollArea className="h-[300px] rounded-md border p-2">
              <div className="space-y-1">
                {filteredUsers.map((user) => {
                  const isSelected = selectedUserIds.has(user.id);
                  return (
                    <div
                      key={user.id}
                      className={`flex items-center gap-3 rounded-md p-2 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary/10"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => toggleUser(user.id)}
                    >
                      <Checkbox checked={isSelected} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{user.username}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {user.email}
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {user.role_name}
                      </Badge>
                    </div>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    No users found
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
