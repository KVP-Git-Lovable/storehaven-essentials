import { Loader2, CheckCircle, XCircle, AlertCircle, MinusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type VerificationStatus = "pending" | "verifying" | "matched" | "mismatch" | "skipped";

interface FaceVerificationBadgeProps {
  status: VerificationStatus;
  score?: number | null;
  className?: string;
}

export function FaceVerificationBadge({ status, score, className }: FaceVerificationBadgeProps) {
  const config = {
    pending: {
      icon: AlertCircle,
      label: "Pending",
      variant: "outline" as const,
      className: "text-muted-foreground border-muted-foreground/30",
    },
    verifying: {
      icon: Loader2,
      label: "Verifying...",
      variant: "secondary" as const,
      className: "animate-pulse",
    },
    matched: {
      icon: CheckCircle,
      label: score ? `Matched (${score}%)` : "Matched",
      variant: "default" as const,
      className: "bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20",
    },
    mismatch: {
      icon: XCircle,
      label: score ? `Mismatch (${score}%)` : "Mismatch",
      variant: "destructive" as const,
      className: "bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20",
    },
    skipped: {
      icon: MinusCircle,
      label: "Skipped",
      variant: "outline" as const,
      className: "text-blue-500 border-blue-500/30",
    },
  };

  const { icon: Icon, label, variant, className: statusClassName } = config[status];
  const isAnimated = status === "verifying";

  return (
    <Badge
      variant={variant}
      className={cn("gap-1 font-normal", statusClassName, className)}
    >
      <Icon className={cn("h-3 w-3", isAnimated && "animate-spin")} />
      {label}
    </Badge>
  );
}
