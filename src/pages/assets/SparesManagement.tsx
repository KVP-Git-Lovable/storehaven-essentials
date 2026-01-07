import { useState } from "react";
import { Plus, Search, Boxes, AlertTriangle, CheckCircle } from "lucide-react";
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
import { spareSchema, type SpareFormData } from "@/lib/schemas";

const categories = ["HVAC", "IT", "Electrical", "Refrigeration", "Power", "Plumbing", "Safety"];

const initialSpares = [
  { id: "SPR-001", name: "AC Compressor", category: "HVAC", quantity: 5, reorderLevel: 3, unitPrice: 12000, status: "adequate" },
  { id: "SPR-002", name: "POS Paper Roll", category: "IT", quantity: 150, reorderLevel: 50, unitPrice: 45, status: "adequate" },
  { id: "SPR-003", name: "LED Tube Light", category: "Electrical", quantity: 8, reorderLevel: 10, unitPrice: 350, status: "low" },
  { id: "SPR-004", name: "Refrigerator Door Seal", category: "Refrigeration", quantity: 2, reorderLevel: 5, unitPrice: 2500, status: "critical" },
  { id: "SPR-005", name: "Generator Oil Filter", category: "Power", quantity: 12, reorderLevel: 5, unitPrice: 800, status: "adequate" },
];

const stats = [
  { title: "Total Spares", value: "342", icon: Boxes, iconColor: "bg-primary/10 text-primary" },
  { title: "Adequate Stock", value: "298", icon: CheckCircle, iconColor: "bg-success/10 text-success" },
  { title: "Low Stock", value: "32", icon: AlertTriangle, iconColor: "bg-warning/10 text-warning" },
  { title: "Critical", value: "12", icon: AlertTriangle, iconColor: "bg-destructive/10 text-destructive" },
];

export default function SparesManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [spares, setSpares] = useState(initialSpares);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<SpareFormData>({
    resolver: zodResolver(spareSchema),
    defaultValues: {
      name: "",
      category: "",
      quantity: 0,
      reorderLevel: 0,
      unitPrice: 0,
    },
  });

  const getStatus = (quantity: number, reorderLevel: number) => {
    if (quantity <= reorderLevel * 0.5) return "critical";
    if (quantity <= reorderLevel) return "low";
    return "adequate";
  };

  const onSubmit = (data: SpareFormData) => {
    const newSpare = {
      id: `SPR-${String(spares.length + 1).padStart(3, "0")}`,
      name: data.name,
      category: data.category,
      quantity: data.quantity,
      reorderLevel: data.reorderLevel,
      unitPrice: data.unitPrice,
      status: getStatus(data.quantity, data.reorderLevel),
    };
    setSpares([...spares, newSpare]);
    form.reset();
    setOpen(false);
    toast({
      title: "Spare added",
      description: `${data.name} has been added to inventory.`,
    });
  };

  const filteredSpares = spares.filter(
    (spare) =>
      spare.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spare.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Spares Management</h1>
          <p className="text-muted-foreground">Track spare parts inventory</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Spare
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Spare</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Spare Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter spare part name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
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
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Current stock" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reorderLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reorder Level</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Minimum stock" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="unitPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Price (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Price per unit" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Spare</Button>
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

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search spares..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Spare ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Reorder Level</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSpares.map((spare) => (
              <TableRow key={spare.id}>
                <TableCell className="font-mono text-sm">{spare.id}</TableCell>
                <TableCell className="font-medium">{spare.name}</TableCell>
                <TableCell>{spare.category}</TableCell>
                <TableCell>{spare.quantity}</TableCell>
                <TableCell>{spare.reorderLevel}</TableCell>
                <TableCell>₹{spare.unitPrice.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      spare.status === "adequate" ? "default" :
                      spare.status === "low" ? "secondary" : "destructive"
                    }
                  >
                    {spare.status}
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
