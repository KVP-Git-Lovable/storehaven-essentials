import { useState, useEffect } from "react";
import { Loader2, Save, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { modules, parentModules, getChildModules } from "@/lib/modules";
import { PermissionSetGroupsList } from "@/components/admin/PermissionSetGroupsList";
import { PermissionSetGroupConfig } from "@/components/admin/PermissionSetGroupConfig";

interface Role {
  id: string;
  name: string;
}

interface Permission {
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export default function RolePermissions() {
  const [activeTab, setActiveTab] = useState<"role" | "groups">("role");
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [permissions, setPermissions] = useState<Map<string, Permission>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupRefreshTrigger, setGroupRefreshTrigger] = useState(0);
  const { toast } = useToast();
  const { profile, refreshPermissions } = useAuth();

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    if (selectedRoleId && activeTab === "role") {
      fetchRolePermissions(selectedRoleId);
    }
  }, [selectedRoleId, activeTab]);

  const fetchRoles = async () => {
    const { data } = await supabase
      .from("user_roles_master")
      .select("id, name")
      .eq("status", "active")
      .order("name");
    if (data && data.length > 0) {
      setRoles(data);
      setSelectedRoleId(data[0].id);
    }
  };

  const fetchRolePermissions = async (roleId: string) => {
    setIsLoading(true);
    const { data } = await supabase
      .from("role_permissions")
      .select("module_key, can_view, can_create, can_edit, can_delete")
      .eq("role_id", roleId);

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

    (data || []).forEach((p) => {
      permMap.set(p.module_key, p);
    });

    setPermissions(permMap);
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

  const handleSaveRolePermissions = async () => {
    if (!selectedRoleId) return;

    setIsSaving(true);

    // Delete existing permissions
    await supabase.from("role_permissions").delete().eq("role_id", selectedRoleId);

    // Insert new permissions (only those with at least one permission)
    const permissionsToInsert = Array.from(permissions.values())
      .filter((p) => p.can_view || p.can_create || p.can_edit || p.can_delete)
      .map((p) => ({
        role_id: selectedRoleId,
        module_key: p.module_key,
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
      }));

    if (permissionsToInsert.length > 0) {
      const { error } = await supabase.from("role_permissions").insert(permissionsToInsert);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to save permissions",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }
    }

    toast({
      title: "Permissions Saved",
      description: "Role permissions have been updated successfully.",
    });

    // If the saved role belongs to the current user, refresh their permissions immediately
    if (profile?.role_id === selectedRoleId) {
      await refreshPermissions();
    }

    setIsSaving(false);
  };

  const renderRoleModuleRow = (moduleKey: string, moduleName: string, isChild = false) => {
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

  const handleGroupRefresh = () => {
    setGroupRefreshTrigger((prev) => prev + 1);
    // Refresh current user's permissions in case they belong to the affected group
    refreshPermissions();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Permission Set</h1>
          <p className="text-muted-foreground">
            Configure module access for roles and permission set groups
          </p>
        </div>
        {activeTab === "role" && (
          <Button
            onClick={handleSaveRolePermissions}
            disabled={isSaving || !selectedRoleId}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Permissions
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "role" | "groups")}>
        <TabsList>
          <TabsTrigger value="role" className="gap-2">
            <Shield className="h-4 w-4" />
            Role Permissions
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-2">
            <Users className="h-4 w-4" />
            Permission Set Groups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="role" className="mt-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <CardTitle className="text-base">Select Role</CardTitle>
                <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : (
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
                          {renderRoleModuleRow(parent.key, parent.name)}
                          {getChildModules(parent.key).map((child) =>
                            renderRoleModuleRow(child.key, child.name, true)
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="mt-4">
          <Card className="overflow-hidden">
            <div className="flex h-[calc(100vh-280px)] min-h-[500px]">
              {/* Left Panel - Groups List */}
              <div className="w-[280px] border-r bg-muted/30">
                <PermissionSetGroupsList
                  selectedGroupId={selectedGroupId}
                  onSelectGroup={setSelectedGroupId}
                  refreshTrigger={groupRefreshTrigger}
                  onRefresh={handleGroupRefresh}
                />
              </div>

              {/* Right Panel - Group Configuration */}
              <div className="flex-1">
                <PermissionSetGroupConfig
                  groupId={selectedGroupId}
                  onRefresh={handleGroupRefresh}
                />
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
