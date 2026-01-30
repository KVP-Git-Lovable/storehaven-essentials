import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const userSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  role_id: z.string().optional(),
  reports_to: z.string().optional(),
  status: z.enum(["active", "inactive"]),
});

type UserFormData = z.infer<typeof userSchema>;

interface Role {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  username: string;
}

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: {
    id: string;
    username: string;
    email: string;
    role_id: string | null;
    reports_to: string | null;
    status: string;
  } | null;
  onSuccess: () => void;
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: UserFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const { toast } = useToast();
  const isEditing = !!user;

  const form = useForm<UserFormData>({
    resolver: zodResolver(
      isEditing
        ? userSchema.extend({ password: z.string().optional() })
        : userSchema.extend({
            password: z.string().min(8, "Password must be at least 8 characters"),
          })
    ),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      role_id: "",
      reports_to: "",
      status: "active",
    },
  });

  useEffect(() => {
    if (open) {
      fetchRoles();
      fetchProfiles();
      if (user) {
        form.reset({
          username: user.username,
          email: user.email,
          password: "",
          role_id: user.role_id || "",
          reports_to: user.reports_to || "",
          status: user.status as "active" | "inactive",
        });
      } else {
        form.reset({
          username: "",
          email: "",
          password: "",
          role_id: "",
          reports_to: "",
          status: "active",
        });
      }
    }
  }, [open, user, form]);

  const fetchRoles = async () => {
    const { data } = await supabase
      .from("user_roles_master")
      .select("id, name")
      .eq("status", "active")
      .order("name");
    if (data) setRoles(data);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("status", "active")
      .order("username");
    if (data) setProfiles(data.filter((p) => p.id !== user?.id));
  };

  const handleSubmit = async (data: UserFormData) => {
    setIsLoading(true);

    try {
      if (isEditing) {
        // Update existing profile
        const { error } = await supabase
          .from("profiles")
          .update({
            username: data.username,
            email: data.email,
            role_id: data.role_id || null,
            reports_to: data.reports_to || null,
            status: data.status,
          })
          .eq("id", user.id);

        if (error) throw error;

        toast({
          title: "User Updated",
          description: "User has been updated successfully.",
        });
      } else {
        // Create new user via Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: data.email,
          password: data.password!,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (authError) throw authError;

        if (authData.user) {
          // Create profile with must_reset_password flag
          const { error: profileError } = await supabase.from("profiles").insert({
            id: authData.user.id,
            username: data.username,
            email: data.email,
            role_id: data.role_id || null,
            reports_to: data.reports_to || null,
            status: data.status,
            must_reset_password: true, // User must reset password on first login
          });

          if (profileError) throw profileError;
        }

        toast({
          title: "User Created",
          description: "New user has been created successfully.",
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const err = error as Error;
      toast({
        title: "Error",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit User" : "Create User"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username *</Label>
            <Input id="username" {...form.register("username")} />
            {form.formState.errors.username && (
              <p className="text-sm text-destructive">
                {form.formState.errors.username.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" {...form.register("email")} disabled={isEditing} />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...form.register("password")}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="role">User Role</Label>
            <Select
              value={form.watch("role_id")}
              onValueChange={(value) => form.setValue("role_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reports_to">Reports To</Label>
            <Select
              value={form.watch("reports_to")}
              onValueChange={(value) => form.setValue("reports_to", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select manager" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={form.watch("status")}
              onValueChange={(value) =>
                form.setValue("status", value as "active" | "inactive")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
