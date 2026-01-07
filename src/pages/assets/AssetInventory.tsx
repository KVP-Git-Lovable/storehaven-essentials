import { useState } from "react";
import { Plus, Search, Package, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
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

const assets = [
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Asset Inventory</h1>
          <p className="text-muted-foreground">Track all assets across stores</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Asset
        </Button>
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
            <SelectItem value="downtown">Downtown Store</SelectItem>
            <SelectItem value="mall">Mall Outlet</SelectItem>
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
