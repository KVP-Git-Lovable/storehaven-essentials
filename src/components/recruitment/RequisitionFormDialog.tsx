import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface RequisitionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type FormData = {
  title: string;
  department: string;
  position: string;
  number_of_openings: number;
  priority: string;
  description: string;
  requirements: string;
  salary_range_min: string;
  salary_range_max: string;
  target_join_date: string;
};

const departments = ["Operations", "Sales", "Security", "Housekeeping", "IT", "Management", "Marketing", "Finance"];

export function RequisitionFormDialog({ open, onOpenChange, onSuccess }: RequisitionFormDialogProps) {
  const { toast } = useToast();
  const [stores, setStores] = useState<{id: string; name: string}[]>([]);
  
  const form = useForm<FormData>({
    defaultValues: {
      title: "",
      department: "",
      position: "",
      number_of_openings: 1,
      priority: "medium",
      description: "",
      requirements: "",
      salary_range_min: "",
      salary_range_max: "",
      target_join_date: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    const { error } = await supabase.from("job_requisitions").insert({
      title: data.title,
      department: data.department,
      position: data.position,
      number_of_openings: data.number_of_openings,
      priority: data.priority,
      description: data.description || null,
      requirements: data.requirements || null,
      salary_range_min: data.salary_range_min ? Number(data.salary_range_min) : null,
      salary_range_max: data.salary_range_max ? Number(data.salary_range_max) : null,
      target_join_date: data.target_join_date || null,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to create requisition", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Requisition created successfully" });
      form.reset();
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Job Requisition</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              rules={{ required: "Title is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Store Manager" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="department"
                rules={{ required: "Department is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="position"
                rules={{ required: "Position is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Assistant Manager" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="number_of_openings"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Openings</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} onChange={e => field.onChange(Number(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="target_join_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Join Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="salary_range_min"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salary Min (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 25000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salary_range_max"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salary Max (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 40000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Job description..." rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requirements"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requirements</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Key requirements..." rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">Create Requisition</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
