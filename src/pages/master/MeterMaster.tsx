import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Loader2, Pencil, Trash2, Settings } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const meterMasterSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  readingParameterCount: z.number().min(1, "At least 1 parameter required").max(10, "Maximum 10 parameters allowed"),
  readingParameters: z.array(z.string().trim().min(1, "Parameter name is required")),
  detailsToCapture: z.enum(["Start", "End", "Both"]),
});

type MeterMasterFormData = z.infer<typeof meterMasterSchema>;

interface MeterMaster {
  id: string;
  name: string;
  reading_parameter_count: number;
  reading_parameters: string[];
  details_to_capture: string;
  created_by: string;
  created_at: string;
  last_modified_by: string;
  last_modified_at: string;
}

export default function MeterMaster() {
  const [meters, setMeters] = useState<MeterMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingMeter, setEditingMeter] = useState<MeterMaster | null>(null);
  const [paramCount, setParamCount] = useState(1);

  const form = useForm<MeterMasterFormData>({
    resolver: zodResolver(meterMasterSchema),
    defaultValues: {
      name: "",
      readingParameterCount: 1,
      readingParameters: [""],
      detailsToCapture: "Both",
    },
  });

  useEffect(() => {
    fetchMeters();
  }, []);

  useEffect(() => {
    const currentParams = form.getValues("readingParameters");
    const newParams = Array(paramCount).fill("").map((_, i) => currentParams[i] || "");
    form.setValue("readingParameters", newParams);
    form.setValue("readingParameterCount", paramCount);
  }, [paramCount, form]);

  const fetchMeters = async () => {
    try {
      const { data, error } = await supabase
        .from("meter_masters")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMeters(data || []);
    } catch (error) {
      console.error("Error fetching meters:", error);
      toast.error("Failed to load meter masters");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: MeterMasterFormData) => {
    try {
      const payload = {
        name: data.name,
        reading_parameter_count: data.readingParameterCount,
        reading_parameters: data.readingParameters,
        details_to_capture: data.detailsToCapture,
        last_modified_by: "System",
        last_modified_at: new Date().toISOString(),
      };

      if (editingMeter) {
        const { error } = await supabase
          .from("meter_masters")
          .update(payload)
          .eq("id", editingMeter.id);

        if (error) throw error;
        toast.success("Meter master updated successfully");
      } else {
        const { error } = await supabase
          .from("meter_masters")
          .insert([{ ...payload, created_by: "System" }]);

        if (error) throw error;
        toast.success("Meter master added successfully");
      }

      setOpen(false);
      setEditingMeter(null);
      form.reset();
      setParamCount(1);
      fetchMeters();
    } catch (error) {
      console.error("Error saving meter:", error);
      toast.error("Failed to save meter master");
    }
  };

  const handleEdit = (meter: MeterMaster) => {
    setEditingMeter(meter);
    setParamCount(meter.reading_parameter_count);
    form.reset({
      name: meter.name,
      readingParameterCount: meter.reading_parameter_count,
      readingParameters: meter.reading_parameters,
      detailsToCapture: meter.details_to_capture as "Start" | "End" | "Both",
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("meter_masters")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Meter master deleted successfully");
      fetchMeters();
    } catch (error) {
      console.error("Error deleting meter:", error);
      toast.error("Failed to delete meter master");
    }
  };

  const handleDialogClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEditingMeter(null);
      form.reset();
      setParamCount(1);
    }
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
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Meter Master</h1>
          <p className="text-sm text-muted-foreground">Manage meter configurations</p>
        </div>
        <Dialog open={open} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Add Meter Master
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingMeter ? "Edit" : "Add"} Meter Master</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name of Meter Master</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter meter name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel># of Reading Parameters</FormLabel>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={paramCount}
                    onChange={(e) => setParamCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                  />
                </FormItem>

                {Array.from({ length: paramCount }).map((_, index) => (
                  <FormField
                    key={index}
                    control={form.control}
                    name={`readingParameters.${index}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reading Parameter {index + 1}</FormLabel>
                        <FormControl>
                          <Input placeholder={`Enter parameter ${index + 1}`} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}

                <FormField
                  control={form.control}
                  name="detailsToCapture"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Details to Capture</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select details to capture" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Start">Start</SelectItem>
                          <SelectItem value="End">End</SelectItem>
                          <SelectItem value="Both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full">
                  {editingMeter ? "Update" : "Add"} Meter Master
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Settings className="h-5 w-5 text-primary" />
            Meter Masters
          </CardTitle>
        </CardHeader>
        <CardContent>
          {meters.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No meter masters found. Add one to get started.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell"># Parameters</TableHead>
                    <TableHead className="hidden md:table-cell">Parameters</TableHead>
                    <TableHead className="hidden sm:table-cell">Details</TableHead>
                    <TableHead className="hidden lg:table-cell">Created By</TableHead>
                    <TableHead className="hidden lg:table-cell">Created At</TableHead>
                    <TableHead className="hidden xl:table-cell">Modified By</TableHead>
                    <TableHead className="hidden xl:table-cell">Modified At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meters.map((meter) => (
                    <TableRow key={meter.id}>
                      <TableCell className="font-medium">{meter.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{meter.reading_parameter_count}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {meter.reading_parameters.join(", ")}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{meter.details_to_capture}</TableCell>
                      <TableCell className="hidden lg:table-cell">{meter.created_by}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {format(new Date(meter.created_at), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">{meter.last_modified_by}</TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {format(new Date(meter.last_modified_at), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(meter)}
                          >
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
                                <AlertDialogTitle>Delete Meter Master?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the meter master "{meter.name}".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(meter.id)}
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
