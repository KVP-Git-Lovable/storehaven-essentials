import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, User, GitBranch, List, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface UserNode {
  id: string;
  username: string;
  email: string;
  role_name?: string;
  status: string;
  reports_to?: string | null;
  reports_to_name?: string;
  children: UserNode[];
}

// Tree Node Component - Org Chart Style
function OrgChartNode({ node, isRoot = false }: { node: UserNode; isRoot?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Get color based on role
  const getRoleColor = (role?: string) => {
    if (!role) return "border-muted-foreground";
    const lowerRole = role.toLowerCase();
    if (lowerRole.includes("admin") || lowerRole.includes("super")) return "border-pink-500";
    if (lowerRole.includes("manager")) return "border-purple-500";
    return "border-blue-500";
  };

  return (
    <div className="flex flex-col items-center">
      {/* Node Card */}
      <div
        className={cn(
          "flex flex-col items-center cursor-pointer group",
          hasChildren && "mb-2"
        )}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <div
          className={cn(
            "relative w-16 h-16 rounded-full border-2 flex items-center justify-center bg-card shadow-sm transition-transform group-hover:scale-105",
            getRoleColor(node.role_name)
          )}
        >
          <span className="text-lg font-semibold text-foreground">
            {getInitials(node.username)}
          </span>
          {hasChildren && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center">
              {expanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          )}
        </div>
        <div className="mt-2 text-center max-w-[120px]">
          <p className="font-medium text-sm truncate">{node.username}</p>
          <p className="text-xs text-muted-foreground truncate">{node.role_name || "No Role"}</p>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="relative mt-4">
          {/* Vertical line from parent */}
          <div className="absolute left-1/2 -top-4 w-px h-4 bg-border" />
          
          {/* Horizontal line connecting children */}
          {node.children.length > 1 && (
            <div 
              className="absolute top-0 h-px bg-border"
              style={{
                left: `calc(50% - ${(node.children.length - 1) * 60}px)`,
                width: `${(node.children.length - 1) * 120}px`,
              }}
            />
          )}
          
          <div className="flex gap-6 pt-4">
            {node.children.map((child, index) => (
              <div key={child.id} className="relative">
                {/* Vertical line to child */}
                <div className="absolute left-1/2 -top-4 w-px h-4 bg-border" />
                <OrgChartNode node={child} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Collapsible Tree Node for compact view
function TreeNode({ node, level = 0 }: { node: UserNode; level?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors",
          level > 0 && "ml-6"
        )}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )
        ) : (
          <div className="w-4" />
        )}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{node.username}</span>
            {node.role_name && (
              <Badge variant="secondary" className="text-xs">
                {node.role_name}
              </Badge>
            )}
            <Badge
              variant={node.status === "active" ? "default" : "outline"}
              className="text-xs"
            >
              {node.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{node.email}</p>
        </div>
      </div>
      {expanded && hasChildren && (
        <div className="border-l-2 border-muted ml-5">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function UserHierarchy() {
  const [hierarchy, setHierarchy] = useState<UserNode[]>([]);
  const [flatUsers, setFlatUsers] = useState<UserNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");

  useEffect(() => {
    fetchHierarchy();
  }, []);

  const fetchHierarchy = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        username,
        email,
        reports_to,
        status,
        user_roles_master (name)
      `)
      .order("username");

    if (error) {
      setIsLoading(false);
      return;
    }

    // Build hierarchy tree
    const users = (data || []).map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      reports_to: u.reports_to,
      status: u.status,
      role_name: (u.user_roles_master as { name: string } | null)?.name,
      children: [] as UserNode[],
    }));

    // Create a map of users for quick lookup
    const userMap = new Map(users.map((u) => [u.id, u]));
    
    // Add reports_to_name for list view
    const usersWithReportsTo = users.map((u) => ({
      ...u,
      reports_to_name: u.reports_to ? userMap.get(u.reports_to)?.username : undefined,
    }));

    setFlatUsers(usersWithReportsTo);

    const roots: UserNode[] = [];

    users.forEach((user) => {
      if (user.reports_to && userMap.has(user.reports_to)) {
        const parent = userMap.get(user.reports_to)!;
        parent.children.push(user);
      } else {
        roots.push(user);
      }
    });

    setHierarchy(roots);
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">User Hierarchy</h1>
            <p className="text-muted-foreground">View organization structure and reporting lines</p>
          </div>
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          <Button
            variant={viewMode === "tree" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("tree")}
            className="gap-2"
          >
            <GitBranch className="h-4 w-4" />
            Tree
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="gap-2"
          >
            <List className="h-4 w-4" />
            List
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : hierarchy.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No users found. Add users and set their reporting structure.
            </div>
          ) : viewMode === "tree" ? (
            <div className="overflow-x-auto pb-4">
              <div className="min-w-max flex flex-wrap gap-8 justify-center p-4">
                {hierarchy.map((node) => (
                  <OrgChartNode key={node.id} node={node} isRoot />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Reports To</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flatUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{user.username}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        {user.role_name ? (
                          <Badge variant="secondary">{user.role_name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.reports_to_name ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                              <User className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <span>{user.reports_to_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === "active" ? "default" : "outline"}>
                          {user.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
