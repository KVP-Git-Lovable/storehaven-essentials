import { Plus, AlertTriangle, Wrench, DollarSign, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const actions = [
  { label: "Add Asset", icon: Plus, variant: "default" as const },
  { label: "Log Incident", icon: AlertTriangle, variant: "outline" as const },
  { label: "Schedule Maintenance", icon: Wrench, variant: "outline" as const },
  { label: "Record Expense", icon: DollarSign, variant: "outline" as const },
  { label: "Add Reading", icon: FileText, variant: "outline" as const },
];

export function QuickActions() {
  return (
    <div className="stat-card">
      <h3 className="font-semibold mb-4">Quick Actions</h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button key={action.label} variant={action.variant} size="sm" className="gap-2">
            <action.icon className="h-4 w-4" />
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
