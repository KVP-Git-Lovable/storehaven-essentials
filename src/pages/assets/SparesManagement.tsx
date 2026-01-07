import { useState } from "react";
import { Plus, Search, Boxes, AlertTriangle, CheckCircle } from "lucide-react";
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

const spares = [
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Spares Management</h1>
          <p className="text-muted-foreground">Track spare parts inventory</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Spare
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
            {spares.map((spare) => (
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
