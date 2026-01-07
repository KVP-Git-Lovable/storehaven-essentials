import { useState } from "react";
import { Plus, Search, Package, MoreVertical } from "lucide-react";
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

const products = [
  { id: 1, name: "Split AC 1.5 Ton", category: "HVAC", brand: "Daikin", model: "FTKF50", warranty: "5 years", price: 45000 },
  { id: 2, name: "POS Terminal", category: "IT Equipment", brand: "Pine Labs", model: "P1000", warranty: "2 years", price: 25000 },
  { id: 3, name: "Security Camera", category: "Security", brand: "Hikvision", model: "DS-2CD", warranty: "3 years", price: 8500 },
  { id: 4, name: "Display Refrigerator", category: "Refrigeration", brand: "Blue Star", model: "DR-500", warranty: "5 years", price: 85000 },
  { id: 5, name: "Generator 10KVA", category: "Power", brand: "Kirloskar", model: "KG1-10", warranty: "2 years", price: 250000 },
  { id: 6, name: "Fire Extinguisher", category: "Safety", brand: "Cease Fire", model: "CF-5KG", warranty: "1 year", price: 2500 },
];

export default function Products() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products Catalog</h1>
          <p className="text-muted-foreground">Master list of all product types</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
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
              <TableHead>Product Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Warranty</TableHead>
              <TableHead>Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{product.category}</Badge>
                </TableCell>
                <TableCell>{product.brand}</TableCell>
                <TableCell>{product.model}</TableCell>
                <TableCell>{product.warranty}</TableCell>
                <TableCell>₹{product.price.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
