import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Package, Tag, Settings } from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";

type CatalogProduct = {
  id: string;
  title: string;
  product_type: string | null;
  base_price: number | null;
  display_price: string | null;
  image_url: string | null;
};

const fmt = (n: number | null | undefined) =>
  n == null ? "" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function SchemeConfigMaster() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("products");

  // Fetch catalog products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["catalog_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_products")
        .select("id,title,product_type,base_price,display_price,image_url")
        .eq("status", "active")
        .order("product_type", { ascending: true })
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CatalogProduct[];
    },
  });

  // Filter products based on search
  const filteredProducts = products.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.product_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get unique categories from products
  const categories = Array.from(new Set(products.map((p) => p.product_type).filter(Boolean))).sort();

  return (
    <div className="space-y-6 p-6">
      <BackButton />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Scheme Config Master</h1>
          <p className="text-muted-foreground mt-1">
            Configure discounts and schemes for catalog items, categories, and products
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Individual Products</span>
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Categories</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        {/* Individual Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Individual Product Schemes</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Configure discounts and schemes for specific products from your catalog
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {productsLoading ? (
                <p className="text-center text-muted-foreground py-8">Loading products...</p>
              ) : filteredProducts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No products found</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Base Price</TableHead>
                        <TableHead>Display Price</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{product.product_type || "Uncategorized"}</Badge>
                          </TableCell>
                          <TableCell>{fmt(product.base_price)}</TableCell>
                          <TableCell>{product.display_price || "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" disabled>
                              Configure
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Category-Based Schemes</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Configure discounts and schemes for entire product categories
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {categories.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No categories available</p>
              ) : (
                <div className="grid gap-3">
                  {categories.map((category) => {
                    const categoryProducts = products.filter((p) => p.product_type === category);
                    return (
                      <Card key={category} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{category}</h3>
                            <p className="text-sm text-muted-foreground">
                              {categoryProducts.length} product{categoryProducts.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" disabled>
                            Configure
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scheme Configuration Settings</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Global settings for scheme and discount configuration
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Configuration options coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
