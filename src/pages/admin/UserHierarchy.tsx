import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, User, GitBranch, List, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  level?: number;
}

// Get level background color
const getLevelBgColor = (level: number) => {
  switch (level) {
    case 0:
      return "bg-muted/60";
    case 1:
      return "bg-blue-50 dark:bg-blue-950/30";
    case 2:
      return "bg-green-50 dark:bg-green-950/30";
    case 3:
      return "bg-yellow-50 dark:bg-yellow-950/30";
    default:
      return "bg-amber-50 dark:bg-amber-950/30";
  }
};

// Get level badge color
const getLevelBadgeColor = (level: number) => {
  switch (level) {
    case 0:
      return "bg-muted-foreground/20 text-foreground";
    case 1:
      return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    case 2:
      return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    case 3:
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
  }
};

// Get initials from name
const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

// Count all descendants recursively
const countDescendants = (node: UserNode): number => {
  if (node.children.length === 0) return 0;
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
};

// Hierarchical List Row Component
function HierarchyListRow({ 
  node, 
  level = 0,
  isLast = false 
}: { 
  node: UserNode; 
  level?: number;
  isLast?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const directReportsCount = node.children.length;

  return (
    <div className="relative">
      {/* Left connector line */}
      {level > 0 && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-px bg-border"
          style={{ left: `${(level - 1) * 24 + 12}px` }}
        />
      )}
      
      {/* Row */}
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg transition-colors mb-1",
          getLevelBgColor(level),
          hasChildren && "cursor-pointer hover:opacity-90"
        )}
        style={{ marginLeft: `${level * 24}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <button className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}

        {/* Avatar */}
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background border-2 border-border flex-shrink-0">
          <span className="text-sm font-semibold text-foreground">
            {getInitials(node.username)}
          </span>
        </div>

        {/* Name */}
        <span className="font-medium text-foreground">{node.username}</span>

        {/* Level Badge */}
        <Badge 
          variant="secondary" 
          className={cn("text-xs px-2", getLevelBadgeColor(level))}
        >
          L{level}
        </Badge>

        {/* Direct Reports Count */}
        {hasChildren && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="text-xs">{directReportsCount}</span>
          </div>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="relative">
          {node.children.map((child, index) => (
            <HierarchyListRow
              key={child.id}
              node={child}
              level={level + 1}
              isLast={index === node.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Tree Node Component - Org Chart Style
function OrgChartNode({ node, isRoot = false }: { node: UserNode; isRoot?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

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
            {node.children.map((child) => (
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
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Team Hierarchy</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Expand nodes to view reporting structure
              </p>
              {hierarchy.map((node) => (
                <HierarchyListRow key={node.id} node={node} level={0} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
