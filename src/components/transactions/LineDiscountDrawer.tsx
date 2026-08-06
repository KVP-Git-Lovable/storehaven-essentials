import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

interface LineDiscountDrawerProps {
  open: boolean;
  diaDiscountPercent: string;
  makingDiscountPercent: string;
  onDiaDiscountChange: (value: string) => void;
  onMakingDiscountChange: (value: string) => void;
  onClose: () => void;
}

export function LineDiscountDrawer({
  open,
  diaDiscountPercent,
  makingDiscountPercent,
  onDiaDiscountChange,
  onMakingDiscountChange,
  onClose,
}: LineDiscountDrawerProps) {
  if (!open) return null;

  return (
    <div className="bg-muted/50 border-t p-4 space-y-3">
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="dia-discount" className="text-xs mb-1.5 block">
            Dia Discount (%)
          </Label>
          <Input
            id="dia-discount"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={diaDiscountPercent}
            onChange={(e) => onDiaDiscountChange(e.target.value)}
            placeholder="0"
            className="text-sm"
          />
        </div>
        <div>
          <Label htmlFor="making-discount" className="text-xs mb-1.5 block">
            Making Discount (%)
          </Label>
          <Input
            id="making-discount"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={makingDiscountPercent}
            onChange={(e) => onMakingDiscountChange(e.target.value)}
            placeholder="0"
            className="text-sm"
          />
        </div>
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
