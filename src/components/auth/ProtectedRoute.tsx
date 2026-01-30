import { ReactNode, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { ForcePasswordResetDialog } from "./ForcePasswordResetDialog";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const [passwordResetComplete, setPasswordResetComplete] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Show password reset dialog if user must reset their password
  const mustResetPassword = profile?.must_reset_password && !passwordResetComplete;

  return (
    <>
      {mustResetPassword && profile?.id && (
        <ForcePasswordResetDialog
          open={true}
          userId={profile.id}
          onSuccess={() => setPasswordResetComplete(true)}
        />
      )}
      {children}
    </>
  );
}
