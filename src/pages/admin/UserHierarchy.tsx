import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface UserNode {
  id: string;
  username: string;
  email: string;
  role_name?: string;
  status: string;
  children: UserNode[];
}

function TreeNode({ node, level = 0 }: { node: UserNode; level?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer",
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
  const [isLoading, setIsLoading] = useState(true);

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

    const userMap = new Map(users.map((u) => [u.id, u]));
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
      <div>
        <h1 className="text-2xl font-semibold">User Hierarchy</h1>
        <p className="text-muted-foreground">View organization structure and reporting lines</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Tree</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : hierarchy.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No users found. Add users and set their reporting structure.
            </div>
          ) : (
            <div className="space-y-1">
              {hierarchy.map((node) => (
                <TreeNode key={node.id} node={node} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
