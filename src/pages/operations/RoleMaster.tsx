import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, Users, Sun, Sunset, Moon, Clock } from "lucide-react";

type ShiftType = 'morning' | 'afternoon' | 'evening' | 'night';

interface RoleForm {
  name: string;
  shift_type: ShiftType;
  description: string;
}

const defaultForm: RoleForm = {
  name: "",
  shift_type: "morning",
  description: "",
};

const shiftIcons: Record<ShiftType, React.ReactNode> = {
  morning: <Sun className="h-4 w-4 text-yellow-500" />,
  afternoon: <Sunset className="h-4 w-4 text-orange-500" />,
  evening: <Moon className="h-4 w-4 text-purple-500" />,
  night: <Clock className="h-4 w-4 text-blue-500" />,
};

const shiftColors: Record<ShiftType, string> = {
  morning: "bg-yellow-100 text-yellow-800",
  afternoon: "bg-orange-100 text-orange-800",
  evening: "bg-purple-100 text-purple-800",
  night: "bg-blue-100 text-blue-800",
};

export default function RoleMaster() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoleForm>(defaultForm);
  const queryClient = useQueryClient();

  const { data: roles, isLoading } = useQuery({
    queryKey: ["role-master"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_master")
        .select("*")
        .order("shift_type", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: RoleForm) => {
      const { error } = await supabase.from("role_master").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-master"] });
      toast.success("Role created successfully");
      setIsDialogOpen(false);
      setForm(defaultForm);
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RoleForm }) => {
      const { error } = await supabase.from("role_master").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-master"] });
      toast.success("Role updated successfully");
      setIsDialogOpen(false);
      setEditingId(null);
      setForm(defaultForm);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("role_master").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-master"] });
      toast.success("Role deleted successfully");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = () => {
    if (!form.name || !form.shift_type) {
      toast.error("Please fill in required fields");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (role: any) => {
    setEditingId(role.id);
    setForm({
      name: role.name,
      shift_type: role.shift_type,
      description: role.description || "",
    });
    setIsDialogOpen(true);
  };

  const filteredRoles = roles?.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.shift_type.toLowerCase().includes(search.toLowerCase())
  );

  const rolesByShift = {
    morning: filteredRoles?.filter((r) => r.shift_type === "morning") || [],
    afternoon: filteredRoles?.filter((r) => r.shift_type === "afternoon") || [],
    evening: filteredRoles?.filter((r) => r.shift_type === "evening") || [],
    night: filteredRoles?.filter((r) => r.shift_type === "night") || [],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Role Master</h1>
          <p className="text-muted-foreground">Define shift-based roles and responsibilities</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingId(null);
            setForm(defaultForm);
          }
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Role</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Role" : "Create New Role"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Role Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Morning Floor Manager"
                />
              </div>
              <div className="space-y-2">
                <Label>Shift Type *</Label>
                <Select value={form.shift_type} onValueChange={(v: ShiftType) => setForm({ ...form, shift_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4" /> Morning (6 AM - 12 PM)
                      </div>
                    </SelectItem>
                    <SelectItem value="afternoon">
                      <div className="flex items-center gap-2">
                        <Sunset className="h-4 w-4" /> Afternoon (12 PM - 6 PM)
                      </div>
                    </SelectItem>
                    <SelectItem value="evening">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4" /> Evening (6 PM - 12 AM)
                      </div>
                    </SelectItem>
                    <SelectItem value="night">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" /> Night (12 AM - 6 AM)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Role responsibilities and duties"
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingId ? "Update Role" : "Create Role"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search roles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(Object.keys(rolesByShift) as ShiftType[]).map((shift) => (
            <Card key={shift}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {shiftIcons[shift]}
                  <span className="capitalize">{shift} Shift</span>
                  <Badge variant="secondary" className="ml-auto">
                    {rolesByShift[shift].length} roles
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rolesByShift[shift].length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    No roles defined for this shift
                  </p>
                ) : (
                  <div className="space-y-2">
                    {rolesByShift[shift].map((role) => (
                      <div
                        key={role.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Users className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{role.name}</div>
                            {role.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {role.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(role)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(role.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
