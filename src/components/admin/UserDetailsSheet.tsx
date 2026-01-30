import { useEffect, useState } from "react";
import { format } from "date-fns";
import { User, Mail, Shield, Building2, Calendar, Clock, Users } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface UserDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

interface UserDetails {
  id: string;
  username: string;
  email: string;
  status: string;
  created_at: string;
  updated_at: string;
  role_name: string | null;
  manager_name: string | null;
  stores: string[];
}

export function UserDetailsSheet({
  open,
  onOpenChange,
  userId,
}: UserDetailsSheetProps) {
  const [user, setUser] = useState<UserDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && userId) {
      fetchUserDetails();
    }
  }, [open, userId]);

  const fetchUserDetails = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      // Fetch user profile with role
      const { data: profile, error } = await supabase
        .from("profiles")
        .select(`
          id,
          username,
          email,
          status,
          created_at,
          updated_at,
          reports_to,
          user_roles_master (name)
        `)
        .eq("id", userId)
        .single();

      if (error) throw error;

      // Fetch manager name if exists
      let managerName = null;
      if (profile.reports_to) {
        const { data: manager } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", profile.reports_to)
          .single();
        managerName = manager?.username || null;
      }

      // Fetch store access
      const { data: storeAccess } = await supabase
        .from("store_user_access")
        .select("store_id, stores (name)")
        .eq("user_id", userId);

      const stores = storeAccess
        ?.map((access) => (access.stores as { name: string } | null)?.name)
        .filter(Boolean) as string[] || [];

      setUser({
        id: profile.id,
        username: profile.username,
        email: profile.email,
        status: profile.status,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        role_name: (profile.user_roles_master as { name: string } | null)?.name || null,
        manager_name: managerName,
        stores,
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "PPp");
    } catch {
      return "—";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Details
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-48" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-48" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
        ) : user ? (
          <div className="mt-6 space-y-6">
            {/* Account Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Account Information
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Username</p>
                    <p className="font-medium">{user.username}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Shield className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    {user.role_name ? (
                      <Badge variant="secondary">{user.role_name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-4 w-4 mt-1" />
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge
                      variant={user.status === "active" ? "default" : "destructive"}
                      className={user.status === "active" ? "" : "bg-destructive/10 text-destructive border-destructive/20"}
                    >
                      {user.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Organization */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Organization
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Users className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Reports To</p>
                    <p className="font-medium">{user.manager_name || "—"}</p>
                  </div>
                </div>
              </div>
            </div>

            {user.stores.length > 0 && (
              <>
                <Separator />

                {/* Store Access */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Store Access
                  </h3>
                  
                  <div className="flex items-start gap-3">
                    <Building2 className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div className="flex flex-wrap gap-2">
                      {user.stores.map((store, index) => (
                        <Badge key={index} variant="outline">
                          {store}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Timestamps */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Timestamps
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium text-sm">{formatDate(user.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p className="font-medium text-sm">{formatDate(user.updated_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 text-center text-muted-foreground">
            User not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
