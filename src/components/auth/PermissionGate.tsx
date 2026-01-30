import { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";

interface PermissionGateProps {
  moduleKey: string;
  action?: "view" | "create" | "edit" | "delete";
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({
  moduleKey,
  action = "view",
  children,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return null;
  }

  if (!hasPermission(moduleKey, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
