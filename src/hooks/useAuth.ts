import { useContext } from "react";
import { AuthContext } from "@/components/auth/AuthProvider";

// Default context value when AuthProvider is not available
const defaultAuthContext = {
  user: null,
  session: null,
  profile: null,
  permissions: [],
  isAdmin: false,
  loading: true,
  signIn: async () => ({ error: new Error("Auth not initialized") }),
  signUp: async () => ({ error: new Error("Auth not initialized") }),
  signOut: async () => {},
};

export function useAuth() {
  const context = useContext(AuthContext);
  // Return default context if not within AuthProvider (prevents crashes during route transitions)
  if (!context) {
    return defaultAuthContext;
  }
  return context;
}
