import { createContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role_id: string | null;
  reports_to: string | null;
  status: string;
  role_name?: string;
  must_reset_password?: boolean;
  profile_photo_url?: string | null;
  theme_preference?: string | null;
}

export interface Permission {
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  permissions: Permission[];
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select(`
        id,
        username,
        email,
        role_id,
        reports_to,
        status,
        must_reset_password,
        profile_photo_url,
        theme_preference,
        user_roles_master (name)
      `)
      .eq("id", userId)
      .single();

    if (profileData) {
      const roleName = (profileData.user_roles_master as { name: string } | null)?.name;
      setProfile({
        id: profileData.id,
        username: profileData.username,
        email: profileData.email,
        role_id: profileData.role_id,
        reports_to: profileData.reports_to,
        status: profileData.status,
        role_name: roleName,
        must_reset_password: profileData.must_reset_password || false,
        profile_photo_url: profileData.profile_photo_url,
        theme_preference: (profileData as { theme_preference?: string | null }).theme_preference ?? null,
      });
      setIsAdmin(roleName?.toLowerCase() === "admin" || roleName?.toLowerCase() === "super admin");
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id);
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    const { data: permData } = await supabase.rpc("get_user_permissions", {
      _user_id: userId,
    });

    if (permData) {
      setPermissions(permData as Permission[]);
    }
  };

  const refreshPermissions = async () => {
    if (user?.id) {
      await fetchUserPermissions(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Defer Supabase calls with setTimeout to prevent deadlock
      if (session?.user) {
        setTimeout(() => {
          fetchUserProfile(session.user.id);
          fetchUserPermissions(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setPermissions([]);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
        fetchUserPermissions(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Live-refresh permissions when role/group permission tables change for this user.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`perm-refresh-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "role_permissions" },
        () => fetchUserPermissions(user.id)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "permission_set_group_permissions" },
        () => fetchUserPermissions(user.id)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_permission_set_groups" },
        () => fetchUserPermissions(user.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error as Error };
    }

    // Check if user is active
    if (data.user) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        await supabase.auth.signOut();
        return { error: new Error("Failed to verify user status") };
      }

      if (profileData?.status === "inactive") {
        // Sign out the inactive user immediately
        await supabase.auth.signOut();
        return { error: new Error("Your account has been deactivated. Please contact an administrator.") };
      }
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, username: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (!error && data.user) {
      // Create profile for the new user
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        username,
        email,
        status: "active",
      });

      if (profileError) {
        return { error: profileError as Error };
      }
    }

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setPermissions([]);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        permissions,
        isAdmin,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        refreshPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
