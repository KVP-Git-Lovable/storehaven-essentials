import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coins, Gift, Plus, Minus } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface LoyaltyPointsDisplayProps {
  availablePoints: number;
  pointsValue: number; // Value per point in rupees
  onRedeemPoints?: (points: number) => void;
  pointsToEarn?: number;
  isRedeemable?: boolean;
}

export function LoyaltyPointsDisplay({
  availablePoints,
  pointsValue = 1,
  onRedeemPoints,
  pointsToEarn = 0,
  isRedeemable = true,
}: LoyaltyPointsDisplayProps) {
  const [redeemAmount, setRedeemAmount] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const maxRedeemValue = availablePoints * pointsValue;

  const handleRedeem = () => {
    const points = parseInt(redeemAmount);
    if (points > 0 && points <= availablePoints && onRedeemPoints) {
      onRedeemPoints(points);
      setIsOpen(false);
      setRedeemAmount("");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md">
        <Coins className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
          {availablePoints} pts
        </span>
        <span className="text-xs text-amber-600/70">(₹{maxRedeemValue})</span>
      </div>

      {pointsToEarn > 0 && (
        <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
          <Plus className="h-3 w-3" />
          Earn {pointsToEarn} pts
        </Badge>
      )}

      {isRedeemable && availablePoints > 0 && onRedeemPoints && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Gift className="h-3 w-3" />
              Redeem
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-3">
              <div className="text-sm font-medium">Redeem Loyalty Points</div>
              <div className="text-xs text-muted-foreground">
                Available: {availablePoints} pts = ₹{maxRedeemValue}
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Points to Redeem</Label>
                <Input
                  type="number"
                  placeholder="Enter points"
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  min="1"
                  max={availablePoints}
                  className="h-8"
                />
                {redeemAmount && (
                  <div className="text-xs text-muted-foreground">
                    Value: ₹{(parseInt(redeemAmount) || 0) * pointsValue}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setRedeemAmount(availablePoints.toString())}
                >
                  Use All
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleRedeem}
                  disabled={
                    !redeemAmount ||
                    parseInt(redeemAmount) <= 0 ||
                    parseInt(redeemAmount) > availablePoints
                  }
                >
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
