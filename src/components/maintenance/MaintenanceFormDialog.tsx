import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useStoreAccess } from "@/hooks/useStoreAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const taskTypes = [
  "Preventive Maintenance",
  "Routine Inspection",
  "Deep Cleaning",
  "Calibration",
];

const frequencies = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
];

const maintenanceFormSchema = z.object({
  storeId: z.string().min(1, "Store is required"),
  assetId: z.string().min(1, "Asset is required"),
  taskType: z.string().min(1, "Task type is required"),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annual"]),
  assignedTo: z.string().min(1, "Assigned to is required"),
  nextDue: z.string().min(1, "Next due date is required"),
});

type MaintenanceFormData = z.infer<typeof maintenanceFormSchema>;

type Store = {
  id: string;
  name: string;
};

type Asset = {
  id: string;
  name: string;
  asset_number: string | null;
  store_id: string | null;
};

type Vendor = {
  id: string;
  name: string;
};

type MaintenanceTask = {
  id: string;
  asset: string;
  asset_id: string | null;
  store_id: string | null;
  task_type: string;
  frequency: string;
  last_done: string;
  next_due: string;
  assigned_to: string;
  status: string;
};

type MaintenanceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit" | "clone";
  initialData?: MaintenanceTask | null;
  onSuccess: () => void;
};

export function MaintenanceFormDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  onSuccess,
}: MaintenanceFormDialogProps) {
  const [stores, setStores] = useState<Store[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { accessibleStoreIds, isAdmin } = useStoreAccess();

  const form = useForm<MaintenanceFormData>({
    resolver: zodResolver(maintenanceFormSchema),
    defaultValues: {
      storeId: "",
      assetId: "",
      taskType: "",
      frequency: "monthly",
      assignedTo: "",
      nextDue: "",
    },
  });

  const selectedStoreId = form.watch("storeId");

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  useEffect(() => {
    if (initialData && mode !== "add") {
      form.reset({
        storeId: initialData.store_id || "",
        assetId: initialData.asset_id || "",
        taskType: initialData.task_type,
        frequency: initialData.frequency as MaintenanceFormData["frequency"],
        assignedTo: initialData.assigned_to,
        nextDue: initialData.next_due,
      });
    } else if (mode === "add") {
      form.reset({
        storeId: "",
        assetId: "",
        taskType: "",
        frequency: "monthly",
        assignedTo: "",
        nextDue: "",
      });
    }
  }, [initialData, mode, form]);

  useEffect(() => {
    if (selectedStoreId) {
      const filtered = assets.filter(
        (asset) => asset.store_id === selectedStoreId
      );
      setFilteredAssets(filtered);
    } else {
      setFilteredAssets(assets);
    }
  }, [selectedStoreId, assets]);

  const fetchData = async () => {
    const [storesRes, assetsRes, vendorsRes] = await Promise.all([
      supabase.from("stores").select("id, name").order("name"),
      supabase
        .from("assets")
        .select("id, name, asset_number, store_id")
        .order("name"),
      supabase.from("vendors").select("id, name").order("name"),
    ]);

    // Filter stores for non-admins
    const allStores = storesRes.data || [];
    setStores(isAdmin ? allStores : allStores.filter(s => accessibleStoreIds.has(s.id)));
    if (assetsRes.data) {
      setAssets(assetsRes.data);
      setFilteredAssets(assetsRes.data);
    }
    if (vendorsRes.data) setVendors(vendorsRes.data);
  };

  const onSubmit = async (data: MaintenanceFormData) => {
    setLoading(true);
    const selectedAsset = assets.find((a) => a.id === data.assetId);
    const assetName = selectedAsset
      ? `${selectedAsset.name}${selectedAsset.asset_number ? ` (${selectedAsset.asset_number})` : ""}`
      : "";

    const payload = {
      asset: assetName,
      asset_id: data.assetId,
      store_id: data.storeId,
      task_type: data.taskType,
      frequency: data.frequency,
      last_done: mode === "add" || mode === "clone" ? "-" : initialData?.last_done || "-",
      next_due: data.nextDue,
      assigned_to: data.assignedTo,
      status: "scheduled",
    };

    let error;
    if (mode === "edit" && initialData) {
      const result = await supabase
        .from("maintenance_tasks")
        .update(payload)
        .eq("id", initialData.id);
      error = result.error;
    } else {
      const result = await supabase.from("maintenance_tasks").insert(payload);
      error = result.error;
    }

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: `Failed to ${mode === "edit" ? "update" : "create"} schedule`,
        variant: "destructive",
      });
    } else {
      toast({
        title: mode === "edit" ? "Schedule updated" : "Schedule created",
        description: `Maintenance schedule has been ${mode === "edit" ? "updated" : "created"}.`,
      });
      onOpenChange(false);
      onSuccess();
    }
  };

  const title =
    mode === "add"
      ? "Add Maintenance Schedule"
      : mode === "edit"
        ? "Edit Maintenance Schedule"
        : "Clone Maintenance Schedule";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="storeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Store</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select store" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
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
              name="assetId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asset</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select asset from register" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredAssets.map((asset) => (
                        <SelectItem key={asset.id} value={asset.id}>
                          {asset.name}
                          {asset.asset_number && ` (${asset.asset_number})`}
                        </SelectItem>
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
                name="taskType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {taskTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
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
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {frequencies.map((freq) => (
                          <SelectItem key={freq.value} value={freq.value}>
                            {freq.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned To</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.name}>
                            {vendor.name}
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
                name="nextDue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Next Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {mode === "edit" ? "Update" : "Create"} Schedule
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
