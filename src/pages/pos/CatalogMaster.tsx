import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, Search, Package } from "lucide-react";
import CatalogImportDialog from "@/components/pos/CatalogImportDialog";

type CatalogProduct = {
  id: string;
  title: string;
  handle: string | null;
  vendor: string | null;
  product_type: string | null;
  image_url: string | null;
  display_price: string | null;
  base_price: number | null;
  compare_at_price: number | null;
  options: Record<string, string[]> | null;
  variants: any[] | null;
};

const fmt = (n: number | null | undefined) =>
  n == null ? "" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function CatalogMaster() {
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [tab, setTab] = useState<string>("ALL");

  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ["catalog_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_products")
        .select("id,title,handle,vendor,product_type,image_url,display_price,base_price,compare_at_price,options,variants")
        .eq("status", "active")
        .order("product_type", { ascending: true })
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CatalogProduct[];
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.product_type && set.add(p.product_type));
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (tab !== "ALL" && p.product_type !== tab) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.vendor ?? "").toLowerCase().includes(q) ||
        (p.handle ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, search, tab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catalog Master</h1>
          <p className="text-sm text-muted-foreground">
            Browse and manage the product catalog available at Point of Sale.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import catalog
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, vendor or handle..."
            className="pl-9"
          />
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="ALL">All ({products.length})</TabsTrigger>
          {categories.map((c) => (
            <TabsTrigger key={c} value={c}>
              {c} ({products.filter((p) => p.product_type === c).length})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="mt-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading catalog...</div>
          ) : filtered.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold">No products found</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Try changing your filters or import a catalog CSV to get started.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filtered.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CatalogImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => refetch()}
      />
    </div>
  );
}

const COLOR_SWATCH: Record<string, string> = {
  "Rose Gold": "#e0b4a0",
  "Yellow Gold": "#e5c04b",
  "White Gold": "#e8e8ee",
  "Gold": "#e5c04b",
  "Silver": "#c0c0c0",
};

function ProductCard({ p }: { p: CatalogProduct }) {
  const colors: string[] = (p.options as any)?.Color ?? [];
  return (
    <Link to={`/pos/catalog/${p.handle ?? p.id}`} className="group">
      <Card className="overflow-hidden transition-shadow hover:shadow-lg h-full flex flex-col">
        <div className="relative aspect-square bg-muted overflow-hidden">
          {p.compare_at_price && p.base_price && p.compare_at_price > p.base_price ? (
            <Badge className="absolute left-2 top-2 z-10 bg-primary text-primary-foreground">
              OFFER VALID
            </Badge>
          ) : null}
          {p.image_url ? (
            <img
              src={p.image_url}
              alt={p.title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Package className="h-10 w-10" />
            </div>
          )}
        </div>
        <div className="p-4 flex flex-col gap-2 flex-1">
          <h3 className="font-medium leading-tight line-clamp-2">{p.title}</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold">{fmt(p.base_price)}</span>
            {p.compare_at_price && p.base_price && p.compare_at_price > p.base_price ? (
              <span className="text-xs text-muted-foreground line-through">{fmt(p.compare_at_price)}</span>
            ) : null}
          </div>
          {colors.length > 0 && (
            <div className="flex gap-1.5 mt-auto pt-1">
              {colors.slice(0, 5).map((c) => (
                <span
                  key={c}
                  title={c}
                  className="h-4 w-4 rounded-full border border-border"
                  style={{ background: COLOR_SWATCH[c] ?? "#ccc" }}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}