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
import CatalogFilters from "@/components/pos/CatalogFilters";
import { getOptionValues, COLOR_SWATCH } from "@/lib/catalogOptions";
import tr1Asset from "@/assets/tr1.webp.asset.json";
import tr2Asset from "@/assets/tr2.webp.asset.json";
import { useEffect } from "react";
import { calculateEffectivePrice } from "@/services/schemeEvaluationEngine";
import { Scheme } from "@/types/schemes";

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
  const [selectedKarats, setSelectedKarats] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const banners = [tr1Asset.url, tr2Asset.url];
  const [bannerIdx, setBannerIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 2000);
    return () => clearInterval(id);
  }, []);

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

  const { data: schemes = [] } = useQuery({
    queryKey: ["schemes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schemes").select("*").eq("status", "active");
      if (error) throw error;
      return (data ?? []) as Scheme[];
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.product_type && set.add(p.product_type));
    return Array.from(set).sort();
  }, [products]);

  const priceBounds = useMemo<[number, number]>(() => {
    const prices = products.map((p) => p.base_price).filter((n): n is number => n != null);
    if (!prices.length) return [0, 0];
    return [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))];
  }, [products]);

  useEffect(() => {
    setPriceRange(priceBounds[1] > priceBounds[0] ? priceBounds : null);
  }, [priceBounds[0], priceBounds[1]]);

  const karatOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => getOptionValues(p.options, "Karat").forEach((v) => set.add(v)));
    return Array.from(set).sort((a, b) => parseInt(a) - parseInt(b));
  }, [products]);

  const colorOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => getOptionValues(p.options, "Color").forEach((v) => set.add(v)));
    return Array.from(set).sort();
  }, [products]);

  const toggle = (setter: (fn: (s: string[]) => string[]) => void, val: string) =>
    setter((s) => (s.includes(val) ? s.filter((x) => x !== val) : [...s, val]));

  const hasActiveFilters =
    selectedKarats.length > 0 ||
    selectedColors.length > 0 ||
    (!!priceRange &&
      (priceRange[0] !== priceBounds[0] || priceRange[1] !== priceBounds[1]));

  const clearFilters = () => {
    setSelectedKarats([]);
    setSelectedColors([]);
    setPriceRange(priceBounds[1] > priceBounds[0] ? priceBounds : null);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (tab !== "ALL" && p.product_type !== tab) return false;
      if (priceRange && p.base_price != null) {
        if (p.base_price < priceRange[0] || p.base_price > priceRange[1]) return false;
      }
      if (selectedKarats.length) {
        const ks = getOptionValues(p.options, "Karat");
        if (!ks.some((k) => selectedKarats.includes(k))) return false;
      }
      if (selectedColors.length) {
        const cs = getOptionValues(p.options, "Color");
        if (!cs.some((c) => selectedColors.includes(c))) return false;
      }
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.vendor ?? "").toLowerCase().includes(q) ||
        (p.handle ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, search, tab, priceRange, selectedKarats, selectedColors]);

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

      <div className="relative w-full h-32 sm:h-40 md:h-48 rounded-xl overflow-hidden border border-border bg-muted">
        {banners.map((src, i) => (
          <img
            key={src}
            src={src}
            alt="Trayi Jewellers storefront"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === bannerIdx ? "opacity-100" : "opacity-0"}`}
            loading="lazy"
          />
        ))}
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

      <CatalogFilters
        priceBounds={priceBounds}
        priceRange={priceRange ?? priceBounds}
        onPriceChange={setPriceRange}
        karats={karatOptions}
        selectedKarats={selectedKarats}
        onToggleKarat={(k) => toggle(setSelectedKarats, k)}
        colors={colorOptions}
        selectedColors={selectedColors}
        onToggleColor={(c) => toggle(setSelectedColors, c)}
        resultCount={filtered.length}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

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
                <ProductCard key={p.id} p={p} schemes={schemes} />
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

function ProductCard({ p, schemes = [] }: { p: CatalogProduct; schemes?: Scheme[] }) {
  const colors: string[] = getOptionValues(p.options, "Color");
  const karats: string[] = getOptionValues(p.options, "Karat");

  // Calculate effective price using the evaluation engine
  const pricing = p.base_price
    ? calculateEffectivePrice(
        {
          productId: p.id,
          productName: p.title,
          category: p.product_type || "",
          basePrice: p.base_price,
        },
        schemes
      )
    : null;

  const hasSchemeDiscount = pricing && pricing.discountAmount > 0;
  const showOffer = hasSchemeDiscount || (p.compare_at_price && p.base_price && p.compare_at_price > p.base_price);

  return (
    <Link to={`/pos/catalog/${p.handle ?? p.id}`} className="group">
      <Card className="overflow-hidden transition-shadow hover:shadow-lg h-full flex flex-col relative">
        {/* Zig-zag Banner for Scheme */}
        {hasSchemeDiscount && pricing?.applicableScheme && (
          <div className="absolute top-0 left-0 right-0 z-20">
            <svg className="w-full h-auto" viewBox="0 0 400 50" preserveAspectRatio="none" style={{ height: "auto" }}>
              <defs>
                <linearGradient id="bannerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style={{ stopColor: "#dc2626", stopOpacity: 1 }} />
                  <stop offset="50%" style={{ stopColor: "#ea580c", stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: "#dc2626", stopOpacity: 1 }} />
                </linearGradient>
              </defs>

              {/* Zig-zag path */}
              <path d="M 0,30 L 10,10 L 20,30 L 30,10 L 40,30 L 50,10 L 60,30 L 70,10 L 80,30 L 90,10 L 100,30 L 110,10 L 120,30 L 130,10 L 140,30 L 150,10 L 160,30 L 170,10 L 180,30 L 190,10 L 200,30 L 210,10 L 220,30 L 230,10 L 240,30 L 250,10 L 260,30 L 270,10 L 280,30 L 290,10 L 300,30 L 310,10 L 320,30 L 330,10 L 340,30 L 350,10 L 360,30 L 370,10 L 380,30 L 390,10 L 400,30 L 400,50 L 0,50 Z"
                    fill="url(#bannerGradient)" />
            </svg>
            <div className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none" style={{ height: "40px" }}>
              <span className="text-white text-sm font-bold drop-shadow-lg">
                {pricing.applicableScheme.name}
              </span>
            </div>
          </div>
        )}

        <div className="relative aspect-square bg-muted overflow-hidden" style={{ marginTop: hasSchemeDiscount ? "45px" : "0" }}>
          {showOffer ? (
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
            <span className="text-base font-semibold">
              {pricing?.effectivePrice ? fmt(pricing.effectivePrice) : p.base_price == null ? "Price on request" : fmt(p.base_price)}
            </span>
            {hasSchemeDiscount ? (
              <span className="text-xs text-muted-foreground line-through">{fmt(p.base_price)}</span>
            ) : p.compare_at_price && p.base_price && p.compare_at_price > p.base_price ? (
              <span className="text-xs text-muted-foreground line-through">{fmt(p.compare_at_price)}</span>
            ) : null}
          </div>
          {hasSchemeDiscount && (
            <div className="text-xs text-green-600 font-semibold">
              {pricing?.applicableScheme?.discount_type === "percentage" ? (
                <>
                  {pricing.applicableScheme.discount_value}% off
                  {pricing.applicableScheme.max_discount_amount && pricing.discountAmount >= pricing.applicableScheme.max_discount_amount && (
                    <span> (capped at {fmt(pricing.applicableScheme.max_discount_amount)})</span>
                  )}
                  <br />
                  Save {fmt(pricing?.discountAmount)}
                </>
              ) : (
                <>Save {fmt(pricing?.discountAmount)}</>
              )}
            </div>
          )}
          {karats.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {karats.map((k) => (
                <Badge key={k} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {k}
                </Badge>
              ))}
            </div>
          )}
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