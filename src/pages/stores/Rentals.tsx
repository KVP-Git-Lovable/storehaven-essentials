import { Building2, Calendar, IndianRupee, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const leases = [
  { id: 1, store: "Downtown Store", landlord: "ABC Realty", rent: 150000, startDate: "2023-01-01", endDate: "2025-12-31", status: "active" },
  { id: 2, store: "Mall Outlet", landlord: "Phoenix Ltd", rent: 250000, startDate: "2022-06-15", endDate: "2025-06-14", status: "renewal-due" },
  { id: 3, store: "Airport Kiosk", landlord: "AAI Commercial", rent: 180000, startDate: "2024-01-01", endDate: "2026-12-31", status: "active" },
  { id: 4, store: "Suburban Store", landlord: "Green Valley Prop", rent: 85000, startDate: "2023-03-01", endDate: "2026-02-28", status: "active" },
  { id: 5, store: "Highway Express", landlord: "NH Properties", rent: 120000, startDate: "2023-07-01", endDate: "2024-06-30", status: "expired" },
];

const stats = [
  { title: "Total Monthly Rent", value: "₹7.85L", icon: IndianRupee, iconColor: "bg-primary/10 text-primary" },
  { title: "Active Leases", value: "4", icon: Building2, iconColor: "bg-success/10 text-success" },
  { title: "Renewals Due", value: "1", icon: AlertCircle, iconColor: "bg-warning/10 text-warning" },
  { title: "Avg Lease Term", value: "3 Years", icon: Calendar, iconColor: "bg-info/10 text-info" },
];

export default function Rentals() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">Rentals & Leases</h1>
        <p className="text-muted-foreground">Manage store rental agreements and lease contracts</p>
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
              <TableHead>Store</TableHead>
              <TableHead>Landlord</TableHead>
              <TableHead>Monthly Rent</TableHead>
              <TableHead>Lease Period</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leases.map((lease) => (
              <TableRow key={lease.id}>
                <TableCell className="font-medium">{lease.store}</TableCell>
                <TableCell>{lease.landlord}</TableCell>
                <TableCell>₹{lease.rent.toLocaleString()}</TableCell>
                <TableCell>
                  {new Date(lease.startDate).toLocaleDateString()} - {new Date(lease.endDate).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      lease.status === "active" ? "default" :
                      lease.status === "renewal-due" ? "secondary" : "destructive"
                    }
                  >
                    {lease.status}
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
