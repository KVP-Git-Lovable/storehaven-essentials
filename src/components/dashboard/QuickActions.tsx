import { Plus, AlertTriangle, Wrench, DollarSign, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

type QuickAction = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "default" | "outline";
  route: string;
};

const actions: QuickAction[] = [
  { label: "Add Asset", icon: Plus, variant: "default", route: "/assets/inventory?action=add" },
  { label: "Log Incident", icon: AlertTriangle, variant: "outline", route: "/services/tickets?action=add" },
  { label: "Schedule Maintenance", icon: Wrench, variant: "outline", route: "/services/maintenance?action=add" },
  { label: "Record Expense", icon: DollarSign, variant: "outline", route: "/petty-cash?action=add" },
  { label: "Add Reading", icon: FileText, variant: "outline", route: "/utilities?action=add" },
];

export function QuickActions() {
  const navigate = useNavigate();

  const handleActionClick = (route: string) => {
    navigate(route);
  };

  return (
    <div className="stat-card">
      <h3 className="font-semibold mb-4">Quick Actions</h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button 
            key={action.label} 
            variant={action.variant} 
            size="sm" 
            className="gap-2"
            onClick={() => handleActionClick(action.route)}
          >
            <action.icon className="h-4 w-4" />
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
