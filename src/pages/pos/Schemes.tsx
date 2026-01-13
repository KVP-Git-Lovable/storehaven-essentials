import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Tag, Edit, Trash2, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const schemeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  discount_type: z.enum(["percentage", "fixed", "buy_x_get_y"]),
  discount_value: z.coerce.number().min(0, "Must be positive"),
  min_purchase_amount: z.coerce.number().min(0).optional(),
  min_quantity: z.coerce.number().min(1).optional(),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  status: z.enum(["active", "inactive"]),
});

type SchemeFormData = z.infer<typeof schemeSchema>;

export default function Schemes() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState<any>(null);

  const form = useForm<SchemeFormData>({
    resolver: zodResolver(schemeSchema),
    defaultValues: {
      name: "",
      description: "",
      discount_type: "percentage",
      discount_value: 0,
      min_purchase_amount: 0,
      min_quantity: 1,
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date().toISOString().split("T")[0],
      status: "active",
    },
  });

  const { data: schemes = [], isLoading } = useQuery({
    queryKey: ["schemes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schemes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SchemeFormData) => {
      const insertData = {
        name: data.name,
        description: data.description || null,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        min_purchase_amount: data.min_purchase_amount || 0,
        min_quantity: data.min_quantity || 1,
        start_date: data.start_date,
        end_date: data.end_date,
        status: data.status,
      };
      const { error } = await supabase.from("schemes").insert([insertData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schemes"] });
      setIsDialogOpen(false);
      form.reset();
      toast.success("Scheme created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create scheme");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SchemeFormData & { id: string }) => {
      const { id, ...updateData } = data;
      const { error } = await supabase.from("schemes").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schemes"] });
      setIsDialogOpen(false);
      setEditingScheme(null);
      form.reset();
      toast.success("Scheme updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update scheme");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schemes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schemes"] });
      toast.success("Scheme deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete scheme");
    },
  });

  const handleEdit = (scheme: any) => {
    setEditingScheme(scheme);
    form.reset({
      name: scheme.name,
      description: scheme.description || "",
      discount_type: scheme.discount_type,
      discount_value: scheme.discount_value,
      min_purchase_amount: scheme.min_purchase_amount || 0,
      min_quantity: scheme.min_quantity || 1,
      start_date: scheme.start_date,
      end_date: scheme.end_date,
      status: scheme.status,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this scheme?")) {
      deleteMutation.mutate(id);
    }
  };

  const onSubmit = (data: SchemeFormData) => {
    if (editingScheme) {
      updateMutation.mutate({ ...data, id: editingScheme.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const openNewDialog = () => {
    setEditingScheme(null);
    form.reset({
      name: "",
      description: "",
      discount_type: "percentage",
      discount_value: 0,
      min_purchase_amount: 0,
      min_quantity: 1,
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date().toISOString().split("T")[0],
      status: "active",
    });
    setIsDialogOpen(true);
  };

  const filteredSchemes = schemes.filter(
    (scheme) =>
      scheme.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scheme.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDiscountLabel = (scheme: any) => {
    switch (scheme.discount_type) {
      case "percentage":
        return `${scheme.discount_value}% off`;
      case "fixed":
        return `₹${scheme.discount_value} off`;
      case "buy_x_get_y":
        return `Buy ${scheme.min_quantity} get discount`;
      default:
        return scheme.discount_value;
    }
  };

  const isSchemeActive = (scheme: any) => {
    const today = new Date().toISOString().split("T")[0];
    return scheme.status === "active" && scheme.start_date <= today && scheme.end_date >= today;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Schemes & Promotions</h1>
          <p className="text-muted-foreground">Manage discount schemes for POS</p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Scheme
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schemes</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schemes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Now</CardTitle>
            <Tag className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schemes.filter((s) => isSchemeActive(s)).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schemes.filter((s) => s.status === "inactive").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search schemes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Schemes Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Min. Purchase</TableHead>
              <TableHead>Validity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSchemes.map((scheme) => (
              <TableRow key={scheme.id}>
                <TableCell>
                  <div className="font-medium">{scheme.name}</div>
                  {scheme.description && (
                    <div className="text-xs text-muted-foreground">{scheme.description}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{scheme.discount_type}</Badge>
                </TableCell>
                <TableCell className="font-medium">{getDiscountLabel(scheme)}</TableCell>
                <TableCell>
                  {scheme.min_purchase_amount ? `₹${scheme.min_purchase_amount}` : "-"}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {format(new Date(scheme.start_date), "dd MMM")} -{" "}
                    {format(new Date(scheme.end_date), "dd MMM yyyy")}
                  </div>
                </TableCell>
                <TableCell>
                  {isSchemeActive(scheme) ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Active
                    </Badge>
                  ) : scheme.status === "inactive" ? (
                    <Badge variant="secondary">Inactive</Badge>
                  ) : (
                    <Badge variant="outline">Expired</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(scheme)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDelete(scheme.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredSchemes.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No schemes found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingScheme ? "Edit Scheme" : "Add New Scheme"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Summer Sale" {...field} />
                    </FormControl>
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
                      <Textarea placeholder="Scheme description..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="discount_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                          <SelectItem value="buy_x_get_y">Buy X Get Y</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discount_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {form.watch("discount_type") === "percentage" ? "Discount %" : "Discount ₹"}
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="min_purchase_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Purchase Amount (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
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

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingScheme ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
