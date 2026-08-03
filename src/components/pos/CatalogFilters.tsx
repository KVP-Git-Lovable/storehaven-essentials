import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { COLOR_SWATCH } from "@/lib/catalogOptions";
import { X } from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

type Props = {
  priceBounds: [number, number];
  priceRange: [number, number];
  onPriceChange: (r: [number, number]) => void;
  karats: string[];
  selectedKarats: string[];
  onToggleKarat: (k: string) => void;
  colors: string[];
  selectedColors: string[];
  onToggleColor: (c: string) => void;
  resultCount: number;
  onClear: () => void;
  hasActiveFilters: boolean;
};

export default function CatalogFilters({
  priceBounds,
  priceRange,
  onPriceChange,
  karats,
  selectedKarats,
  onToggleKarat,
  colors,
  selectedColors,
  onToggleColor,
  resultCount,
  onClear,
  hasActiveFilters,
}: Props) {
  const priceEnabled = priceBounds[1] > priceBounds[0];

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-[240px] flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Price range</span>
            <span className="text-xs text-muted-foreground">
              {priceEnabled ? `${fmt(priceRange[0])} – ${fmt(priceRange[1])}` : "No prices yet"}
            </span>
          </div>
          <Slider
            min={priceBounds[0]}
            max={priceBounds[1]}
            step={Math.max(1, Math.round((priceBounds[1] - priceBounds[0]) / 100))}
            value={priceRange}
            disabled={!priceEnabled}
            onValueChange={(v) => onPriceChange([v[0], v[1]] as [number, number])}
          />
        </div>

        {karats.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Karat</p>
            <div className="flex flex-wrap gap-3">
              {karats.map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedKarats.includes(k)}
                    onCheckedChange={() => onToggleKarat(k)}
                  />
                  {k}
                </label>
              ))}
            </div>
          </div>
        )}

        {colors.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Metal colour</p>
            <div className="flex flex-wrap gap-3">
              {colors.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedColors.includes(c)}
                    onCheckedChange={() => onToggleColor(c)}
                  />
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-border"
                    style={{ background: COLOR_SWATCH[c] ?? "#ccc" }}
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">{resultCount} product(s) shown</span>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="mr-1 h-3 w-3" />
            Clear filters
          </Button>
        )}
      </div>
    </Card>
  );
}