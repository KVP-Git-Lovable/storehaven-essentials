import { useState } from "react";
import { Pencil, Filter, ArrowUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface UserData {
  id: string;
  username: string;
  email: string;
  role_id: string | null;
  reports_to: string | null;
  status: string;
  role_name?: string;
  manager_name?: string;
}

interface ColumnFilter {
  username: string;
  email: string;
  role: string;
  manager: string;
}

interface UsersTableProps {
  users: UserData[];
  isLoading: boolean;
  visibleColumns: Record<string, boolean>;
  onUsernameClick: (userId: string) => void;
  onEdit: (user: UserData) => void;
  onStatusToggle: (user: UserData) => void;
  canEdit: boolean;
}

export function UsersTable({
  users,
  isLoading,
  visibleColumns,
  onUsernameClick,
  onEdit,
  onStatusToggle,
  canEdit,
}: UsersTableProps) {
  const [columnFilters, setColumnFilters] = useState<ColumnFilter>({
    username: "",
    email: "",
    role: "",
    manager: "",
  });
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc"
          ? { key, direction: "desc" }
          : null;
      }
      return { key, direction: "asc" };
    });
  };

  const filteredAndSortedUsers = users
    .filter((user) => {
      const matchesUsername = user.username
        .toLowerCase()
        .includes(columnFilters.username.toLowerCase());
      const matchesEmail = user.email
        .toLowerCase()
        .includes(columnFilters.email.toLowerCase());
      const matchesRole = !columnFilters.role || 
        (user.role_name?.toLowerCase() || "").includes(columnFilters.role.toLowerCase());
      const matchesManager = !columnFilters.manager ||
        (user.manager_name?.toLowerCase() || "").includes(columnFilters.manager.toLowerCase());
      return matchesUsername && matchesEmail && matchesRole && matchesManager;
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;
      let aVal = "";
      let bVal = "";
      
      switch (key) {
        case "username":
          aVal = a.username;
          bVal = b.username;
          break;
        case "email":
          aVal = a.email;
          bVal = b.email;
          break;
        case "role":
          aVal = a.role_name || "";
          bVal = b.role_name || "";
          break;
        case "manager":
          aVal = a.manager_name || "";
          bVal = b.manager_name || "";
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
      }
      
      const comparison = aVal.localeCompare(bVal);
      return direction === "asc" ? comparison : -comparison;
    });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const hasActiveFilters = Object.values(columnFilters).some((v) => v !== "");

  const clearFilters = () => {
    setColumnFilters({ username: "", email: "", role: "", manager: "" });
  };

  const ColumnHeader = ({
    label,
    filterKey,
    sortKey,
  }: {
    label: string;
    filterKey?: keyof ColumnFilter;
    sortKey?: string;
  }) => (
    <div className="flex items-center gap-1">
      <span>{label}</span>
      {sortKey && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => handleSort(sortKey)}
        >
          <ArrowUpDown className={cn(
            "h-3 w-3",
            sortConfig?.key === sortKey && "text-primary"
          )} />
        </Button>
      )}
      {filterKey && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
            >
              <Filter className={cn(
                "h-3 w-3",
                columnFilters[filterKey] && "text-primary fill-primary"
              )} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-3" align="start">
            <div className="space-y-2">
              <p className="text-sm font-medium">Filter by {label}</p>
              <Input
                placeholder={`Search ${label.toLowerCase()}...`}
                value={columnFilters[filterKey]}
                onChange={(e) =>
                  setColumnFilters((prev) => ({
                    ...prev,
                    [filterKey]: e.target.value,
                  }))
                }
                className="h-8"
              />
              {columnFilters[filterKey] && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    setColumnFilters((prev) => ({
                      ...prev,
                      [filterKey]: "",
                    }))
                  }
                >
                  Clear
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Active filters:</span>
          {columnFilters.username && (
            <Badge variant="secondary" className="gap-1">
              Username: {columnFilters.username}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setColumnFilters((prev) => ({ ...prev, username: "" }))}
              />
            </Badge>
          )}
          {columnFilters.email && (
            <Badge variant="secondary" className="gap-1">
              Email: {columnFilters.email}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setColumnFilters((prev) => ({ ...prev, email: "" }))}
              />
            </Badge>
          )}
          {columnFilters.role && (
            <Badge variant="secondary" className="gap-1">
              Role: {columnFilters.role}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setColumnFilters((prev) => ({ ...prev, role: "" }))}
              />
            </Badge>
          )}
          {columnFilters.manager && (
            <Badge variant="secondary" className="gap-1">
              Manager: {columnFilters.manager}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setColumnFilters((prev) => ({ ...prev, manager: "" }))}
              />
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      )}
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.photo && <TableHead className="w-[60px]">Photo</TableHead>}
              {visibleColumns.username && (
                <TableHead>
                  <ColumnHeader label="User Name" filterKey="username" sortKey="username" />
                </TableHead>
              )}
              {visibleColumns.email && (
                <TableHead>
                  <ColumnHeader label="Email" filterKey="email" sortKey="email" />
                </TableHead>
              )}
              {visibleColumns.role && (
                <TableHead>
                  <ColumnHeader label="Role" filterKey="role" sortKey="role" />
                </TableHead>
              )}
              {visibleColumns.manager && (
                <TableHead>
                  <ColumnHeader label="Reporting Manager" filterKey="manager" sortKey="manager" />
                </TableHead>
              )}
              {visibleColumns.status && (
                <TableHead>
                  <ColumnHeader label="Active" sortKey="status" />
                </TableHead>
              )}
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredAndSortedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedUsers.map((user) => (
                <TableRow key={user.id}>
                  {visibleColumns.photo && (
                    <TableCell>
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                          {getInitials(user.username)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                  )}
                  {visibleColumns.username && (
                    <TableCell>
                      <button
                        onClick={() => onUsernameClick(user.id)}
                        className="font-medium text-primary hover:underline cursor-pointer text-left"
                      >
                        {user.username}
                      </button>
                    </TableCell>
                  )}
                  {visibleColumns.email && <TableCell>{user.email}</TableCell>}
                  {visibleColumns.role && (
                    <TableCell>
                      {user.role_name ? (
                        <Badge variant="secondary">{user.role_name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Not Assigned</span>
                      )}
                    </TableCell>
                  )}
                  {visibleColumns.manager && (
                    <TableCell>{user.manager_name || "—"}</TableCell>
                  )}
                  {visibleColumns.status && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.status === "active"}
                          onCheckedChange={() => onStatusToggle(user)}
                          disabled={!canEdit}
                        />
                        <span className={cn(
                          "text-sm font-medium",
                          user.status === "active" ? "text-primary" : "text-muted-foreground"
                        )}>
                          {user.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(user)}
                        className="gap-1"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
