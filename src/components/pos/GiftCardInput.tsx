import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Gift, X, Check, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface AppliedGiftCard {
  id: string;
  cardNumber: string;
  balance: number;
  amountToUse: number;
}

interface GiftCardInputProps {
  appliedGiftCard: AppliedGiftCard | null;
  onApplyGiftCard: (cardNumber: string, pin?: string, amount?: number) => Promise<AppliedGiftCard | null>;
  onRemoveGiftCard: () => void;
  maxAmount: number;
  isLoading?: boolean;
}

export function GiftCardInput({
  appliedGiftCard,
  onApplyGiftCard,
  onRemoveGiftCard,
  maxAmount,
  isLoading = false,
}: GiftCardInputProps) {
  const [cardNumber, setCardNumber] = useState("");
  const [pin, setPin] = useState("");
  const [amount, setAmount] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    if (!cardNumber.trim()) {
      toast.error("Please enter a gift card number");
      return;
    }

    setIsApplying(true);
    try {
      const useAmount = parseFloat(amount) || maxAmount;
      const result = await onApplyGiftCard(cardNumber.trim(), pin, useAmount);
      if (result) {
        setCardNumber("");
        setPin("");
        setAmount("");
        setIsOpen(false);
        toast.success(`Gift card applied! Using ₹${result.amountToUse}`);
      }
    } finally {
      setIsApplying(false);
    }
  };

  if (appliedGiftCard) {
    return (
      <div className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-purple-600" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-purple-700 dark:text-purple-400">
                ****{appliedGiftCard.cardNumber.slice(-4)}
              </span>
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                -₹{appliedGiftCard.amountToUse.toFixed(2)}
              </Badge>
            </div>
            <span className="text-xs text-purple-600/70">
              Remaining: ₹{(appliedGiftCard.balance - appliedGiftCard.amountToUse).toFixed(2)}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-purple-600 hover:text-destructive"
          onClick={onRemoveGiftCard}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 w-full justify-start">
          <CreditCard className="h-4 w-4" />
          Apply Gift Card
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <div className="text-sm font-medium">Redeem Gift Card</div>
          
          <div className="space-y-2">
            <Label className="text-xs">Card Number</Label>
            <Input
              placeholder="Enter gift card number"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              className="h-8"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">PIN (if required)</Label>
            <Input
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="h-8"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Amount to Use (Max: ₹{maxAmount.toFixed(2)})</Label>
            <Input
              type="number"
              placeholder={`Up to ₹${maxAmount.toFixed(2)}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              max={maxAmount}
              className="h-8"
            />
          </div>

          <Button
            className="w-full"
            size="sm"
            onClick={handleApply}
            disabled={isApplying || isLoading || !cardNumber.trim()}
          >
            {isApplying ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Apply Gift Card
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
