import { useState, useEffect } from "react";
import { Loader2, Save, UserPlus, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { modules, parentModules, getChildModules } from "@/lib/modules";
import { AssignUsersDialog } from "./AssignUsersDialog";

interface PermissionSetGroup {
  id: string;
  name: string;
  description: string | null;
  status: string;
}

interface Permission {
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface AssignedUser {
  id: string;
  username: string;
  email: string;
  role_name?: string;
}

interface PermissionSetGroupConfigProps {
  groupId: string | null;
  onRefresh: () => void;
}

export function PermissionSetGroupConfig({
  groupId,
  onRefresh,
}: PermissionSetGroupConfigProps) {
  const [group, setGroup] = useState<PermissionSetGroup | null>(null);
  const [permissions, setPermissions] = useState<Map<string, Permission>>(new Map());
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (groupId) {
      fetchGroupData(groupId);
    } else {
      setGroup(null);
      setPermissions(new Map());
      setAssignedUsers([]);
    }
  }, [groupId]);

  const fetchGroupData = async (id: string) => {
    setIsLoading(true);

    // Fetch group details
    const { data: groupData } = await supabase
      .from("permission_set_groups")
      .select("*")
      .eq("id", id)
      .single();

    if (groupData) {
      setGroup(groupData);
    }

    // Fetch group permissions
    const { data: permsData } = await supabase
      .from("permission_set_group_permissions")
      .select("module_key, can_view, can_create, can_edit, can_delete")
      .eq("group_id", id);

    const permMap = new Map<string, Permission>();
    modules.forEach((m) => {
      permMap.set(m.key, {
        module_key: m.key,
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      });
    });

    (permsData || []).forEach((p) => {
      permMap.set(p.module_key, p);
    });

    setPermissions(permMap);

    // Fetch assigned users
    const { data: assignmentsData } = await supabase
      .from("user_permission_set_groups")
      .select(`
        user_id,
        profiles:user_id (
          id,
          username,
          email,
          user_roles_master:role_id (name)
        )
      `)
      .eq("group_id", id);

    if (assignmentsData) {
      const users = assignmentsData.map((a: any) => ({
        id: a.profiles.id,
        username: a.profiles.username,
        email: a.profiles.email,
        role_name: a.profiles.user_roles_master?.name || "No Role",
      }));
      setAssignedUsers(users);
    }

    setIsLoading(false);
  };

  const togglePermission = (
    moduleKey: string,
    action: "can_view" | "can_create" | "can_edit" | "can_delete"
  ) => {
    setPermissions((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(moduleKey);
      if (current) {
        const newValue = !current[action];
        newMap.set(moduleKey, { ...current, [action]: newValue });

        // If toggling a parent module, also toggle children
        const children = getChildModules(moduleKey);
        children.forEach((child) => {
          const childPerm = newMap.get(child.key);
          if (childPerm) {
            newMap.set(child.key, { ...childPerm, [action]: newValue });
          }
        });
      }
      return newMap;
    });
  };

  const toggleAllForModule = (moduleKey: string, checked: boolean) => {
    setPermissions((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(moduleKey);
      if (current) {
        newMap.set(moduleKey, {
          ...current,
          can_view: checked,
          can_create: checked,
          can_edit: checked,
          can_delete: checked,
        });

        // Also toggle children
        const children = getChildModules(moduleKey);
        children.forEach((child) => {
          const childPerm = newMap.get(child.key);
          if (childPerm) {
            newMap.set(child.key, {
              ...childPerm,
              can_view: checked,
              can_create: checked,
              can_edit: checked,
              can_delete: checked,
            });
          }
        });
      }
      return newMap;
    });
  };

  const handleSave = async () => {
    if (!groupId) return;

    setIsSaving(true);

    try {
      // Delete existing permissions
      await supabase
        .from("permission_set_group_permissions")
        .delete()
        .eq("group_id", groupId);

      // Insert new permissions
      const permissionsToInsert = Array.from(permissions.values())
        .filter((p) => p.can_view || p.can_create || p.can_edit || p.can_delete)
        .map((p) => ({
          group_id: groupId,
          module_key: p.module_key,
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
        }));

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase
          .from("permission_set_group_permissions")
          .insert(permissionsToInsert);

        if (error) throw error;
      }

      toast({
        title: "Permissions Saved",
        description: "Group permissions have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save permissions",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!groupId) return;

    try {
      const { error } = await supabase
        .from("user_permission_set_groups")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", userId);

      if (error) throw error;

      setAssignedUsers((prev) => prev.filter((u) => u.id !== userId));
      onRefresh();

      toast({
        title: "User Removed",
        description: "User has been removed from this group.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove user",
        variant: "destructive",
      });
    }
  };

  const handleAssignDialogSuccess = () => {
    if (groupId) {
      fetchGroupData(groupId);
    }
    onRefresh();
  };

  const renderModuleRow = (moduleKey: string, moduleName: string, isChild = false) => {
    const perm = permissions.get(moduleKey);
    if (!perm) return null;

    const allChecked = perm.can_view && perm.can_create && perm.can_edit && perm.can_delete;

    return (
      <TableRow key={moduleKey}>
        <TableCell className={isChild ? "pl-8" : "font-medium"}>
          {isChild && <span className="text-muted-foreground mr-2">└</span>}
          {moduleName}
        </TableCell>
        <TableCell className="text-center">
          <Checkbox
            checked={allChecked}
            onCheckedChange={(checked) => toggleAllForModule(moduleKey, !!checked)}
          />
        </TableCell>
        <TableCell className="text-center">
          <Checkbox
            checked={perm.can_view}
            onCheckedChange={() => togglePermission(moduleKey, "can_view")}
          />
        </TableCell>
        <TableCell className="text-center">
          <Checkbox
            checked={perm.can_create}
            onCheckedChange={() => togglePermission(moduleKey, "can_create")}
          />
        </TableCell>
        <TableCell className="text-center">
          <Checkbox
            checked={perm.can_edit}
            onCheckedChange={() => togglePermission(moduleKey, "can_edit")}
          />
        </TableCell>
        <TableCell className="text-center">
          <Checkbox
            checked={perm.can_delete}
            onCheckedChange={() => togglePermission(moduleKey, "can_delete")}
          />
        </TableCell>
      </TableRow>
    );
  };

  if (!groupId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a group to configure permissions</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Group not found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{group.name}</h2>
              {group.status === "inactive" && (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            {group.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {group.description}
              </p>
            )}
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Permissions
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Permissions Matrix */}
          <div>
            <h3 className="text-sm font-medium mb-3">Permissions</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Module</TableHead>
                    <TableHead className="text-center w-[80px]">All</TableHead>
                    <TableHead className="text-center w-[80px]">View</TableHead>
                    <TableHead className="text-center w-[80px]">Create</TableHead>
                    <TableHead className="text-center w-[80px]">Edit</TableHead>
                    <TableHead className="text-center w-[80px]">Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parentModules.map((parent) => (
                    <>
                      {renderModuleRow(parent.key, parent.name)}
                      {getChildModules(parent.key).map((child) =>
                        renderModuleRow(child.key, child.name, true)
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <Separator />

          {/* Assigned Users */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">
                Assigned Users ({assignedUsers.length})
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssignDialogOpen(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add Users
              </Button>
            </div>

            {assignedUsers.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
                No users assigned to this group yet.
                <br />
                Click "Add Users" to assign users.
              </div>
            ) : (
              <div className="rounded-md border divide-y">
                {assignedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">{user.username}</div>
                        <div className="text-sm text-muted-foreground">
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{user.role_name}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRemoveUser(user.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <AssignUsersDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        groupId={groupId}
        groupName={group.name}
        assignedUserIds={assignedUsers.map((u) => u.id)}
        onSuccess={handleAssignDialogSuccess}
      />
    </div>
  );
}
