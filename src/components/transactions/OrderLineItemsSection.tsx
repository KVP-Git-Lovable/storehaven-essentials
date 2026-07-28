import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { LineItem } from "@/hooks/useOrderPricing";

interface Props {
  lineItems: LineItem[];
  enrichedItems: any[];
  products: any[];
  stockMap: Record<string, number>;
  goldRates: Record<string, number>;
  disabled?: boolean;
  ignoreStock?: boolean;
  onUpdate: (index: number, patch: Partial<LineItem>) => void;
  onRemove: (index: number) => void;
}

/** Shared product line grid used by Sales Order and Sales Return purchase sections. */
export function OrderLineItemsSection({
  lineItems,
  enrichedItems,
  products,
  stockMap,
  goldRates,
  disabled = false,
  ignoreStock = false,
  onUpdate,
  onRemove,
}: Props) {
  return (
    <div className="space-y-3">
      {lineItems.map((item, index) => {
        const calculated = enrichedItems[index];
        if (!calculated) return null;
        return (
          <Card key={calculated.key} className="p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_110px_130px_100px_100px_110px_130px_auto] lg:items-start md:grid-cols-2">
              <div className="min-w-0">
                <Label>Product {index + 1}</Label>
                <SearchableSelect
                  value={item.productId}
                  onValueChange={(value) => onUpdate(index, { productId: value })}
                  options={products.map((p: any) => {
                    const stock = stockMap[p.id] ?? 0;
                    const sku = p.sku || "";
                    return {
                      value: p.id,
                      label: `${sku ? sku + " — " : ""}${p.name} (Stock: ${stock})`,
                      labelNode: (
                        <span>
                          {sku && <span className="font-mono font-bold">{sku}</span>}
                          {sku && <span> — </span>}
                          <span>{p.name}</span>
                          <span className="text-muted-foreground"> (Stock: {stock})</span>
                        </span>
                      ),
                      searchValue: `${sku} ${p.name} ${stock}`,
                      disabled: !ignoreStock && stock <= 0,
                    };
                  })}
                  placeholder="Select product..."
                  searchPlaceholder="Search by SKU / Barcode or name..."
                  disabled={disabled}
                />
                {calculated.product && calculated.priceSource === "fallback" && calculated.product.karat && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Set today's gold rate for {calculated.product.karat} to auto-price by weight.
                  </p>
                )}
                {calculated.product && (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {calculated.product.sku && (
                      <span>
                        LL-Code: <span className="font-medium text-foreground">{calculated.product.sku}</span>
                      </span>
                    )}
                    {calculated.product.netWt > 0 && (
                      <span>
                        Net Wt: <span className="font-medium text-foreground">{calculated.product.netWt}g</span>
                      </span>
                    )}
                    {calculated.product.grossWt > 0 && (
                      <span>
                        Gross Wt: <span className="font-medium text-foreground">{calculated.product.grossWt}g</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <Label>Quantity</Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    disabled={disabled}
                    onClick={() => onUpdate(index, { quantity: String(Math.max(1, (Number(item.quantity) || 1) - 1)) })}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    disabled={disabled}
                    onChange={(e) => onUpdate(index, { quantity: e.target.value })}
                    className="text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    disabled={disabled}
                    onClick={() => onUpdate(index, { quantity: String((Number(item.quantity) || 1) + 1) })}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="min-w-0">
                <Label>Unit Price</Label>
                <Input value={`₹${Math.round(calculated.unitPrice).toLocaleString("en-IN")}`} disabled />
                {calculated.priceSource === "manual" && (
                  <p className="text-[11px] text-muted-foreground mt-1">Manually edited</p>
                )}
                {calculated.product && calculated.priceSource === "gold" && calculated.product.karat && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {calculated.product.netWt}g × ₹
                    {Math.round(goldRates[calculated.product.karat!] || 0).toLocaleString("en-IN")}/g (
                    {calculated.product.karat})
                  </p>
                )}
              </div>
              <div className="min-w-0">
                <Label>Dia Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.diaPrice}
                  disabled={disabled}
                  onChange={(e) => onUpdate(index, { diaPrice: e.target.value })}
                />
              </div>
              <div className="min-w-0">
                <Label>CS Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.csPrice}
                  disabled={disabled}
                  onChange={(e) => onUpdate(index, { csPrice: e.target.value })}
                />
              </div>
              <div className="min-w-0">
                <Label>Making</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.makingCharges}
                  disabled={disabled}
                  onChange={(e) => onUpdate(index, { makingCharges: e.target.value })}
                />
              </div>
              <div className="min-w-0">
                <Label>Line Total</Label>
                <Input value={`₹${Math.round(calculated.lineTotal).toLocaleString("en-IN")}`} disabled />
              </div>
              <div className="flex justify-end lg:pt-[26px]">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => onRemove(index)}
                  disabled={disabled || lineItems.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
