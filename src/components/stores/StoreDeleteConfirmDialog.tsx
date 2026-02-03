import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, Package, Users, Ticket, Wrench, FileText, Gauge, Wallet } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type LinkedData = {
  assets: number;
  employees: number;
  serviceTickets: number;
  pmTasks: number;
  rentals: number;
  utilityReadings: number;
  pettyCash: number;
  deployments: number;
  contacts: number;
};

type StoreDeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  onDeleted: () => void;
};

export function StoreDeleteConfirmDialog({
  open,
  onOpenChange,
  storeId,
  storeName,
  onDeleted,
}: StoreDeleteConfirmDialogProps) {
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [linkedData, setLinkedData] = useState<LinkedData | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && storeId) {
      fetchLinkedData();
    }
  }, [open, storeId]);

  const fetchLinkedData = async () => {
    setLoading(true);
    try {
      const [
        assetsRes,
        employeesRes,
        ticketsRes,
        pmRes,
        rentalsRes,
        utilityRes,
        pettyCashRes,
        deploymentsRes,
        contactsRes,
      ] = await Promise.all([
        supabase.from("assets").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("service_tickets").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("store_preventive_maintenance").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("rentals").select("id", { count: "exact", head: true }).eq("store", storeName),
        supabase.from("utility_readings").select("id", { count: "exact", head: true }).eq("store", storeName),
        supabase.from("petty_cash").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("store_asset_deployments").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("store_contacts").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      ]);

      setLinkedData({
        assets: assetsRes.count || 0,
        employees: employeesRes.count || 0,
        serviceTickets: ticketsRes.count || 0,
        pmTasks: pmRes.count || 0,
        rentals: rentalsRes.count || 0,
        utilityReadings: utilityRes.count || 0,
        pettyCash: pettyCashRes.count || 0,
        deployments: deploymentsRes.count || 0,
        contacts: contactsRes.count || 0,
      });
    } catch (error) {
      console.error("Error fetching linked data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Unassign assets from this store
      await supabase.from("assets").update({ store_id: null, location: "Unassigned" }).eq("store_id", storeId);

      // Unassign employees from this store
      await supabase.from("employees").update({ store_id: null }).eq("store_id", storeId);

      // Delete store-related records
      await Promise.all([
        supabase.from("store_contacts").delete().eq("store_id", storeId),
        supabase.from("store_asset_deployments").delete().eq("store_id", storeId),
        supabase.from("store_preventive_maintenance").delete().eq("store_id", storeId),
        supabase.from("service_tickets").delete().eq("store_id", storeId),
        supabase.from("petty_cash").delete().eq("store_id", storeId),
        supabase.from("utility_readings").delete().eq("store", storeName),
        supabase.from("rentals").delete().eq("store", storeName),
        supabase.from("store_user_access").delete().eq("store_id", storeId),
      ]);

      // Finally delete the store
      const { error } = await supabase.from("stores").delete().eq("id", storeId);

      if (error) throw error;

      toast({ title: "Store deleted", description: `${storeName} and all linked records have been removed.` });
      onDeleted();
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting store:", error);
      toast({ title: "Error", description: "Failed to delete store", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const hasLinkedData = linkedData && Object.values(linkedData).some(v => v > 0);
  const totalLinked = linkedData ? Object.values(linkedData).reduce((a, b) => a + b, 0) : 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Store: {storeName}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>This action cannot be undone. The store and all related records will be permanently deleted.</p>
              
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm">Checking linked data...</span>
                </div>
              ) : hasLinkedData ? (
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <p className="font-medium text-foreground">
                    This store has {totalLinked} linked record(s) that will be affected:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {linkedData.deployments > 0 && (
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>Deployed Assets: <Badge variant="secondary">{linkedData.deployments}</Badge></span>
                      </div>
                    )}
                    {linkedData.assets > 0 && (
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>Assigned Assets: <Badge variant="secondary">{linkedData.assets}</Badge></span>
                      </div>
                    )}
                    {linkedData.employees > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>Employees: <Badge variant="secondary">{linkedData.employees}</Badge></span>
                      </div>
                    )}
                    {linkedData.serviceTickets > 0 && (
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-muted-foreground" />
                        <span>Service Tickets: <Badge variant="secondary">{linkedData.serviceTickets}</Badge></span>
                      </div>
                    )}
                    {linkedData.pmTasks > 0 && (
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <span>PM Tasks: <Badge variant="secondary">{linkedData.pmTasks}</Badge></span>
                      </div>
                    )}
                    {linkedData.rentals > 0 && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Rentals: <Badge variant="secondary">{linkedData.rentals}</Badge></span>
                      </div>
                    )}
                    {linkedData.utilityReadings > 0 && (
                      <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-muted-foreground" />
                        <span>Utility Readings: <Badge variant="secondary">{linkedData.utilityReadings}</Badge></span>
                      </div>
                    )}
                    {linkedData.pettyCash > 0 && (
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <span>Petty Cash: <Badge variant="secondary">{linkedData.pettyCash}</Badge></span>
                      </div>
                    )}
                    {linkedData.contacts > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>Contacts: <Badge variant="secondary">{linkedData.contacts}</Badge></span>
                      </div>
                    )}
                  </div>
                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    <strong>On delete:</strong> Assets and employees will be unassigned. All other records will be permanently deleted.
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No linked records found for this store.</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading || deleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              "Delete Store"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
