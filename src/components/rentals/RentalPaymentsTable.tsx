import { useState } from "react";
import { ChevronDown, ChevronRight, Check, Clock, AlertTriangle, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Rental = {
  id: string;
  store: string;
  landlord: string;
  rent: number;
  start_date: string;
  end_date: string;
  status: string;
};

type RentalPayment = {
  id: string;
  rental_id: string;
  month_year: string;
  amount: number;
  due_date: string;
  status: string;
  paid_date: string | null;
};

interface RentalPaymentsTableProps {
  leases: Rental[];
}

export function RentalPaymentsTable({ leases }: RentalPaymentsTableProps) {
  const [expandedLeases, setExpandedLeases] = useState<Set<string>>(new Set());
  const [payments, setPayments] = useState<Record<string, RentalPayment[]>>({});
  const [loadingPayments, setLoadingPayments] = useState<Set<string>>(new Set());
  const [markPaidDialog, setMarkPaidDialog] = useState<{ open: boolean; payment: RentalPayment | null }>({ open: false, payment: null });
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const toggleLease = async (leaseId: string) => {
    const newExpanded = new Set(expandedLeases);
    
    if (newExpanded.has(leaseId)) {
      newExpanded.delete(leaseId);
    } else {
      newExpanded.add(leaseId);
      // Fetch payments if not already loaded
      if (!payments[leaseId]) {
        await fetchPayments(leaseId);
      }
    }
    
    setExpandedLeases(newExpanded);
  };

  const fetchPayments = async (rentalId: string) => {
    setLoadingPayments(prev => new Set(prev).add(rentalId));
    
    const { data, error } = await supabase
      .from("rental_payments")
      .select("*")
      .eq("rental_id", rentalId)
      .order("month_year", { ascending: true });

    if (!error && data) {
      setPayments(prev => ({ ...prev, [rentalId]: data }));
    }
    
    setLoadingPayments(prev => {
      const next = new Set(prev);
      next.delete(rentalId);
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge variant="default" className="bg-success text-success-foreground gap-1">
            <Check className="h-3 w-3" />
            Paid
          </Badge>
        );
      case "overdue":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Overdue
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Unpaid
          </Badge>
        );
    }
  };

  const formatMonthYear = (dateStr: string) => {
    return format(new Date(dateStr), "MMMM yyyy");
  };

  const openMarkPaidDialog = (payment: RentalPayment, e: React.MouseEvent) => {
    e.stopPropagation();
    setPaymentDate(new Date(payment.due_date));
    setMarkPaidDialog({ open: true, payment });
  };

  const handleMarkAsPaid = async () => {
    if (!markPaidDialog.payment || !paymentDate) return;
    
    setIsSubmitting(true);
    const { error } = await supabase
      .from("rental_payments")
      .update({
        status: "paid",
        paid_date: format(paymentDate, "yyyy-MM-dd"),
      })
      .eq("id", markPaidDialog.payment.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update payment status", variant: "destructive" });
    } else {
      // Update local state
      const rentalId = markPaidDialog.payment.rental_id;
      setPayments(prev => ({
        ...prev,
        [rentalId]: prev[rentalId].map(p =>
          p.id === markPaidDialog.payment!.id
            ? { ...p, status: "paid", paid_date: format(paymentDate, "yyyy-MM-dd") }
            : p
        ),
      }));
      toast({ title: "Payment recorded", description: `Payment for ${formatMonthYear(markPaidDialog.payment.month_year)} marked as paid.` });
    }
    
    setIsSubmitting(false);
    setMarkPaidDialog({ open: false, payment: null });
  };

  return (
    <>
    <AlertDialog open={markPaidDialog.open} onOpenChange={(open) => !open && setMarkPaidDialog({ open: false, payment: null })}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark Payment as Paid</AlertDialogTitle>
          <AlertDialogDescription>
            Confirm payment for {markPaidDialog.payment ? formatMonthYear(markPaidDialog.payment.month_year) : ""} 
            {" "}(₹{markPaidDialog.payment ? Number(markPaidDialog.payment.amount).toLocaleString() : 0})
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label className="text-sm font-medium">Payment Date *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal mt-2",
                  !paymentDate && "text-muted-foreground"
                )}
              >
                {paymentDate ? format(paymentDate, "PPP") : "Select payment date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={paymentDate}
                onSelect={setPaymentDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleMarkAsPaid} disabled={isSubmitting || !paymentDate}>
            {isSubmitting ? "Saving..." : "Confirm Payment"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Store</TableHead>
            <TableHead>Landlord</TableHead>
            <TableHead>Monthly Rent</TableHead>
            <TableHead>Lease Period</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leases.map((lease) => (
            <Collapsible key={lease.id} asChild open={expandedLeases.has(lease.id)}>
              <>
                <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleLease(lease.id)}>
                  <TableCell>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        {expandedLeases.has(lease.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </TableCell>
                  <TableCell className="font-medium">{lease.store}</TableCell>
                  <TableCell>{lease.landlord}</TableCell>
                  <TableCell>₹{Number(lease.rent).toLocaleString()}</TableCell>
                  <TableCell>
                    {new Date(lease.start_date).toLocaleDateString()} - {new Date(lease.end_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        lease.status === "active" ? "default" :
                        lease.status === "renewal-due" ? "secondary" : "destructive"
                      }
                    >
                      {lease.status}
                    </Badge>
                  </TableCell>
                </TableRow>
                <CollapsibleContent asChild>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={6} className="p-0">
                      <div className="p-4">
                        <h4 className="text-sm font-semibold mb-3">Monthly Payment Schedule</h4>
                        {loadingPayments.has(lease.id) ? (
                          <p className="text-sm text-muted-foreground">Loading payments...</p>
                        ) : payments[lease.id]?.length ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {payments[lease.id].map((payment) => (
                              <div
                                key={payment.id}
                                className="p-3 rounded-lg border bg-background flex flex-col gap-1"
                              >
                                <span className="text-xs font-medium text-muted-foreground">
                                  {formatMonthYear(payment.month_year)}
                                </span>
                                <span className="text-sm font-semibold">
                                  ₹{Number(payment.amount).toLocaleString()}
                                </span>
                              <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs text-muted-foreground">
                                    Due: {format(new Date(payment.due_date), "dd MMM")}
                                  </span>
                                  {getStatusBadge(payment.status)}
                                </div>
                                {payment.status === "paid" && payment.paid_date && (
                                  <span className="text-xs text-muted-foreground mt-1">
                                    Paid: {format(new Date(payment.paid_date), "dd MMM yyyy")}
                                  </span>
                                )}
                                {payment.status !== "paid" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-2 w-full gap-1 text-xs h-7"
                                    onClick={(e) => openMarkPaidDialog(payment, e)}
                                  >
                                    <CreditCard className="h-3 w-3" />
                                    Mark as Paid
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No payment entries found for this lease.</p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                </CollapsibleContent>
              </>
            </Collapsible>
          ))}
        </TableBody>
      </Table>
    </div>
    </>
  );
}
