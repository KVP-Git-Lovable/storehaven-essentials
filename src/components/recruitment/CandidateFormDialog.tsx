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
import { GENDER_OPTIONS } from "@/components/shared/GenderSelect";

interface CandidateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requisitions: { id: string; title: string }[];
  onSuccess: () => void;
}

type FormData = {
  name: string;
  email: string;
  phone: string;
  requisition_id: string;
  current_company: string;
  current_designation: string;
  experience_years: string;
  expected_salary: string;
  notice_period_days: string;
  source: string;
  notes: string;
  date_of_birth: string;
  gender: string;
};

export function CandidateFormDialog({ open, onOpenChange, requisitions, onSuccess }: CandidateFormDialogProps) {
  const { toast } = useToast();

  const form = useForm<FormData>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      requisition_id: "",
      current_company: "",
      current_designation: "",
      experience_years: "",
      expected_salary: "",
      notice_period_days: "",
      source: "direct",
      notes: "",
      date_of_birth: "",
      gender: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    const { error } = await supabase.from("candidates").insert({
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      requisition_id: data.requisition_id || null,
      current_company: data.current_company || null,
      current_designation: data.current_designation || null,
      experience_years: data.experience_years ? Number(data.experience_years) : null,
      expected_salary: data.expected_salary ? Number(data.expected_salary) : null,
      notice_period_days: data.notice_period_days ? Number(data.notice_period_days) : null,
      source: data.source,
      notes: data.notes || null,
      date_of_birth: data.date_of_birth || null,
      gender: data.gender || null,
      status: "applied",
    });

    if (error) {
      toast({ title: "Error", description: "Failed to add candidate", variant: "destructive" });
    } else {
      toast({ title: "Success", description: `${data.name} added as a candidate` });
      form.reset();
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Candidate</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 98765 43210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="requisition_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link to Requisition</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select requisition (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {requisitions.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="current_company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Company</FormLabel>
                    <FormControl>
                      <Input placeholder="Company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="current_designation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Designation</FormLabel>
                    <FormControl>
                      <Input placeholder="Designation" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date_of_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <p className="text-[11px] text-muted-foreground">Displayed as dd-mm-yyyy</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GENDER_OPTIONS.map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="experience_years"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Experience (yrs)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expected_salary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected CTC (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notice_period_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notice (days)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="direct">Direct</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="job_portal">Job Portal</SelectItem>
                      <SelectItem value="walk_in">Walk-in</SelectItem>
                      <SelectItem value="consultant">Consultant</SelectItem>
                      <SelectItem value="campus">Campus</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes..." rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">Add Candidate</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
