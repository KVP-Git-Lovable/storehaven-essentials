import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Pencil, Trash2, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const positionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  department_id: z.string().optional(),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  status: z.enum(["active", "inactive"]),
});

type PositionFormData = z.infer<typeof positionSchema>;

interface Position {
  id: string;
  name: string;
  department_id: string | null;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Department {
  id: string;
  name: string;
}

export default function PositionMaster() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);

  const form = useForm<PositionFormData>({
    resolver: zodResolver(positionSchema),
    defaultValues: {
      name: "",
      department_id: "",
      description: "",
      status: "active",
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [positionsRes, departmentsRes] = await Promise.all([
        supabase.from("positions").select("*").order("name", { ascending: true }),
        supabase.from("departments").select("id, name").eq("status", "active").order("name"),
      ]);

      if (positionsRes.error) throw positionsRes.error;
      if (departmentsRes.error) throw departmentsRes.error;

      setPositions(positionsRes.data || []);
      setDepartments(departmentsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: PositionFormData) => {
    try {
      const payload = {
        name: data.name,
        department_id: data.department_id || null,
        description: data.description || null,
        status: data.status,
      };

      if (editingPosition) {
        const { error } = await supabase
          .from("positions")
          .update(payload)
          .eq("id", editingPosition.id);

        if (error) throw error;
        toast.success("Position updated successfully");
      } else {
        const { error } = await supabase
          .from("positions")
          .insert([payload]);

        if (error) throw error;
        toast.success("Position added successfully");
      }

      setOpen(false);
      setEditingPosition(null);
      form.reset();
      fetchData();
    } catch (error: any) {
      console.error("Error saving position:", error);
      if (error.code === "23505") {
        toast.error("A position with this name already exists");
      } else {
        toast.error("Failed to save position");
      }
    }
  };

  const handleEdit = (position: Position) => {
    setEditingPosition(position);
    form.reset({
      name: position.name,
      department_id: position.department_id || "",
      description: position.description || "",
      status: position.status as "active" | "inactive",
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("positions")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Position deleted successfully");
      fetchData();
    } catch (error) {
      console.error("Error deleting position:", error);
      toast.error("Failed to delete position");
    }
  };

  const handleDialogClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEditingPosition(null);
      form.reset();
    }
  };

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return "-";
    const dept = departments.find((d) => d.id === departmentId);
    return dept?.name || "-";
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Position Master</h1>
          <p className="text-sm text-muted-foreground">Manage position configurations</p>
        </div>
        <Dialog open={open} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Add Position
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingPosition ? "Edit" : "Add"} Position</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Position Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter position name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="department_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter description (optional)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full">
                  {editingPosition ? "Update" : "Add"} Position
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Briefcase className="h-5 w-5 text-primary" />
            Positions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No positions found. Add one to get started.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Department</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((pos) => (
                    <TableRow key={pos.id}>
                      <TableCell className="font-medium">{pos.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{getDepartmentName(pos.department_id)}</TableCell>
                      <TableCell className="hidden md:table-cell">{pos.description || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={pos.status === "active" ? "default" : "secondary"}>
                          {pos.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {format(new Date(pos.created_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(pos)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Position?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the position "{pos.name}".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(pos.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
