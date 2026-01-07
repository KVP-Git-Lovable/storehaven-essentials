import { Plus, FileText, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const contracts = [
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
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Service Contracts</h1>
          <p className="text-muted-foreground">Manage AMC and service agreements</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Contract
        </Button>
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
