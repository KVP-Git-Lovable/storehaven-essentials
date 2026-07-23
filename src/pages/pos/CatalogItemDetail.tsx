import { useMemo, useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, ShoppingCart } from "lucide-react";

type Variant = {
  variant_id?: string;
  price?: number;
  purity?: string;
  color?: string;
  size?: string;
  [k: string]: any;
};

const fmt = (n?: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const COLOR_SWATCH: Record<string, string> = {
  "Rose Gold": "#e0b4a0",
  "Yellow Gold": "#e5c04b",
  "White Gold": "#e8e8ee",
  "Gold": "#e5c04b",
  "Silver": "#c0c0c0",
};

export default function CatalogItemDetail() {
  const { handle } = useParams<{ handle: string }>();

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["catalog_product", handle],
    enabled: !!handle,
    queryFn: async () => {
      const isUuid =
        !!handle &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(handle);
      const query = supabase.from("catalog_products").select("*");
      const { data, error } = await (isUuid
        ? query.eq("id", handle!)
        : query.eq("handle", handle!)
      ).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const options = (product?.options ?? {}) as Record<string, string[]>;
  const variants = ((product?.variants ?? []) as Variant[]) || [];
  const optionKeys = Object.keys(options);

  const [selected, setSelected] = useState<Record<string, string>>({});

  useEffect(() => {
    if (product && optionKeys.length && Object.keys(selected).length === 0) {
      const init: Record<string, string> = {};
      optionKeys.forEach((k) => {
        const first = options[k]?.[0];
        if (first) init[k] = first;
      });
      setSelected(init);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const matchedVariant = useMemo(() => {
    if (!variants.length) return null;
    return (
      variants.find((v) =>
        optionKeys.every((k) => {
          const key = k.toLowerCase();
          return (v[key] ?? "").toString() === (selected[k] ?? "");
        })
      ) ?? null
    );
  }, [variants, selected, optionKeys]);

  const currentPrice = matchedVariant?.price ?? product?.base_price ?? null;

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (error) return <div className="p-8 text-destructive">Error loading product: {(error as Error).message}</div>;
  if (!product) return <div className="p-8">Product not found.</div>;

  return (
    <div className="space-y-6">
      <Link to="/pos/catalog" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Catalog
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="overflow-hidden bg-muted">
          <div className="aspect-square flex items-center justify-center">
            {product.image_url ? (
              <img src={product.image_url} alt={product.title} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-16 w-16 text-muted-foreground" />
            )}
          </div>
        </Card>

        <div className="space-y-5">
          {product.vendor && (
            <Badge variant="outline" className="text-xs">{product.vendor}</Badge>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">{product.title}</h1>

          {matchedVariant?.variant_id && (
            <p className="text-xs text-muted-foreground">SKU: {matchedVariant.variant_id}</p>
          )}

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold">{fmt(currentPrice)}</span>
            {product.compare_at_price && currentPrice && product.compare_at_price > currentPrice ? (
              <span className="text-base text-muted-foreground line-through">
                {fmt(product.compare_at_price)}
              </span>
            ) : null}
          </div>

          {optionKeys.map((k) => {
            const isColor = k.toLowerCase() === "color";
            return (
              <div key={k} className="space-y-2">
                <div className="text-sm font-medium">
                  {k}: <span className="text-muted-foreground font-normal">{selected[k]}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(options[k] ?? []).map((val) => {
                    const active = selected[k] === val;
                    if (isColor) {
                      return (
                        <button
                          key={val}
                          onClick={() => setSelected((s) => ({ ...s, [k]: val }))}
                          title={val}
                          className={`h-9 w-9 rounded-full border-2 transition ${active ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                          style={{ background: COLOR_SWATCH[val] ?? "#ccc" }}
                        />
                      );
                    }
                    return (
                      <button
                        key={val}
                        onClick={() => setSelected((s) => ({ ...s, [k]: val }))}
                        className={`px-4 py-2 rounded-md border text-sm transition ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-foreground/40"
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex gap-3 pt-2">
            <Button size="lg" className="flex-1">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Add To Cart
            </Button>
            <Button size="lg" variant="secondary" className="flex-1">
              Buy Now
            </Button>
          </div>

          {product.description && (
            <Card className="p-4">
              <div
                className="prose prose-sm max-w-none text-sm text-muted-foreground [&_p]:my-1"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}