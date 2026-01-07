import { useState } from "react";
import { Plus, Search, Building2, Phone, Mail, IndianRupee } from "lucide-react";
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

const vendors = [
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vendor Management</h1>
          <p className="text-muted-foreground">Manage vendors and payouts</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Vendor
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
            {vendors.map((vendor) => (
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
