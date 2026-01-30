import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type UseStoreAccessReturn = {
  accessibleStoreIds: Set<string>;
  isAdmin: boolean;
  loading: boolean;
  filterByStore: <T extends Record<string, unknown>>(
    data: T[],
    storeIdField?: string
  ) => T[];
  hasAccess: (storeId: string) => boolean;
};

export function useStoreAccess(): UseStoreAccessReturn {
  const { user, isAdmin } = useAuth();
  const [accessibleStoreIds, setAccessibleStoreIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStoreAccess = async () => {
      if (!user?.id) {
        setAccessibleStoreIds(new Set());
        setLoading(false);
        return;
      }

      // Admins have access to all stores
      if (isAdmin) {
        const { data: allStores } = await supabase
          .from("stores")
          .select("id");
        
        setAccessibleStoreIds(new Set((allStores || []).map(s => s.id)));
        setLoading(false);
        return;
      }

      // Check store_user_access for explicit access records
      const { data: accessRecords } = await supabase
        .from("store_user_access")
        .select("store_id")
        .eq("user_id", user.id);

      if (accessRecords && accessRecords.length > 0) {
        // User has specific store access - only those stores
        setAccessibleStoreIds(new Set(accessRecords.map(r => r.store_id)));
      } else {
        // No specific access - show all non-restricted stores
        const { data: nonRestrictedStores } = await supabase
          .from("stores")
          .select("id")
          .eq("is_restricted", false);
        
        setAccessibleStoreIds(new Set((nonRestrictedStores || []).map(s => s.id)));
      }

      setLoading(false);
    };

    fetchStoreAccess();
  }, [user?.id, isAdmin]);

  const filterByStore = useCallback(<T extends Record<string, unknown>>(
    data: T[],
    storeIdField = "store_id"
  ): T[] => {
    // Admins see everything
    if (isAdmin) return data;

    // Filter data by accessible store IDs
    return data.filter(item => {
      const storeId = item[storeIdField];
      if (storeId === null || storeId === undefined) return true; // Include items without store association
      return accessibleStoreIds.has(storeId as string);
    });
  }, [accessibleStoreIds, isAdmin]);

  const hasAccess = useCallback((storeId: string): boolean => {
    if (isAdmin) return true;
    return accessibleStoreIds.has(storeId);
  }, [accessibleStoreIds, isAdmin]);

  return {
    accessibleStoreIds,
    isAdmin,
    loading,
    filterByStore,
    hasAccess,
  };
}
