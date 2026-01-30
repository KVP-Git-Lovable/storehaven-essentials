import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type UseHierarchyAccessReturn = {
  accessibleUserIds: Set<string>;
  subordinateUserIds: Set<string>;
  isAdmin: boolean;
  loading: boolean;
  filterByUser: <T extends Record<string, unknown>>(
    data: T[],
    userIdField?: string
  ) => T[];
  hasAccessToUser: (userId: string) => boolean;
  canManageUser: (userId: string) => boolean;
};

export function useHierarchyAccess(): UseHierarchyAccessReturn {
  const { user, isAdmin } = useAuth();
  const [accessibleUserIds, setAccessibleUserIds] = useState<Set<string>>(new Set());
  const [subordinateUserIds, setSubordinateUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHierarchyAccess = async () => {
      if (!user?.id) {
        setAccessibleUserIds(new Set());
        setSubordinateUserIds(new Set());
        setLoading(false);
        return;
      }

      // Admins have access to all users
      if (isAdmin) {
        const { data: allUsers } = await supabase
          .from("profiles")
          .select("id");
        
        setAccessibleUserIds(new Set((allUsers || []).map(u => u.id)));
        setSubordinateUserIds(new Set((allUsers || []).map(u => u.id)));
        setLoading(false);
        return;
      }

      // Get subordinates via database function
      const { data: subordinates, error } = await supabase
        .rpc("get_subordinate_user_ids", { _user_id: user.id });

      if (error) {
        console.error("Error fetching subordinates:", error);
        // Fallback: user can only see themselves
        setAccessibleUserIds(new Set([user.id]));
        setSubordinateUserIds(new Set());
        setLoading(false);
        return;
      }

      // The RPC returns an array of UUIDs directly
      const subIds = new Set<string>((subordinates || []) as string[]);
      
      // Accessible = self + subordinates
      const accessibleIds = new Set([user.id, ...subIds]);

      setSubordinateUserIds(subIds);
      setAccessibleUserIds(accessibleIds);
      setLoading(false);
    };

    fetchHierarchyAccess();
  }, [user?.id, isAdmin]);

  const filterByUser = useCallback(<T extends Record<string, unknown>>(
    data: T[],
    userIdField = "user_id"
  ): T[] => {
    // Admins see everything
    if (isAdmin) return data;

    // Filter data by accessible user IDs
    return data.filter(item => {
      const userId = item[userIdField];
      // Include items without user association
      if (userId === null || userId === undefined) return true;
      return accessibleUserIds.has(userId as string);
    });
  }, [accessibleUserIds, isAdmin]);

  const hasAccessToUser = useCallback((userId: string): boolean => {
    if (isAdmin) return true;
    return accessibleUserIds.has(userId);
  }, [accessibleUserIds, isAdmin]);

  const canManageUser = useCallback((userId: string): boolean => {
    if (isAdmin) return true;
    return subordinateUserIds.has(userId);
  }, [subordinateUserIds, isAdmin]);

  return {
    accessibleUserIds,
    subordinateUserIds,
    isAdmin,
    loading,
    filterByUser,
    hasAccessToUser,
    canManageUser,
  };
}
