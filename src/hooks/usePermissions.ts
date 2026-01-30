import { useAuth } from "./useAuth";
import { routeToModuleKey } from "@/lib/modules";

export interface Permission {
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

// Safe default for when auth is not ready
const defaultPermissions = {
  permissions: [] as Permission[],
  hasPermission: () => false,
  canAccessRoute: () => false,
  getVisibleModules: () => [] as string[],
  isAdmin: false,
  loading: true,
};

export function usePermissions() {
  const { permissions, isAdmin, loading } = useAuth();

  const hasPermission = (moduleKey: string, action: "view" | "create" | "edit" | "delete" = "view"): boolean => {
    // Admins have all permissions
    if (isAdmin) return true;

    // Find permission for this module
    const permission = permissions.find((p) => p.module_key === moduleKey);
    if (!permission) {
      // Check parent module permission
      const parentKey = moduleKey.split(".")[0];
      if (parentKey !== moduleKey) {
        const parentPermission = permissions.find((p) => p.module_key === parentKey);
        if (parentPermission) {
          switch (action) {
            case "view":
              return parentPermission.can_view;
            case "create":
              return parentPermission.can_create;
            case "edit":
              return parentPermission.can_edit;
            case "delete":
              return parentPermission.can_delete;
          }
        }
      }
      return false;
    }

    switch (action) {
      case "view":
        return permission.can_view;
      case "create":
        return permission.can_create;
      case "edit":
        return permission.can_edit;
      case "delete":
        return permission.can_delete;
      default:
        return false;
    }
  };

  const canAccessRoute = (route: string): boolean => {
    if (isAdmin) return true;
    const moduleKey = routeToModuleKey[route];
    if (!moduleKey) return true; // Allow access to unmapped routes
    return hasPermission(moduleKey, "view");
  };

  const getVisibleModules = (): string[] => {
    if (isAdmin) {
      return Object.values(routeToModuleKey);
    }
    return permissions.filter((p) => p.can_view).map((p) => p.module_key);
  };

  return {
    permissions,
    hasPermission,
    canAccessRoute,
    getVisibleModules,
    isAdmin,
    loading,
  };
}
