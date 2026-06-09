import { Sparkles, Send, UserPlus, ShoppingCart, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const actions = [
  { label: "Create Journey", icon: Sparkles, variant: "default" as const, route: "/communication/journeys" },
  { label: "Send Campaign", icon: Send, variant: "outline" as const, route: "/communication/whatsapp" },
  { label: "Add Customer", icon: UserPlus, variant: "outline" as const, route: "/transactions/customers?action=add" },
  { label: "Create Order", icon: ShoppingCart, variant: "outline" as const, route: "/pos" },
  { label: "Add Product", icon: Package, variant: "outline" as const, route: "/transactions/products?action=add" },
];

export function MarketingQuickActions() {
  const navigate = useNavigate();
  return (
    <div className="stat-card h-full">
      <h3 className="font-semibold text-sm md:text-base mb-3">Quick Actions</h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a.label} variant={a.variant} size="sm" className="gap-2" onClick={() => navigate(a.route)}>
            <a.icon className="h-3.5 w-3.5" />
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}