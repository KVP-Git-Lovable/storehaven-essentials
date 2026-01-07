import { useState } from "react";
import { Plus, Search, Building2, IndianRupee } from "lucide-react";
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
import { vendorSchema, type VendorFormData } from "@/lib/schemas";

const categories = ["HVAC", "Security", "Power", "IT", "Safety", "Cleaning", "Electrical", "Plumbing"];

const initialVendors = [
  { id: 1, name: "CoolTech Services", category: "HVAC", contact: "Rajesh Kumar", phone: "+91 98765 11111", email: "rajesh@cooltech.in", contracts: 3, totalPayouts: 540000 },
  { id: 2, name: "SecureView Ltd", category: "Security", contact: "Priya Menon", phone: "+91 98765 22222", email: "priya@secureview.in", contracts: 2, totalPayouts: 192000 },
  { id: 3, name: "PowerGen Solutions", category: "Power", contact: "Amit Shah", phone: "+91 98765 33333", email: "amit@powergen.in", contracts: 1, totalPayouts: 360000 },
  { id: 4, name: "IT Support Pro", category: "IT", contact: "Neha Sharma", phone: "+91 98765 44444", email: "neha@itsupportpro.in", contracts: 4, totalPayouts: 480000 },
  { id: 5, name: "SafeFirst Inc", category: "Safety", contact: "Vikram Joshi", phone: "+91 98765 55555", email: "vikram@safefirst.in", contracts: 2, totalPayouts: 288000 },
];

const stats = [
  { title: "Total Vendors", value: "32", icon: Building2, iconColor: "bg-primary/10 text-primary" },
  { title: "Active Contracts", value: "24", icon: Building2, iconColor: "bg-success/10 text-success" },
  { title: "Monthly Payouts", value: "₹4.2L", icon: IndianRupee, iconColor: "bg-warning/10 text-warning" },
  { title: "Pending Payments", value: "₹85K", icon: IndianRupee, iconColor: "bg-info/10 text-info" },
];

export default function Vendors() {
  const [searchQuery, setSearchQuery] = useState("");
  const [vendors, setVendors] = useState(initialVendors);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: "",
      category: "",
      contact: "",
      phone: "",
      email: "",
    },
  });

  const onSubmit = (data: VendorFormData) => {
    const newVendor = {
      id: vendors.length + 1,
      name: data.name,
      category: data.category,
      contact: data.contact,
      phone: data.phone,
      email: data.email,
      contracts: 0,
      totalPayouts: 0,
    };
    setVendors([...vendors, newVendor]);
    form.reset();
    setOpen(false);
    toast({
      title: "Vendor added",
      description: `${data.name} has been added successfully.`,
    });
  };

  const filteredVendors = vendors.filter(
    (vendor) =>
      vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vendor Management</h1>
          <p className="text-muted-foreground">Manage vendors and payouts</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Vendor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Vendor</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter vendor name" {...field} />
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
                <FormField
                  control={form.control}
                  name="contact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl>
                        <Input placeholder="Contact person name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
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
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Vendor</Button>
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
            placeholder="Search vendors..."
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
              <TableHead>Vendor Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Contracts</TableHead>
              <TableHead>Total Payouts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVendors.map((vendor) => (
              <TableRow key={vendor.id}>
                <TableCell className="font-medium">{vendor.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{vendor.category}</Badge>
                </TableCell>
                <TableCell>{vendor.contact}</TableCell>
                <TableCell>{vendor.phone}</TableCell>
                <TableCell>{vendor.contracts}</TableCell>
                <TableCell>₹{vendor.totalPayouts.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
