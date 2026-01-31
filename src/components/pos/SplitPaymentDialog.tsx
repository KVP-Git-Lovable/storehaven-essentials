import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Banknote, CreditCard, Smartphone, Coins, Trash2, Plus } from "lucide-react";
import { DenominationCalculator } from "./DenominationCalculator";

interface PaymentEntry {
  id: string;
  method: "cash" | "upi" | "card" | "loyalty_points";
  amount: number;
  reference?: string;
}

interface SplitPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grandTotal: number;
  loyaltyPoints: number;
  onComplete: (payments: PaymentEntry[]) => void;
  isPending: boolean;
}

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: Banknote, color: "text-green-600" },
  { id: "upi", label: "UPI", icon: Smartphone, color: "text-purple-600" },
  { id: "card", label: "Card", icon: CreditCard, color: "text-blue-600" },
  { id: "loyalty_points", label: "Points", icon: Coins, color: "text-amber-600" },
] as const;

export function SplitPaymentDialog({
  open,
  onOpenChange,
  grandTotal,
  loyaltyPoints,
  onComplete,
  isPending,
}: SplitPaymentDialogProps) {
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [activeMethod, setActiveMethod] = useState<PaymentEntry["method"]>("cash");
  const [currentAmount, setCurrentAmount] = useState("");
  const [currentReference, setCurrentReference] = useState("");

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = grandTotal - totalPaid;
  const pointsValue = loyaltyPoints; // 1 point = ₹1

  const addPayment = () => {
    const amount = parseFloat(currentAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (activeMethod === "loyalty_points" && amount > pointsValue) {
      toast.error(`Insufficient points. Available: ₹${pointsValue}`);
      return;
    }

    if (activeMethod !== "cash" && !currentReference) {
      toast.error("Please enter reference number");
      return;
    }

    const payment: PaymentEntry = {
      id: crypto.randomUUID(),
      method: activeMethod,
      amount,
      reference: currentReference || undefined,
    };

    setPayments([...payments, payment]);
    setCurrentAmount("");
    setCurrentReference("");
  };

  const removePayment = (id: string) => {
    setPayments(payments.filter((p) => p.id !== id));
  };

  const handleComplete = () => {
    if (remaining > 0.01) {
      toast.error(`Please collect remaining ₹${remaining.toFixed(2)}`);
      return;
    }
    onComplete(payments);
  };

  const handleDenominationClick = (amount: number) => {
    setCurrentAmount((prev) => {
      const current = parseFloat(prev) || 0;
      return (current + amount).toString();
    });
  };

  const useRemainingAmount = () => {
    setCurrentAmount(Math.max(0, remaining).toFixed(2));
  };

  const getMethodIcon = (method: PaymentEntry["method"]) => {
    const m = PAYMENT_METHODS.find((pm) => pm.id === method);
    return m ? <m.icon className={`h-4 w-4 ${m.color}`} /> : null;
  };

  const getMethodLabel = (method: PaymentEntry["method"]) => {
    return PAYMENT_METHODS.find((pm) => pm.id === method)?.label || method;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Split Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Total Summary */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-bold">₹{grandTotal.toFixed(2)}</div>
            </div>
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
              <div className="text-xs text-green-600">Paid</div>
              <div className="text-lg font-bold text-green-700 dark:text-green-400">
                ₹{totalPaid.toFixed(2)}
              </div>
            </div>
            <div className={`p-3 rounded-lg ${remaining > 0 ? "bg-orange-100 dark:bg-orange-900/30" : "bg-green-100 dark:bg-green-900/30"}`}>
              <div className={`text-xs ${remaining > 0 ? "text-orange-600" : "text-green-600"}`}>
                {remaining > 0 ? "Remaining" : "Change"}
              </div>
              <div className={`text-lg font-bold ${remaining > 0 ? "text-orange-700 dark:text-orange-400" : "text-green-700 dark:text-green-400"}`}>
                ₹{Math.abs(remaining).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Added Payments */}
          {payments.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Added Payments</Label>
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    {getMethodIcon(payment.method)}
                    <span className="font-medium">{getMethodLabel(payment.method)}</span>
                    {payment.reference && (
                      <span className="text-xs text-muted-foreground">
                        (Ref: {payment.reference})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">₹{payment.amount.toFixed(2)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => removePayment(payment.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Payment Method Selection */}
          <div className="space-y-2">
            <Label>Add Payment</Label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <Button
                  key={method.id}
                  variant={activeMethod === method.id ? "default" : "outline"}
                  className="h-16 flex-col gap-1"
                  onClick={() => setActiveMethod(method.id as PaymentEntry["method"])}
                >
                  <method.icon className={`h-5 w-5 ${activeMethod === method.id ? "" : method.color}`} />
                  <span className="text-xs">{method.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Loyalty Points Info */}
          {activeMethod === "loyalty_points" && (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg text-sm">
              <div className="flex items-center justify-between">
                <span>Available Points</span>
                <Badge variant="secondary">{loyaltyPoints} pts = ₹{pointsValue}</Badge>
              </div>
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Amount</Label>
              {remaining > 0 && (
                <Button variant="link" size="sm" className="h-auto p-0" onClick={useRemainingAmount}>
                  Use remaining ₹{remaining.toFixed(2)}
                </Button>
              )}
            </div>
            <Input
              type="number"
              placeholder="Enter amount"
              value={currentAmount}
              onChange={(e) => setCurrentAmount(e.target.value)}
            />
          </div>

          {/* Denomination Calculator for Cash */}
          {activeMethod === "cash" && (
            <DenominationCalculator
              onDenominationClick={handleDenominationClick}
              grandTotal={remaining}
            />
          )}

          {/* Reference Input */}
          {activeMethod !== "cash" && activeMethod !== "loyalty_points" && (
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input
                placeholder={activeMethod === "upi" ? "UPI Transaction ID" : "Last 4 digits"}
                value={currentReference}
                onChange={(e) => setCurrentReference(e.target.value)}
              />
            </div>
          )}

          {/* Add Payment Button */}
          <Button onClick={addPayment} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Add {getMethodLabel(activeMethod)} Payment
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleComplete}
            disabled={remaining > 0.01 || isPending}
          >
            {isPending ? "Processing..." : `Complete Payment${remaining < 0 ? ` (Change: ₹${Math.abs(remaining).toFixed(2)})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
