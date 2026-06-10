import { useState, useEffect, useMemo } from "react";
import { Plus, Search, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { UserFormDialog } from "@/components/admin/UserFormDialog";
import { UserDetailsSheet } from "@/components/admin/UserDetailsSheet";
import { usePermissions } from "@/hooks/usePermissions";
import { UsersTable, UserData } from "@/components/admin/UsersTable";
import { RoleCountBadges } from "@/components/admin/RoleCountBadges";
import { ColumnVisibilityDropdown } from "@/components/admin/ColumnVisibilityDropdown";
import { useHierarchyAccess } from "@/hooks/useHierarchyAccess";
import { useAuth } from "@/hooks/useAuth";

export default function Users() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState({
    photo: true,
    username: true,
    email: true,
    role: true,
    manager: true,
    status: true,
  });
  const { toast } = useToast();
  const { hasPermission, isAdmin } = usePermissions();
  const { accessibleUserIds, loading: hierarchyLoading } = useHierarchyAccess();
  const { user: authUser } = useAuth();

  const canCreate = hasPermission("usermanagement.users", "create");
  const canEdit = hasPermission("usermanagement.users", "edit");
  const canDelete = hasPermission("usermanagement.users", "delete");

  const fetchUsers = async () => {
    setIsLoading(true);
    if (!authUser?.id) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc("get_users_for_management", {
      _viewer_id: authUser.id,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    setUsers(
      (data || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role_id: u.role_id,
        reports_to: u.reports_to,
        status: u.status,
        role_name: u.role_name ?? undefined,
        manager_name: u.manager_name ?? undefined,
      }))
    );
    setIsLoading(false);
  };

  useEffect(() => {
    if (!hierarchyLoading && authUser?.id) {
      fetchUsers();
    }
  }, [hierarchyLoading, authUser?.id]);

  // Users with admin/super-admin roles should always be visible
  // (organisational leadership is visible across the hierarchy)
  const isAdminRole = (roleName?: string | null) => {
    const r = roleName?.toLowerCase().replace(/[-_]/g, " ").trim();
    return r === "admin" || r === "super admin" || r === "superadmin";
  };

  // Calculate role counts based on hierarchy-filtered users
  const roleCounts = useMemo(() => {
    // Apply hierarchy filter first (admins are always included)
    const hierarchyFiltered = isAdmin 
      ? users 
      : users.filter(user => accessibleUserIds.has(user.id) || isAdminRole(user.role_name));
    
    const counts: Record<string, number> = {};
    hierarchyFiltered.forEach((user) => {
      const role = user.role_name || "Unassigned";
      counts[role] = (counts[role] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([role_name, count]) => ({
        role_name: role_name === "Unassigned" ? null : role_name,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [users, isAdmin, accessibleUserIds]);

  // Filter users based on hierarchy access, search, and role
  const filteredUsers = useMemo(() => {
    // First apply hierarchy filter (non-admins see accessible users + admins)
    const hierarchyFiltered = isAdmin 
      ? users 
      : users.filter(user => accessibleUserIds.has(user.id) || isAdminRole(user.role_name));

    return hierarchyFiltered.filter((user) => {
      const matchesSearch =
        searchQuery === "" ||
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.role_name && user.role_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesRole =
        selectedRoleFilter === null ||
        (selectedRoleFilter === null && !user.role_name) ||
        user.role_name === selectedRoleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, selectedRoleFilter, isAdmin, accessibleUserIds]);

  const handleEdit = (user: UserData) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleUsernameClick = (userId: string) => {
    setSelectedUserId(userId);
    setDetailsSheetOpen(true);
  };

  const handleStatusToggle = async (user: UserData) => {
    const newStatus = user.status === "active" ? "inactive" : "active";
    
    const { error } = await supabase
      .from("profiles")
      .update({ status: newStatus })
      .eq("id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Status Updated",
      description: `User ${user.username} is now ${newStatus}.`,
    });
    
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
    );
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to delete users",
          variant: "destructive",
        });
        return;
      }

      const response = await supabase.functions.invoke("delete-user", {
        body: { user_id: selectedUser.id },
      });

      if (response.error) {
        toast({
          title: "Error",
          description: response.error.message || "Failed to delete user",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "User Deleted",
        description: "User has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while deleting the user",
        variant: "destructive",
      });
    }
  };

  const toggleColumn = (column: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users & Roles Management</h1>
          <p className="text-muted-foreground">View and manage all user accounts and their assigned roles</p>
        </div>
        <div className="flex items-center gap-2">
          <ColumnVisibilityDropdown
            visibleColumns={visibleColumns}
            onToggle={toggleColumn}
          />
          <Button variant="outline" onClick={fetchUsers} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {canCreate && (
            <Button
              onClick={() => {
                setSelectedUser(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          )}
        </div>
      </div>

      <RoleCountBadges
        roleCounts={roleCounts}
        totalCount={isAdmin ? users.length : users.filter(u => accessibleUserIds.has(u.id) || isAdminRole(u.role_name)).length}
        selectedRole={selectedRoleFilter}
        onRoleClick={setSelectedRoleFilter}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, username, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <UsersTable
            users={filteredUsers}
            isLoading={isLoading}
            visibleColumns={visibleColumns}
            onUsernameClick={handleUsernameClick}
            onEdit={handleEdit}
            onDelete={(user) => {
              setSelectedUser(user);
              setDeleteDialogOpen(true);
            }}
            onStatusToggle={handleStatusToggle}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </CardContent>
      </Card>

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={selectedUser}
        onSuccess={fetchUsers}
      />

      <UserDetailsSheet
        open={detailsSheetOpen}
        onOpenChange={setDetailsSheetOpen}
        userId={selectedUserId}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedUser?.username}? This action cannot be
              undone.
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
