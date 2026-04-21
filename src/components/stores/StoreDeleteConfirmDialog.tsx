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
  stockTransfers: number;
  employeeTransferHistory: number;
  cashierSessions: number;
  requisitions: number;
  consumptionLogs: number;
  nsoChecklists: number;
  taskInstances: number;
  storeBudgets: number;
  storeTargets: number;
  footfallRecords: number;
  securityGuards: number;
  securityPatrolPoints: number;
  securityRosterTemplates: number;
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
        transfersFromRes,
        transfersToRes,
        employeeTransfersFromRes,
        employeeTransfersToRes,
        cashierSessionsRes,
        requisitionsRes,
        consumptionLogsRes,
        nsoChecklistsRes,
        taskInstancesRes,
        storeBudgetsRes,
        storeTargetsRes,
        footfallRecordsRes,
        securityGuardsRes,
        securityPatrolPointsRes,
        securityRosterTemplatesRes,
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
        supabase.from("store_transfers").select("id", { count: "exact", head: true }).eq("from_store_id", storeId),
        supabase.from("store_transfers").select("id", { count: "exact", head: true }).eq("to_store_id", storeId),
        supabase.from("employee_transfer_history").select("id", { count: "exact", head: true }).eq("from_store_id", storeId),
        supabase.from("employee_transfer_history").select("id", { count: "exact", head: true }).eq("to_store_id", storeId),
        supabase.from("cashier_sessions").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("requisitions").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("consumption_logs").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("nso_store_checklists").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("task_instances").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("store_budgets").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("store_targets").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("footfall_records").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("security_guards").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("security_patrol_points").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("security_roster_templates").select("id", { count: "exact", head: true }).eq("store_id", storeId),
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
        stockTransfers: (transfersFromRes.count || 0) + (transfersToRes.count || 0),
        employeeTransferHistory: (employeeTransfersFromRes.count || 0) + (employeeTransfersToRes.count || 0),
        cashierSessions: cashierSessionsRes.count || 0,
        requisitions: requisitionsRes.count || 0,
        consumptionLogs: consumptionLogsRes.count || 0,
        nsoChecklists: nsoChecklistsRes.count || 0,
        taskInstances: taskInstancesRes.count || 0,
        storeBudgets: storeBudgetsRes.count || 0,
        storeTargets: storeTargetsRes.count || 0,
        footfallRecords: footfallRecordsRes.count || 0,
        securityGuards: securityGuardsRes.count || 0,
        securityPatrolPoints: securityPatrolPointsRes.count || 0,
        securityRosterTemplates: securityRosterTemplatesRes.count || 0,
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

      // Preserve employee transfer history while removing store references
      await Promise.all([
        supabase.from("employee_transfer_history").update({ from_store_id: null }).eq("from_store_id", storeId),
        supabase.from("employee_transfer_history").update({ to_store_id: null }).eq("to_store_id", storeId),
      ]);

      // Remove stock transfer records that still reference this store
      const { data: transferIds } = await supabase
        .from("store_transfers")
        .select("id")
        .or(`from_store_id.eq.${storeId},to_store_id.eq.${storeId}`);

      if (transferIds?.length) {
        const ids = transferIds.map((transfer) => transfer.id);
        await supabase.from("store_transfer_items").delete().in("transfer_id", ids);
        await supabase.from("store_transfers").delete().in("id", ids);
      }

      const [
        { data: requisitionIds },
        { data: nsoChecklistIds },
        { data: taskInstanceIds },
        { data: storeBudgetIds },
        { data: storeTargetIds },
        { data: securityGuardIds },
        { data: patrolPointIds },
        { data: patrolRouteIds },
      ] = await Promise.all([
        supabase.from("requisitions").select("id").eq("store_id", storeId),
        supabase.from("nso_store_checklists").select("id").eq("store_id", storeId),
        supabase.from("task_instances").select("id").eq("store_id", storeId),
        supabase.from("store_budgets").select("id").eq("store_id", storeId),
        supabase.from("store_targets").select("id").eq("store_id", storeId),
        supabase.from("security_guards").select("id").eq("store_id", storeId),
        supabase.from("security_patrol_points").select("id").eq("store_id", storeId),
        supabase.from("security_patrol_routes").select("id").eq("store_id", storeId),
      ]);

      if (taskInstanceIds?.length) {
        const ids = taskInstanceIds.map((task) => task.id);
        await Promise.all([
          supabase.from("task_completions").delete().in("task_instance_id", ids),
          supabase.from("task_escalations").delete().in("task_instance_id", ids),
          supabase.from("task_instance_checklist_items").delete().in("task_instance_id", ids),
        ]);
        await supabase.from("task_instances").delete().in("id", ids);
      }

      if (storeTargetIds?.length) {
        const ids = storeTargetIds.map((target) => target.id);
        await Promise.all([
          supabase.from("store_target_members").delete().in("store_target_id", ids),
          supabase.from("store_target_months").delete().in("store_target_id", ids),
          supabase.from("store_target_products").delete().in("store_target_id", ids),
        ]);
        await supabase.from("store_targets").delete().in("id", ids);
      }

      if (storeBudgetIds?.length) {
        const ids = storeBudgetIds.map((budget) => budget.id);
        await Promise.all([
          supabase.from("budget_approval_history").delete().in("budget_id", ids),
          supabase.from("store_budget_items").delete().in("budget_id", ids),
        ]);
        await supabase.from("store_budgets").delete().in("id", ids);
      }

      if (nsoChecklistIds?.length) {
        const ids = nsoChecklistIds.map((checklist) => checklist.id);
        await Promise.all([
          supabase.from("nso_store_assets").delete().in("checklist_id", ids),
          supabase.from("nso_store_budget_items").delete().in("checklist_id", ids),
          supabase.from("nso_store_tasks").delete().in("checklist_id", ids),
          supabase.from("nso_store_sections").delete().in("checklist_id", ids),
        ]);
        await supabase.from("nso_store_checklists").delete().in("id", ids);
      }

      if (requisitionIds?.length) {
        const ids = requisitionIds.map((requisition) => requisition.id);
        await supabase.from("requisition_items").delete().in("requisition_id", ids);
        await supabase.from("requisitions").delete().in("id", ids);
      }

      if (patrolRouteIds?.length) {
        const ids = patrolRouteIds.map((route) => route.id);
        await Promise.all([
          supabase.from("security_patrol_visits").delete().in("route_point_id", ids),
          supabase.from("security_route_points").delete().in("route_id", ids),
        ]);
      }

      if (patrolPointIds?.length) {
        const ids = patrolPointIds.map((point) => point.id);
        await Promise.all([
          supabase.from("security_patrol_visits").delete().in("patrol_point_id", ids),
          supabase.from("security_route_points").delete().in("patrol_point_id", ids),
        ]);
        await supabase.from("security_patrol_points").delete().in("id", ids);
      }

      if (patrolRouteIds?.length) {
        const ids = patrolRouteIds.map((route) => route.id);
        await supabase.from("security_patrol_routes").delete().in("id", ids);
      }

      if (securityGuardIds?.length) {
        const ids = securityGuardIds.map((guard) => guard.id);
        await Promise.all([
          supabase.from("security_points_log").delete().in("guard_id", ids),
          supabase.from("security_patrol_visits").delete().in("guard_id", ids),
          supabase.from("security_guard_feedback").delete().in("guard_id", ids),
          supabase.from("security_roster_daily").delete().in("guard_id", ids),
          supabase.from("security_roster_templates").delete().in("guard_id", ids),
        ]);
        await supabase.from("security_guards").delete().in("id", ids);
      }

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
        supabase.from("cashier_sessions").update({ store_id: null }).eq("store_id", storeId),
        supabase.from("footfall_records").delete().eq("store_id", storeId),
        supabase.from("consumption_logs").delete().eq("store_id", storeId),
        supabase.from("security_roster_templates").delete().eq("store_id", storeId),
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
                    {linkedData.stockTransfers > 0 && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Stock Transfers: <Badge variant="secondary">{linkedData.stockTransfers}</Badge></span>
                      </div>
                    )}
                    {linkedData.employeeTransferHistory > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>Employee Transfers: <Badge variant="secondary">{linkedData.employeeTransferHistory}</Badge></span>
                      </div>
                    )}
                    {linkedData.cashierSessions > 0 && (
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <span>Cashier Sessions: <Badge variant="secondary">{linkedData.cashierSessions}</Badge></span>
                      </div>
                    )}
                    {linkedData.requisitions > 0 && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Requisitions: <Badge variant="secondary">{linkedData.requisitions}</Badge></span>
                      </div>
                    )}
                    {linkedData.consumptionLogs > 0 && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Consumption Logs: <Badge variant="secondary">{linkedData.consumptionLogs}</Badge></span>
                      </div>
                    )}
                    {linkedData.nsoChecklists > 0 && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>NSO Checklists: <Badge variant="secondary">{linkedData.nsoChecklists}</Badge></span>
                      </div>
                    )}
                    {linkedData.taskInstances > 0 && (
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <span>Task Instances: <Badge variant="secondary">{linkedData.taskInstances}</Badge></span>
                      </div>
                    )}
                    {linkedData.storeBudgets > 0 && (
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <span>Store Budgets: <Badge variant="secondary">{linkedData.storeBudgets}</Badge></span>
                      </div>
                    )}
                    {linkedData.storeTargets > 0 && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Store Targets: <Badge variant="secondary">{linkedData.storeTargets}</Badge></span>
                      </div>
                    )}
                    {linkedData.footfallRecords > 0 && (
                      <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-muted-foreground" />
                        <span>Footfall Records: <Badge variant="secondary">{linkedData.footfallRecords}</Badge></span>
                      </div>
                    )}
                    {linkedData.securityGuards > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>Security Guards: <Badge variant="secondary">{linkedData.securityGuards}</Badge></span>
                      </div>
                    )}
                    {linkedData.securityPatrolPoints > 0 && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Patrol Points: <Badge variant="secondary">{linkedData.securityPatrolPoints}</Badge></span>
                      </div>
                    )}
                    {linkedData.securityRosterTemplates > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>Security Rosters: <Badge variant="secondary">{linkedData.securityRosterTemplates}</Badge></span>
                      </div>
                    )}
                  </div>
                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    <strong>On delete:</strong> Assets and employees will be unassigned, employee transfer history will be preserved without store links, and dependent operational records will be deleted.
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
