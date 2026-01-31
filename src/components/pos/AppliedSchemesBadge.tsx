import { Badge } from "@/components/ui/badge";
import { Tag, Sparkles } from "lucide-react";

interface Scheme {
  id: string;
  name: string;
  discount_type: string;
  discount_value: number;
}

interface AppliedSchemesBadgeProps {
  schemes: Scheme[];
  totalSavings: number;
}

export function AppliedSchemesBadge({ schemes, totalSavings }: AppliedSchemesBadgeProps) {
  if (schemes.length === 0 || totalSavings <= 0) return null;

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-green-600" />
        <span className="text-sm font-medium text-green-700 dark:text-green-400">
          You're saving ₹{totalSavings.toFixed(2)}!
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {schemes.map((scheme) => (
          <Badge
            key={scheme.id}
            variant="secondary"
            className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1"
          >
            <Tag className="h-3 w-3" />
            {scheme.name}
            <span className="opacity-75">
              ({scheme.discount_type === "percentage" 
                ? `${scheme.discount_value}%` 
                : `₹${scheme.discount_value}`})
            </span>
          </Badge>
        ))}
      </div>
    </div>
  );
}
