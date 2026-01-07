import { useState } from "react";
import { Plus, Search, Package, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { assetSchema, type AssetFormData } from "@/lib/schemas";

const stores = ["Downtown Store", "Mall Outlet", "Airport Kiosk", "Suburban Store", "Highway Express"];
const products = ["Split AC 1.5 Ton", "POS Terminal", "Security Camera", "Display Refrigerator", "Generator 10KVA"];

const initialAssets = [
  { id: "AST-001", name: "Split AC 1.5 Ton", store: "Downtown Store", serialNo: "DAI-2023-001", purchaseDate: "2023-03-15", status: "operational" },
  { id: "AST-002", name: "POS Terminal", store: "Downtown Store", serialNo: "PL-2023-042", purchaseDate: "2023-01-20", status: "operational" },
  { id: "AST-003", name: "Security Camera", store: "Mall Outlet", serialNo: "HIK-2022-156", purchaseDate: "2022-08-10", status: "maintenance" },
  { id: "AST-004", name: "Display Refrigerator", store: "Airport Kiosk", serialNo: "BS-2024-003", purchaseDate: "2024-01-05", status: "operational" },
  { id: "AST-005", name: "Generator 10KVA", store: "Suburban Store", serialNo: "KIR-2023-007", purchaseDate: "2023-06-20", status: "non-operational" },
];

const stats = [
  { title: "Total Assets", value: "1,247", icon: Package, iconColor: "bg-primary/10 text-primary" },
  { title: "Operational", value: "1,198", icon: CheckCircle, iconColor: "bg-success/10 text-success" },
  { title: "Under Maintenance", value: "32", icon: AlertTriangle, iconColor: "bg-warning/10 text-warning" },
  { title: "Non-Operational", value: "17", icon: XCircle, iconColor: "bg-destructive/10 text-destructive" },
];

export default function AssetInventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [assets, setAssets] = useState(initialAssets);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      productId: "",
      store: "",
      serialNo: "",
      purchaseDate: "",
      status: "operational",
    },
  });

  const onSubmit = (data: AssetFormData) => {
    const newAsset = {
      id: `AST-${String(assets.length + 1).padStart(3, "0")}`,
      name: data.productId,
      store: data.store,
      serialNo: data.serialNo,
      purchaseDate: data.purchaseDate,
      status: data.status,
    };
    setAssets([...assets, newAsset]);
    form.reset();
    setOpen(false);
    toast({
      title: "Asset added",
      description: `Asset ${newAsset.id} has been registered.`,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Asset Inventory</h1>
          <p className="text-muted-foreground">Track all assets across stores</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Asset</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="productId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product} value={product}>{product}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="store"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select store" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {stores.map((store) => (
                            <SelectItem key={store} value={store}>{store}</SelectItem>
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
                    name="serialNo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter serial no." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Date</FormLabel>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="operational">Operational</SelectItem>
                          <SelectItem value="maintenance">Under Maintenance</SelectItem>
                          <SelectItem value="non-operational">Non-Operational</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Asset</Button>
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
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Stores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stores</SelectItem>
            {stores.map((store) => (
              <SelectItem key={store} value={store}>{store}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Serial No</TableHead>
              <TableHead>Purchase Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset) => (
              <TableRow key={asset.id}>
                <TableCell className="font-mono text-sm">{asset.id}</TableCell>
                <TableCell className="font-medium">{asset.name}</TableCell>
                <TableCell>{asset.store}</TableCell>
                <TableCell className="font-mono text-sm">{asset.serialNo}</TableCell>
                <TableCell>{new Date(asset.purchaseDate).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      asset.status === "operational" ? "default" :
                      asset.status === "maintenance" ? "secondary" : "destructive"
                    }
                  >
                    {asset.status}
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
