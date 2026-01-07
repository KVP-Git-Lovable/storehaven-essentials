import { useState } from "react";
import { Plus, FileText, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useToast } from "@/hooks/use-toast";
import { serviceContractSchema, type ServiceContractFormData } from "@/lib/schemas";

const vendors = ["CoolTech Services", "SecureView Ltd", "PowerGen Solutions", "IT Support Pro", "SafeFirst Inc"];
const contractTypes = ["HVAC AMC", "CCTV Maintenance", "Generator Service", "POS Maintenance", "Fire Safety", "Electrical AMC"];

const initialContracts = [
  { id: "CON-001", vendor: "CoolTech Services", type: "HVAC AMC", stores: 5, annualValue: 180000, startDate: "2024-01-01", endDate: "2024-12-31", status: "active" },
  { id: "CON-002", vendor: "SecureView Ltd", type: "CCTV Maintenance", stores: 8, annualValue: 96000, startDate: "2024-03-15", endDate: "2025-03-14", status: "active" },
  { id: "CON-003", vendor: "PowerGen Solutions", type: "Generator Service", stores: 4, annualValue: 120000, startDate: "2023-06-01", endDate: "2024-05-31", status: "expiring" },
  { id: "CON-004", vendor: "IT Support Pro", type: "POS Maintenance", stores: 10, annualValue: 240000, startDate: "2024-04-01", endDate: "2025-03-31", status: "active" },
  { id: "CON-005", vendor: "SafeFirst Inc", type: "Fire Safety", stores: 12, annualValue: 144000, startDate: "2023-01-01", endDate: "2023-12-31", status: "expired" },
];

const stats = [
  { title: "Total Contracts", value: "24", icon: FileText, iconColor: "bg-primary/10 text-primary" },
  { title: "Active", value: "18", icon: CheckCircle, iconColor: "bg-success/10 text-success" },
  { title: "Expiring Soon", value: "4", icon: Clock, iconColor: "bg-warning/10 text-warning" },
  { title: "Expired", value: "2", icon: AlertTriangle, iconColor: "bg-destructive/10 text-destructive" },
];

export default function ServiceContracts() {
  const [contracts, setContracts] = useState(initialContracts);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<ServiceContractFormData>({
    resolver: zodResolver(serviceContractSchema),
    defaultValues: {
      vendor: "",
      type: "",
      stores: 1,
      annualValue: 0,
      startDate: "",
      endDate: "",
    },
  });

  const onSubmit = (data: ServiceContractFormData) => {
    const newContract = {
      id: `CON-${String(contracts.length + 1).padStart(3, "0")}`,
      vendor: data.vendor,
      type: data.type,
      stores: data.stores,
      annualValue: data.annualValue,
      startDate: data.startDate,
      endDate: data.endDate,
      status: "active",
    };
    setContracts([...contracts, newContract]);
    form.reset();
    setOpen(false);
    toast({
      title: "Contract added",
      description: `Service contract with ${data.vendor} has been created.`,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Service Contracts</h1>
          <p className="text-muted-foreground">Manage AMC and service agreements</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Contract
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Service Contract</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="vendor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vendors.map((vendor) => (
                            <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {contractTypes.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
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
                    name="stores"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>No. of Stores</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Stores covered" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="annualValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Annual Value (₹)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Contract value" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
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
                    name="endDate"
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
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Contract</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contract ID</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Stores</TableHead>
              <TableHead>Annual Value</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell className="font-mono text-sm">{contract.id}</TableCell>
                <TableCell className="font-medium">{contract.vendor}</TableCell>
                <TableCell>{contract.type}</TableCell>
                <TableCell>{contract.stores}</TableCell>
                <TableCell>₹{contract.annualValue.toLocaleString()}</TableCell>
                <TableCell className="text-sm">
                  {new Date(contract.startDate).toLocaleDateString()} - {new Date(contract.endDate).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      contract.status === "active" ? "default" :
                      contract.status === "expiring" ? "secondary" : "destructive"
                    }
                  >
                    {contract.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
