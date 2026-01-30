import { useState, useEffect } from "react";
import { Loader2, Save, Shield, User } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { modules, parentModules, getChildModules } from "@/lib/modules";

interface Role {
  id: string;
  name: string;
}

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role_id: string | null;
  role_name?: string;
}

interface Permission {
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export default function RolePermissions() {
  const [activeTab, setActiveTab] = useState<"role" | "user">("role");
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [permissions, setPermissions] = useState<Map<string, Permission>>(new Map());
  const [rolePermissions, setRolePermissions] = useState<Map<string, Permission>>(new Map());
  const [userPermissions, setUserPermissions] = useState<Map<string, Permission>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedRoleId && activeTab === "role") {
      fetchRolePermissions(selectedRoleId);
    }
  }, [selectedRoleId, activeTab]);

  useEffect(() => {
    if (selectedUserId && activeTab === "user") {
      fetchUserPermissions(selectedUserId);
    }
  }, [selectedUserId, activeTab]);

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

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select(`
        id,
        username,
        email,
        role_id,
        user_roles_master:role_id (name)
      `)
      .eq("status", "active")
      .order("username");
    
    if (data && data.length > 0) {
      const usersWithRoles = data.map((u: any) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role_id: u.role_id,
        role_name: u.user_roles_master?.name || "No Role",
      }));
      setUsers(usersWithRoles);
      setSelectedUserId(usersWithRoles[0].id);
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

  const fetchUserPermissions = async (userId: string) => {
    setIsLoading(true);

    // Get role permissions for this user (as base)
    const { data: rolePermsData } = await supabase.rpc("get_role_permissions_for_user", {
      _user_id: userId,
    });

    // Get user-specific permissions
    const { data: userPermsData } = await supabase
      .from("user_permissions")
      .select("module_key, can_view, can_create, can_edit, can_delete")
      .eq("user_id", userId);

    const roleMap = new Map<string, Permission>();
    const userMap = new Map<string, Permission>();
    const combinedMap = new Map<string, Permission>();

    // Initialize all modules
    modules.forEach((m) => {
      const emptyPerm = {
        module_key: m.key,
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      };
      roleMap.set(m.key, { ...emptyPerm });
      userMap.set(m.key, { ...emptyPerm });
      combinedMap.set(m.key, { ...emptyPerm });
    });

    // Set role permissions
    (rolePermsData || []).forEach((p: Permission) => {
      roleMap.set(p.module_key, p);
      combinedMap.set(p.module_key, { ...p });
    });

    // Set user-specific permissions (overrides)
    (userPermsData || []).forEach((p: Permission) => {
      userMap.set(p.module_key, p);
      // Merge with role permissions (user permissions add to role permissions)
      const combined = combinedMap.get(p.module_key);
      if (combined) {
        combinedMap.set(p.module_key, {
          module_key: p.module_key,
          can_view: combined.can_view || p.can_view,
          can_create: combined.can_create || p.can_create,
          can_edit: combined.can_edit || p.can_edit,
          can_delete: combined.can_delete || p.can_delete,
        });
      }
    });

    setRolePermissions(roleMap);
    setUserPermissions(userMap);
    setPermissions(combinedMap);
    setIsLoading(false);
  };

  const togglePermission = (
    moduleKey: string,
    action: "can_view" | "can_create" | "can_edit" | "can_delete"
  ) => {
    if (activeTab === "role") {
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
    } else {
      // For user permissions, toggle the user-specific override
      setUserPermissions((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(moduleKey);
        if (current) {
          const newValue = !current[action];
          newMap.set(moduleKey, { ...current, [action]: newValue });

          // Also toggle children
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

      // Update combined permissions view
      setPermissions((prev) => {
        const newMap = new Map(prev);
        const rolePerm = rolePermissions.get(moduleKey);
        const userPerm = userPermissions.get(moduleKey);
        const newUserValue = userPerm ? !userPerm[action] : true;

        const combined = {
          module_key: moduleKey,
          can_view: action === "can_view" ? (rolePerm?.can_view || newUserValue) : (rolePerm?.can_view || userPerm?.can_view || false),
          can_create: action === "can_create" ? (rolePerm?.can_create || newUserValue) : (rolePerm?.can_create || userPerm?.can_create || false),
          can_edit: action === "can_edit" ? (rolePerm?.can_edit || newUserValue) : (rolePerm?.can_edit || userPerm?.can_edit || false),
          can_delete: action === "can_delete" ? (rolePerm?.can_delete || newUserValue) : (rolePerm?.can_delete || userPerm?.can_delete || false),
        };
        newMap.set(moduleKey, combined);

        // Handle children
        const children = getChildModules(moduleKey);
        children.forEach((child) => {
          const childRolePerm = rolePermissions.get(child.key);
          const childUserPerm = userPermissions.get(child.key);
          const childNewUserValue = childUserPerm ? !childUserPerm[action] : newUserValue;
          
          newMap.set(child.key, {
            module_key: child.key,
            can_view: action === "can_view" ? (childRolePerm?.can_view || childNewUserValue) : (childRolePerm?.can_view || childUserPerm?.can_view || false),
            can_create: action === "can_create" ? (childRolePerm?.can_create || childNewUserValue) : (childRolePerm?.can_create || childUserPerm?.can_create || false),
            can_edit: action === "can_edit" ? (childRolePerm?.can_edit || childNewUserValue) : (childRolePerm?.can_edit || childUserPerm?.can_edit || false),
            can_delete: action === "can_delete" ? (childRolePerm?.can_delete || childNewUserValue) : (childRolePerm?.can_delete || childUserPerm?.can_delete || false),
          });
        });

        return newMap;
      });
    }
  };

  const toggleAllForModule = (moduleKey: string, checked: boolean) => {
    if (activeTab === "role") {
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
    } else {
      setUserPermissions((prev) => {
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

      // Update combined view
      setPermissions((prev) => {
        const newMap = new Map(prev);
        const updateModule = (key: string) => {
          const rolePerm = rolePermissions.get(key);
          newMap.set(key, {
            module_key: key,
            can_view: (rolePerm?.can_view || false) || checked,
            can_create: (rolePerm?.can_create || false) || checked,
            can_edit: (rolePerm?.can_edit || false) || checked,
            can_delete: (rolePerm?.can_delete || false) || checked,
          });
        };

        updateModule(moduleKey);
        getChildModules(moduleKey).forEach((child) => updateModule(child.key));

        return newMap;
      });
    }
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
    setIsSaving(false);
  };

  const handleSaveUserPermissions = async () => {
    if (!selectedUserId) return;

    setIsSaving(true);

    // Delete existing user permissions
    await supabase.from("user_permissions").delete().eq("user_id", selectedUserId);

    // Insert new user-specific permissions (only overrides that add permissions beyond role)
    const permissionsToInsert = Array.from(userPermissions.values())
      .filter((p) => p.can_view || p.can_create || p.can_edit || p.can_delete)
      .map((p) => ({
        user_id: selectedUserId,
        module_key: p.module_key,
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
      }));

    if (permissionsToInsert.length > 0) {
      const { error } = await supabase.from("user_permissions").insert(permissionsToInsert);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to save user permissions",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }
    }

    toast({
      title: "Permissions Saved",
      description: "User permissions have been updated successfully.",
    });
    setIsSaving(false);
  };

  const handleSave = () => {
    if (activeTab === "role") {
      handleSaveRolePermissions();
    } else {
      handleSaveUserPermissions();
    }
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

  const renderUserModuleRow = (moduleKey: string, moduleName: string, isChild = false) => {
    const combinedPerm = permissions.get(moduleKey);
    const rolePerm = rolePermissions.get(moduleKey);
    const userPerm = userPermissions.get(moduleKey);
    if (!combinedPerm) return null;

    const userAllChecked = userPerm && userPerm.can_view && userPerm.can_create && userPerm.can_edit && userPerm.can_delete;

    const renderCheckbox = (action: "can_view" | "can_create" | "can_edit" | "can_delete") => {
      const fromRole = rolePerm?.[action] || false;
      const fromUser = userPerm?.[action] || false;
      const combined = combinedPerm[action];

      return (
        <div className="flex items-center justify-center gap-1">
          <Checkbox
            checked={combined}
            disabled={fromRole}
            onCheckedChange={() => togglePermission(moduleKey, action)}
            className={fromRole ? "opacity-50" : ""}
          />
          {fromRole && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">R</Badge>
          )}
          {fromUser && !fromRole && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary text-primary">U</Badge>
          )}
        </div>
      );
    };

    return (
      <TableRow key={moduleKey}>
        <TableCell className={isChild ? "pl-8" : "font-medium"}>
          {isChild && <span className="text-muted-foreground mr-2">└</span>}
          {moduleName}
        </TableCell>
        <TableCell className="text-center">
          <Checkbox
            checked={userAllChecked}
            onCheckedChange={(checked) => toggleAllForModule(moduleKey, !!checked)}
          />
        </TableCell>
        <TableCell className="text-center">{renderCheckbox("can_view")}</TableCell>
        <TableCell className="text-center">{renderCheckbox("can_create")}</TableCell>
        <TableCell className="text-center">{renderCheckbox("can_edit")}</TableCell>
        <TableCell className="text-center">{renderCheckbox("can_delete")}</TableCell>
      </TableRow>
    );
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Permissions Management</h1>
          <p className="text-muted-foreground">
            Configure module access for roles and individual users
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || (!selectedRoleId && activeTab === "role") || (!selectedUserId && activeTab === "user")}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Permissions
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "role" | "user")}>
        <TabsList>
          <TabsTrigger value="role" className="gap-2">
            <Shield className="h-4 w-4" />
            Role Permissions
          </TabsTrigger>
          <TabsTrigger value="user" className="gap-2">
            <User className="h-4 w-4" />
            User Permissions
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

        <TabsContent value="user" className="mt-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex items-center gap-4">
                  <CardTitle className="text-base">Select User</CardTitle>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.username} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedUser && (
                  <Badge variant="secondary">
                    Role: {selectedUser.role_name}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                <Badge variant="secondary" className="text-[10px] px-1 py-0 mr-1">R</Badge>
                = From Role (cannot uncheck) | 
                <Badge variant="outline" className="text-[10px] px-1 py-0 mx-1 border-primary text-primary">U</Badge>
                = User Override (additional permission)
              </p>
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
                        <TableHead className="text-center w-[80px]">All (User)</TableHead>
                        <TableHead className="text-center w-[100px]">View</TableHead>
                        <TableHead className="text-center w-[100px]">Create</TableHead>
                        <TableHead className="text-center w-[100px]">Edit</TableHead>
                        <TableHead className="text-center w-[100px]">Delete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parentModules.map((parent) => (
                        <>
                          {renderUserModuleRow(parent.key, parent.name)}
                          {getChildModules(parent.key).map((child) =>
                            renderUserModuleRow(child.key, child.name, true)
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
      </Tabs>
    </div>
  );
}
