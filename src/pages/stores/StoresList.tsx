import { useState } from "react";
import { Plus, Search, MapPin, Phone, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const stores = [
  { id: 1, name: "Downtown Store", address: "123 Main St, City Center", phone: "+91 98765 43210", manager: "Rahul Sharma", status: "active", assets: 52 },
  { id: 2, name: "Mall Outlet", address: "Phoenix Mall, Floor 2", phone: "+91 98765 43211", manager: "Priya Patel", status: "active", assets: 38 },
  { id: 3, name: "Airport Kiosk", address: "Terminal 2, Domestic", phone: "+91 98765 43212", manager: "Amit Kumar", status: "active", assets: 15 },
  { id: 4, name: "Suburban Store", address: "45 Green Valley Rd", phone: "+91 98765 43213", manager: "Sneha Reddy", status: "active", assets: 45 },
  { id: 5, name: "Highway Express", address: "NH-48, Service Road", phone: "+91 98765 43214", manager: "Vikram Singh", status: "under-renovation", assets: 28 },
];

export default function StoresList() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStores = stores.filter(
    (store) =>
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">All Stores</h1>
          <p className="text-muted-foreground">Manage your store locations</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Store
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search stores..."
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
              <TableHead>Store Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStores.map((store) => (
              <TableRow key={store.id}>
                <TableCell className="font-medium">{store.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {store.address}
                  </div>
                </TableCell>
                <TableCell>{store.manager}</TableCell>
                <TableCell>{store.assets}</TableCell>
                <TableCell>
                  <Badge variant={store.status === "active" ? "default" : "secondary"}>
                    {store.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>Edit Store</DropdownMenuItem>
                      <DropdownMenuItem>View Assets</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
