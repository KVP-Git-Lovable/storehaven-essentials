import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Percent, IndianRupee, Tag } from "lucide-react";

interface LineItemDiscountProps {
  unitPrice: number;
  quantity: number;
  currentDiscountPercent: number;
  currentDiscountAmount: number;
  onApplyDiscount: (discountPercent: number, discountAmount: number) => void;
}

export function LineItemDiscount({
  unitPrice,
  quantity,
  currentDiscountPercent,
  currentDiscountAmount,
  onApplyDiscount,
}: LineItemDiscountProps) {
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const lineTotal = unitPrice * quantity;

  const handleApply = () => {
    const value = parseFloat(discountValue) || 0;
    
    if (discountType === "percent") {
      const clampedPercent = Math.min(100, Math.max(0, value));
      const amount = (lineTotal * clampedPercent) / 100;
      onApplyDiscount(clampedPercent, amount);
    } else {
      const clampedAmount = Math.min(lineTotal, Math.max(0, value));
      const percent = (clampedAmount / lineTotal) * 100;
      onApplyDiscount(percent, clampedAmount);
    }
    
    setIsOpen(false);
    setDiscountValue("");
  };

  const handleClear = () => {
    onApplyDiscount(0, 0);
    setIsOpen(false);
    setDiscountValue("");
  };

  const hasDiscount = currentDiscountAmount > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={hasDiscount ? "secondary" : "ghost"}
          size="icon"
          className={`h-6 w-6 ${hasDiscount ? "text-green-600" : ""}`}
        >
          <Tag className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-3">
          <div className="text-sm font-medium">Line Item Discount</div>
          
          <div className="text-xs text-muted-foreground">
            Line Total: ₹{lineTotal.toFixed(2)}
            {hasDiscount && (
              <span className="ml-2 text-green-600">
                (-₹{currentDiscountAmount.toFixed(2)})
              </span>
            )}
          </div>

          <Tabs value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}>
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="percent" className="text-xs gap-1">
                <Percent className="h-3 w-3" />
                Percent
              </TabsTrigger>
              <TabsTrigger value="fixed" className="text-xs gap-1">
                <IndianRupee className="h-3 w-3" />
                Fixed
              </TabsTrigger>
            </TabsList>

            <TabsContent value="percent" className="mt-2">
              <div className="space-y-2">
                <Label className="text-xs">Discount %</Label>
                <Input
                  type="number"
                  placeholder="e.g., 10"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  min="0"
                  max="100"
                  className="h-8"
                />
              </div>
            </TabsContent>

            <TabsContent value="fixed" className="mt-2">
              <div className="space-y-2">
                <Label className="text-xs">Discount Amount (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 50"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  min="0"
                  max={lineTotal}
                  className="h-8"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2">
            {hasDiscount && (
              <Button variant="outline" size="sm" className="flex-1" onClick={handleClear}>
                Clear
              </Button>
            )}
            <Button size="sm" className="flex-1" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
