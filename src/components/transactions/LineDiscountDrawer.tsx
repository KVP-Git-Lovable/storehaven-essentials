import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

interface LineDiscountDrawerProps {
  open: boolean;
  diaDiscountPercent: string;
  diaDiscountAmount: string;
  makingDiscountPercent: string;
  makingDiscountAmount: string;
  onDiaDiscountPercentChange: (value: string) => void;
  onDiaDiscountAmountChange: (value: string) => void;
  onMakingDiscountPercentChange: (value: string) => void;
  onMakingDiscountAmountChange: (value: string) => void;
  onClose: () => void;
}

export function LineDiscountDrawer({
  open,
  diaDiscountPercent,
  diaDiscountAmount,
  makingDiscountPercent,
  makingDiscountAmount,
  onDiaDiscountPercentChange,
  onDiaDiscountAmountChange,
  onMakingDiscountPercentChange,
  onMakingDiscountAmountChange,
  onClose,
}: LineDiscountDrawerProps) {
  if (!open) return null;

  return (
    <div className="bg-muted/50 border-t p-4 space-y-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm">Product Discount</h4>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Dia Discount */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Dia Discount</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="dia-discount-pct" className="text-[11px] mb-1 block text-muted-foreground">
              % Discount
            </Label>
            <Input
              id="dia-discount-pct"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={diaDiscountPercent}
              onChange={(e) => onDiaDiscountPercentChange(e.target.value)}
              placeholder="0"
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="dia-discount-amt" className="text-[11px] mb-1 block text-muted-foreground">
              Fixed Amount (₹)
            </Label>
            <Input
              id="dia-discount-amt"
              type="number"
              min="0"
              step="0.01"
              value={diaDiscountAmount}
              onChange={(e) => onDiaDiscountAmountChange(e.target.value)}
              placeholder="0"
              className="text-sm"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          If % is entered, it will be used. Otherwise, fixed amount will apply.
        </p>
      </div>

      {/* Making Discount */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Making Discount</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="making-discount-pct" className="text-[11px] mb-1 block text-muted-foreground">
              % Discount
            </Label>
            <Input
              id="making-discount-pct"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={makingDiscountPercent}
              onChange={(e) => onMakingDiscountPercentChange(e.target.value)}
              placeholder="0"
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="making-discount-amt" className="text-[11px] mb-1 block text-muted-foreground">
              Fixed Amount (₹)
            </Label>
            <Input
              id="making-discount-amt"
              type="number"
              min="0"
              step="0.01"
              value={makingDiscountAmount}
              onChange={(e) => onMakingDiscountAmountChange(e.target.value)}
              placeholder="0"
              className="text-sm"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          If % is entered, it will be used. Otherwise, fixed amount will apply.
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        onClick={onClose}
        className="w-full"
      >
        Done
      </Button>
    </div>
  );
}
