import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Building2, IndianRupee, Clock, AlertTriangle, FileText, Pencil } from "lucide-react";
import { format, differenceInDays } from "date-fns";

type ContractSummary = {
  id: string;
  contract_number: string;
  customer_name: string;
  contract_type: string;
  contract_value: number;
  start_date: string;
  end_date: string;
  status: string;
  service_provider?: { name: string } | null;
  assets_count?: number;
  locations_count?: number;
};

interface ContractSummaryCardProps {
  contract: ContractSummary;
  onClick?: () => void;
  onEdit?: () => void;
  canEdit?: boolean;
}

export function ContractSummaryCard({ contract, onClick, onEdit, canEdit }: ContractSummaryCardProps) {
  const daysRemaining = differenceInDays(new Date(contract.end_date), new Date());
  const isExpiringSoon = daysRemaining <= 30 && daysRemaining > 0;
  const isExpired = daysRemaining <= 0;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      active: "default",
      expiring: "secondary",
      expired: "destructive",
      terminated: "destructive",
    };
    return variants[status] || "outline";
  };

  const getContractTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      amc: "AMC",
      warranty: "Warranty",
      sla: "SLA",
      hybrid: "Hybrid",
    };
    return labels[type] || type;
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{contract.contract_number}</span>
            </div>
            <h3 className="font-semibold">{contract.customer_name}</h3>
            {contract.service_provider?.name && (
              <p className="text-sm text-muted-foreground">
                Provider: {contract.service_provider.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canEdit && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleEditClick}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <div className="flex flex-col items-end gap-1">
              <Badge variant={getStatusBadge(contract.status)}>
                {contract.status}
              </Badge>
              <Badge variant="outline">
                {getContractTypeLabel(contract.contract_type)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
            <span>₹{Number(contract.contract_value).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{format(new Date(contract.end_date), "dd MMM yyyy")}</span>
          </div>
          {contract.assets_count !== undefined && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{contract.assets_count} assets</span>
            </div>
          )}
          {contract.locations_count !== undefined && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{contract.locations_count} locations</span>
            </div>
          )}
        </div>

        {(isExpiringSoon || isExpired) && (
          <div className={`mt-3 flex items-center gap-2 text-sm ${isExpired ? 'text-destructive' : 'text-warning'}`}>
            {isExpired ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            <span>
              {isExpired 
                ? `Expired ${Math.abs(daysRemaining)} days ago`
                : `Expires in ${daysRemaining} days`
              }
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
