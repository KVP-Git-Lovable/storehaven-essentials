import { useState, useEffect } from "react";
import { Edit, Copy, Trash2, ClipboardList, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { KnowledgeBaseSuggestions } from "@/components/knowledge/KnowledgeBaseSuggestions";
import { SparesLabourSection } from "@/components/services/SparesLabourSection";

type MaintenanceTask = {
  id: string;
  asset: string;
  asset_id: string | null;
  store_id: string | null;
  task_type: string;
  frequency: string;
  last_done: string;
  next_due: string;
  assigned_to: string;
  status: string;
  store?: { name: string } | null;
  pm_checklist_master_id?: string | null;
  service_contract_id?: string | null;
};

type PMChecklistMaster = {
  id: string;
  name: string;
  task_type: string;
  description: string | null;
};

type PMSection = {
  id: string;
  name: string;
  sort_order: number;
  tasks: PMTask[];
};

type PMTask = {
  id: string;
  name: string;
  instruction: string | null;
  duration_hours: number | null;
  sort_order: number;
};

type MaintenanceDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: MaintenanceTask | null;
  onEdit: () => void;
  onClone: () => void;
  onDeleted: () => void;
};

export function MaintenanceDetailsDialog({
  open,
  onOpenChange,
  task,
  onEdit,
  onClone,
  onDeleted,
}: MaintenanceDetailsDialogProps) {
  const { toast } = useToast();
  const [assetMasterId, setAssetMasterId] = useState<string | null>(null);
  const [checklistMaster, setChecklistMaster] = useState<PMChecklistMaster | null>(null);
  const [checklistSections, setChecklistSections] = useState<PMSection[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [contractCoverage, setContractCoverage] = useState<{
    spares_covered: boolean;
    labour_covered: boolean;
  } | null>(null);

  // Fetch asset master ID and checklist data
  useEffect(() => {
    const fetchData = async () => {
      if (!task) return;

      // Fetch asset master ID
      if (task.asset_id) {
        const { data } = await supabase
          .from("assets")
          .select("asset_master_id")
          .eq("id", task.asset_id)
          .maybeSingle();
        setAssetMasterId(data?.asset_master_id || null);
      } else {
        setAssetMasterId(null);
      }

      // Fetch linked PM checklist master and its sections/tasks
      if (task.pm_checklist_master_id) {
        const [masterRes, sectionsRes] = await Promise.all([
          supabase
            .from("pm_checklist_masters")
            .select("id, name, task_type, description")
            .eq("id", task.pm_checklist_master_id)
            .maybeSingle(),
          supabase
            .from("pm_master_sections")
            .select("id, name, sort_order")
            .eq("master_id", task.pm_checklist_master_id)
            .order("sort_order"),
        ]);

        setChecklistMaster(masterRes.data);

        if (sectionsRes.data) {
          // Fetch tasks for each section
          const sectionIds = sectionsRes.data.map((s) => s.id);
          const { data: tasksData } = await supabase
            .from("pm_master_tasks")
            .select("id, name, instruction, duration_hours, sort_order, section_id")
            .in("section_id", sectionIds)
            .order("sort_order");

          const sectionsWithTasks: PMSection[] = sectionsRes.data.map((section) => ({
            ...section,
            tasks: (tasksData || [])
              .filter((t) => t.section_id === section.id)
              .map((t) => ({
                id: t.id,
                name: t.name,
                instruction: t.instruction,
                duration_hours: t.duration_hours,
                sort_order: t.sort_order,
              })),
          }));

          setChecklistSections(sectionsWithTasks);
          // Expand first section by default
          if (sectionsWithTasks.length > 0) {
            setExpandedSections(new Set([sectionsWithTasks[0].id]));
          }
        }
      } else {
        setChecklistMaster(null);
        setChecklistSections([]);
      }

      // Fetch contract coverage if linked to a service contract
      if (task.service_contract_id) {
        const { data: contractData } = await supabase
          .from("service_contracts")
          .select("spares_included, labour_included")
          .eq("id", task.service_contract_id)
          .maybeSingle();
        
        if (contractData) {
          setContractCoverage({
            spares_covered: contractData.spares_included || false,
            labour_covered: contractData.labour_included || false,
          });
        } else {
          setContractCoverage(null);
        }
      } else {
        setContractCoverage(null);
      }
    };

    if (open && task) {
      fetchData();
    }
  }, [open, task]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  if (!task) return null;

  const handleDelete = async () => {
    const { error } = await supabase
      .from("maintenance_tasks")
      .delete()
      .eq("id", task.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete schedule",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Deleted",
        description: "Maintenance schedule has been deleted.",
      });
      onOpenChange(false);
      onDeleted();
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "scheduled":
        return "default";
      case "due-soon":
        return "secondary";
      case "overdue":
        return "destructive";
      case "completed":
        return "outline";
      default:
        return "default";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Maintenance Schedule Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant={getStatusVariant(task.status)} className="capitalize">
              {task.status}
            </Badge>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={onClone}>
                <Copy className="h-4 w-4 mr-1" />
                Clone
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Maintenance Schedule</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this maintenance schedule? This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div>
              <p className="text-sm text-muted-foreground">Asset</p>
              <p className="font-medium">{task.asset}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Store</p>
              <p className="font-medium">{task.store?.name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Task Type</p>
              <p className="font-medium">{task.task_type}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Frequency</p>
              <p className="font-medium capitalize">{task.frequency}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Done</p>
              <p className="font-medium">
                {task.last_done === "-"
                  ? "-"
                  : new Date(task.last_done).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Next Due</p>
              <p className="font-medium">
                {new Date(task.next_due).toLocaleDateString()}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Assigned To</p>
              <p className="font-medium">{task.assigned_to}</p>
            </div>
          </div>

          {/* PM Checklist Section */}
          {checklistMaster && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    PM Checklist: {checklistMaster.name}
                  </CardTitle>
                  {checklistMaster.description && (
                    <p className="text-sm text-muted-foreground">
                      {checklistMaster.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {checklistSections.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No checklist sections defined.
                    </p>
                  ) : (
                    checklistSections.map((section) => (
                      <Collapsible
                        key={section.id}
                        open={expandedSections.has(section.id)}
                        onOpenChange={() => toggleSection(section.id)}
                      >
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-2 w-full text-left p-2 rounded-md hover:bg-muted transition-colors">
                            {expandedSections.has(section.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span className="font-medium text-sm">{section.name}</span>
                            <Badge variant="secondary" className="ml-auto text-xs">
                              {section.tasks.length} tasks
                            </Badge>
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-6 mt-1 space-y-1">
                            {section.tasks.map((pmTask, idx) => (
                              <div
                                key={pmTask.id}
                                className="flex items-start gap-2 py-1.5 px-2 text-sm border-l-2 border-muted"
                              >
                                <span className="text-muted-foreground min-w-[20px]">
                                  {idx + 1}.
                                </span>
                                <div className="flex-1">
                                  <p>{pmTask.name}</p>
                                  {pmTask.instruction && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {pmTask.instruction}
                                    </p>
                                  )}
                                </div>
                                {pmTask.duration_hours && (
                                  <Badge variant="outline" className="text-xs">
                                    {pmTask.duration_hours}h
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Spares & Labour Section */}
          <Separator />
          <SparesLabourSection
            entityType="maintenance"
            entityId={task.id}
            contractCoverage={contractCoverage}
          />

          {/* Knowledge Base Suggestions */}
          <Separator />
          <KnowledgeBaseSuggestions 
            assetMasterId={assetMasterId} 
            searchContext={task.task_type}
            compact 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
