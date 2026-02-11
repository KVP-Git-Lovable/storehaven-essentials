import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  User, 
  ScanLine, 
  Trash2, 
  Pause, 
  Play, 
  CreditCard,
  Keyboard
} from "lucide-react";

interface QuickActionsBarProps {
  onCustomer: () => void;
  onScan: () => void;
  onClear: () => void;
  onHold: () => void;
  onRecall: () => void;
  onPay: () => void;
  hasItems: boolean;
  heldOrdersCount: number;
}

export function QuickActionsBar({
  onCustomer,
  onScan,
  onClear,
  onHold,
  onRecall,
  onPay,
  hasItems,
  heldOrdersCount,
}: QuickActionsBarProps) {
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "F1":
          e.preventDefault();
          onCustomer();
          break;
        case "F2":
          e.preventDefault();
          onScan();
          break;
        case "F3":
          e.preventDefault();
          onClear();
          break;
        case "F4":
          e.preventDefault();
          if (hasItems) onHold();
          break;
        case "F5":
          e.preventDefault();
          onRecall();
          break;
        case "F12":
          e.preventDefault();
          if (hasItems) onPay();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCustomer, onScan, onClear, onHold, onRecall, onPay, hasItems]);

  const actions = [
    { key: "F1", label: "Customer", icon: User, action: onCustomer, color: "text-blue-600" },
    { key: "F2", label: "Scan", icon: ScanLine, action: onScan, color: "text-purple-600" },
    { key: "F3", label: "Clear", icon: Trash2, action: onClear, color: "text-red-600", disabled: !hasItems },
    { key: "F4", label: "Hold", icon: Pause, action: onHold, color: "text-orange-600", disabled: !hasItems },
    { key: "F5", label: "Recall", icon: Play, action: onRecall, color: "text-green-600", badge: heldOrdersCount },
    { key: "F12", label: "Pay", icon: CreditCard, action: onPay, color: "text-primary", disabled: !hasItems },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 p-1.5 sm:p-2 bg-muted/50 rounded-lg">
      <Keyboard className="h-4 w-4 text-muted-foreground mr-1 sm:mr-2 hidden sm:block" />
      {actions.map((action) => (
        <Tooltip key={action.key}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 sm:h-9 sm:px-3 gap-1 sm:gap-2 relative"
              onClick={action.action}
              disabled={action.disabled}
            >
              <action.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${action.color}`} />
              <span className="text-[10px] sm:text-xs font-medium">{action.label}</span>
              <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                {action.key}
              </kbd>
              {action.badge && action.badge > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                  {action.badge}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{action.label} ({action.key})</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
