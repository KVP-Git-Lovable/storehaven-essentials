import { useState, useEffect } from "react";
import { Plus, Search, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { RoleFormDialog } from "@/components/admin/RoleFormDialog";
import { usePermissions } from "@/hooks/usePermissions";

interface Role {
  id: string;
  name: string;
  description: string | null;
  status: string;
  user_count: number;
}

export default function UserRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [filteredRoles, setFilteredRoles] = useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const { toast } = useToast();
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission("usermanagement.roles", "create");
  const canEdit = hasPermission("usermanagement.roles", "edit");
  const canDelete = hasPermission("usermanagement.roles", "delete");

  const fetchRoles = async () => {
    setIsLoading(true);
    const { data: rolesData, error } = await supabase
      .from("user_roles_master")
      .select("id, name, description, status")
      .order("name");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch roles",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Get user counts for each role
    const rolesWithCounts = await Promise.all(
      (rolesData || []).map(async (role) => {
        const { count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role_id", role.id);
        return { ...role, user_count: count || 0 };
      })
    );

    setRoles(rolesWithCounts);
    setFilteredRoles(rolesWithCounts);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    const filtered = roles.filter(
      (role) =>
        role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (role.description && role.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    setFilteredRoles(filtered);
  }, [searchQuery, roles]);

  const handleEdit = (role: Role) => {
    setSelectedRole(role);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedRole) return;

    // First, clear role_id from all users with this role
    if (selectedRole.user_count > 0) {
      const { error: clearError } = await supabase
        .from("profiles")
        .update({ role_id: null })
        .eq("role_id", selectedRole.id);

      if (clearError) {
        toast({
          title: "Error",
          description: "Failed to clear user role assignments",
          variant: "destructive",
        });
        return;
      }
    }

    // Delete associated role permissions
    const { error: permError } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", selectedRole.id);

    if (permError) {
      toast({
        title: "Error",
        description: "Failed to delete role permissions",
        variant: "destructive",
      });
      return;
    }

    // Finally delete the role
    const { error } = await supabase
      .from("user_roles_master")
      .delete()
      .eq("id", selectedRole.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete role",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Role Deleted",
      description: `Role and ${selectedRole.user_count} user assignment(s) have been cleared.`,
    });
    setDeleteDialogOpen(false);
    setSelectedRole(null);
    fetchRoles();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">User Roles</h1>
          <p className="text-muted-foreground">Manage user roles and their definitions</p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setSelectedRole(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Role
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No roles found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {role.description || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {role.user_count}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={role.status === "active" ? "default" : "secondary"}
                      >
                        {role.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(role)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedRole(role);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RoleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        role={selectedRole}
        onSuccess={fetchRoles}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{selectedRole?.name}" role? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
