import { Button } from "@/components/ui/button";

interface DenominationCalculatorProps {
  onDenominationClick: (amount: number) => void;
  grandTotal: number;
}

const DENOMINATIONS = [
  { value: 10, label: "₹10" },
  { value: 20, label: "₹20" },
  { value: 50, label: "₹50" },
  { value: 100, label: "₹100" },
  { value: 200, label: "₹200" },
  { value: 500, label: "₹500" },
  { value: 2000, label: "₹2000" },
];

export function DenominationCalculator({ onDenominationClick, grandTotal }: DenominationCalculatorProps) {
  // Calculate quick amounts based on grand total
  const exactAmount = Math.ceil(grandTotal);
  const roundedUp50 = Math.ceil(grandTotal / 50) * 50;
  const roundedUp100 = Math.ceil(grandTotal / 100) * 100;

  const quickAmounts = [
    { value: exactAmount, label: `Exact ₹${exactAmount}` },
    ...(roundedUp50 !== exactAmount ? [{ value: roundedUp50, label: `₹${roundedUp50}` }] : []),
    ...(roundedUp100 !== exactAmount && roundedUp100 !== roundedUp50 ? [{ value: roundedUp100, label: `₹${roundedUp100}` }] : []),
  ];

  return (
    <div className="space-y-3">
      {/* Quick amounts based on total */}
      {grandTotal > 0 && (
        <div className="flex gap-2 flex-wrap">
          {quickAmounts.map((amount) => (
            <Button
              key={amount.value}
              variant="secondary"
              size="sm"
              onClick={() => onDenominationClick(amount.value)}
              className="flex-1 min-w-[80px]"
            >
              {amount.label}
            </Button>
          ))}
        </div>
      )}

      {/* Standard denominations */}
      <div className="flex gap-1 flex-wrap">
        {DENOMINATIONS.map((denom) => (
          <Button
            key={denom.value}
            variant="outline"
            size="sm"
            onClick={() => onDenominationClick(denom.value)}
            className="flex-1 min-w-[50px] text-xs h-8"
          >
            {denom.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
