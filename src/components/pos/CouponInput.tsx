import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Ticket, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AppliedCoupon {
  id: string;
  code: string;
  name: string;
  discountAmount: number;
}

interface CouponInputProps {
  appliedCoupon: AppliedCoupon | null;
  onApplyCoupon: (code: string) => Promise<AppliedCoupon | null>;
  onRemoveCoupon: () => void;
  isLoading?: boolean;
}

export function CouponInput({
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  isLoading = false,
}: CouponInputProps) {
  const [couponCode, setCouponCode] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }

    setIsApplying(true);
    try {
      const result = await onApplyCoupon(couponCode.trim().toUpperCase());
      if (result) {
        setCouponCode("");
        toast.success(`Coupon "${result.code}" applied! Saving ₹${result.discountAmount}`);
      }
    } finally {
      setIsApplying(false);
    }
  };

  if (appliedCoupon) {
    return (
      <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-green-600" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-green-700 dark:text-green-400">
                {appliedCoupon.code}
              </span>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                -₹{appliedCoupon.discountAmount.toFixed(2)}
              </Badge>
            </div>
            <span className="text-xs text-green-600/70">{appliedCoupon.name}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-green-600 hover:text-destructive"
          onClick={onRemoveCoupon}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Enter coupon code"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          className="pl-9 h-9"
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
        />
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={handleApply}
        disabled={isApplying || isLoading || !couponCode.trim()}
      >
        {isApplying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
