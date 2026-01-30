import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RoleCount {
  role_name: string | null;
  count: number;
}

interface RoleCountBadgesProps {
  roleCounts: RoleCount[];
  totalCount: number;
  selectedRole: string | null;
  onRoleClick: (roleName: string | null) => void;
}

export function RoleCountBadges({
  roleCounts,
  totalCount,
  selectedRole,
  onRoleClick,
}: RoleCountBadgesProps) {
  return (
    <div className="space-y-1">
      <p className="text-2xl font-bold">Total Users: {totalCount}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {roleCounts.map((rc, index) => (
          <span key={rc.role_name || "unassigned"} className="flex items-center gap-1">
            {index > 0 && <span className="text-muted-foreground/50">|</span>}
            <button
              onClick={() => onRoleClick(selectedRole === rc.role_name ? null : rc.role_name)}
              className={cn(
                "hover:text-primary transition-colors cursor-pointer",
                selectedRole === rc.role_name && "text-primary font-medium"
              )}
            >
              {rc.role_name || "Unassigned"}: {rc.count}
            </button>
          </span>
        ))}
      </div>
      {selectedRole !== null && (
        <Badge
          variant="secondary"
          className="mt-2 cursor-pointer"
          onClick={() => onRoleClick(null)}
        >
          Filtered by: {selectedRole || "Unassigned"} ✕
        </Badge>
      )}
    </div>
  );
}
