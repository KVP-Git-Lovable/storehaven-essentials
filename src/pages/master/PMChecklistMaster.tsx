import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  FolderPlus,
  GripVertical,
  Copy,
  Paperclip,
  Upload,
  X,
  Download,
  Clock,
} from "lucide-react";
import { format } from "date-fns";

interface PMChecklistMaster {
  id: string;
  name: string;
  asset_master_id: string | null;
  brand: string | null;
  task_type: string;
  description: string | null;
  status: string;
  created_at: string;
}

interface PMSection {
  id: string;
  master_id: string;
  name: string;
  sort_order: number;
}

interface PMTask {
  id: string;
  section_id: string;
  name: string;
  instruction: string | null;
  duration_hours: number;
  sort_order: number;
}

interface PMTaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
}

interface AssetMaster {
  id: string;
  name: string;
  categories?: { name: string } | null;
}

const taskTypes = [
  "Preventive Maintenance",
  "Routine Inspection",
  "Deep Cleaning",
  "Calibration",
];

export default function PMChecklistMaster() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedMaster, setSelectedMaster] = useState<PMChecklistMaster | null>(null);
  const [masterDialogOpen, setMasterDialogOpen] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState<PMChecklistMaster | null>(null);
  const [editingSection, setEditingSection] = useState<PMSection | null>(null);
  const [editingTask, setEditingTask] = useState<PMTask | null>(null);
  const [selectedTaskForAttachments, setSelectedTaskForAttachments] = useState<PMTask | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [masterForm, setMasterForm] = useState({
    name: "",
    asset_master_id: "",
    brand: "",
    task_type: "",
    description: "",
    status: "active",
  });
  const [sectionForm, setSectionForm] = useState({ name: "" });
  const [taskForm, setTaskForm] = useState({
    name: "",
    instruction: "",
    duration_hours: 1,
  });

  // Fetch PM checklist masters
  const { data: masters = [] } = useQuery({
    queryKey: ["pm-checklist-masters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_checklist_masters")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PMChecklistMaster[];
    },
  });

  // Fetch asset masters
  const { data: assetMasters = [] } = useQuery({
    queryKey: ["asset-masters-for-pm"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_masters")
        .select("id, name, categories(name)")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as AssetMaster[];
    },
  });

  // Fetch sections for selected master
  const { data: sections = [] } = useQuery({
    queryKey: ["pm-master-sections", selectedMaster?.id],
    queryFn: async () => {
      if (!selectedMaster) return [];
      const { data, error } = await supabase
        .from("pm_master_sections")
        .select("*")
        .eq("master_id", selectedMaster.id)
        .order("sort_order");
      if (error) throw error;
      return data as PMSection[];
    },
    enabled: !!selectedMaster,
  });

  // Fetch tasks for all sections
  const { data: tasks = [] } = useQuery({
    queryKey: ["pm-master-tasks", selectedMaster?.id],
    queryFn: async () => {
      if (!selectedMaster || sections.length === 0) return [];
      const sectionIds = sections.map((s) => s.id);
      const { data, error } = await supabase
        .from("pm_master_tasks")
        .select("*")
        .in("section_id", sectionIds)
        .order("sort_order");
      if (error) throw error;
      return data as PMTask[];
    },
    enabled: !!selectedMaster && sections.length > 0,
  });

  // Fetch attachments for selected task
  const { data: taskAttachments = [] } = useQuery({
    queryKey: ["pm-task-attachments", selectedTaskForAttachments?.id],
    queryFn: async () => {
      if (!selectedTaskForAttachments) return [];
      const { data, error } = await supabase
        .from("pm_task_attachments")
        .select("*")
        .eq("task_id", selectedTaskForAttachments.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PMTaskAttachment[];
    },
    enabled: !!selectedTaskForAttachments,
  });

  // Get asset name by ID
  const getAssetName = (assetMasterId: string | null) => {
    if (!assetMasterId) return "-";
    const asset = assetMasters.find((a) => a.id === assetMasterId);
    return asset ? asset.name : "-";
  };

  // Mutations
  const createMasterMutation = useMutation({
    mutationFn: async (data: typeof masterForm) => {
      const { error } = await supabase.from("pm_checklist_masters").insert({
        name: data.name,
        asset_master_id: data.asset_master_id || null,
        brand: data.brand || null,
        task_type: data.task_type,
        description: data.description || null,
        status: data.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm-checklist-masters"] });
      toast.success("PM Checklist created");
      setMasterDialogOpen(false);
      resetMasterForm();
    },
    onError: () => toast.error("Failed to create PM Checklist"),
  });

  const updateMasterMutation = useMutation({
    mutationFn: async (data: typeof masterForm & { id: string }) => {
      const { error } = await supabase
        .from("pm_checklist_masters")
        .update({
          name: data.name,
          asset_master_id: data.asset_master_id || null,
          brand: data.brand || null,
          task_type: data.task_type,
          description: data.description || null,
          status: data.status,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm-checklist-masters"] });
      toast.success("PM Checklist updated");
      setMasterDialogOpen(false);
      resetMasterForm();
    },
    onError: () => toast.error("Failed to update PM Checklist"),
  });

  const deleteMasterMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pm_checklist_masters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm-checklist-masters"] });
      toast.success("PM Checklist deleted");
      if (selectedMaster) setSelectedMaster(null);
    },
    onError: () => toast.error("Failed to delete PM Checklist"),
  });

  const duplicateMasterMutation = useMutation({
    mutationFn: async (master: PMChecklistMaster) => {
      // Create new master
      const { data: newMaster, error: masterError } = await supabase
        .from("pm_checklist_masters")
        .insert({
          name: `${master.name} (Copy)`,
          asset_master_id: master.asset_master_id,
          brand: master.brand,
          task_type: master.task_type,
          description: master.description,
          status: "active",
        })
        .select()
        .single();
      if (masterError) throw masterError;

      // Copy sections
      const { data: oldSections } = await supabase
        .from("pm_master_sections")
        .select("*")
        .eq("master_id", master.id);

      if (oldSections && oldSections.length > 0) {
        for (const section of oldSections) {
          const { data: newSection, error: sectionError } = await supabase
            .from("pm_master_sections")
            .insert({
              master_id: newMaster.id,
              name: section.name,
              sort_order: section.sort_order,
            })
            .select()
            .single();
          if (sectionError) throw sectionError;

          // Copy tasks for this section
          const { data: oldTasks } = await supabase
            .from("pm_master_tasks")
            .select("*")
            .eq("section_id", section.id);

          if (oldTasks && oldTasks.length > 0) {
            await supabase.from("pm_master_tasks").insert(
              oldTasks.map((task) => ({
                section_id: newSection.id,
                name: task.name,
                instruction: task.instruction,
                duration_hours: task.duration_hours,
                sort_order: task.sort_order,
              }))
            );
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm-checklist-masters"] });
      toast.success("PM Checklist duplicated");
    },
    onError: () => toast.error("Failed to duplicate PM Checklist"),
  });

  const createSectionMutation = useMutation({
    mutationFn: async (data: { name: string; master_id: string }) => {
      const maxOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.sort_order)) + 1 : 0;
      const { error } = await supabase.from("pm_master_sections").insert({
        ...data,
        sort_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm-master-sections"] });
      toast.success("Section created");
      setSectionDialogOpen(false);
      setSectionForm({ name: "" });
    },
    onError: () => toast.error("Failed to create section"),
  });

  const updateSectionMutation = useMutation({
    mutationFn: async (data: { id: string; name: string }) => {
      const { error } = await supabase
        .from("pm_master_sections")
        .update({ name: data.name })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm-master-sections"] });
      toast.success("Section updated");
      setSectionDialogOpen(false);
      setEditingSection(null);
      setSectionForm({ name: "" });
    },
    onError: () => toast.error("Failed to update section"),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pm_master_sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm-master-sections", "pm-master-tasks"] });
      toast.success("Section deleted");
    },
    onError: () => toast.error("Failed to delete section"),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof taskForm & { section_id: string }) => {
      const sectionTasks = tasks.filter((t) => t.section_id === data.section_id);
      const maxOrder = sectionTasks.length > 0 ? Math.max(...sectionTasks.map((t) => t.sort_order)) + 1 : 0;
      const { error } = await supabase.from("pm_master_tasks").insert({
        section_id: data.section_id,
        name: data.name,
        instruction: data.instruction || null,
        duration_hours: data.duration_hours,
        sort_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm-master-tasks"] });
      toast.success("Task created");
      setTaskDialogOpen(false);
      resetTaskForm();
    },
    onError: () => toast.error("Failed to create task"),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: typeof taskForm & { id: string }) => {
      const { error } = await supabase
        .from("pm_master_tasks")
        .update({
          name: data.name,
          instruction: data.instruction || null,
          duration_hours: data.duration_hours,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm-master-tasks"] });
      toast.success("Task updated");
      setTaskDialogOpen(false);
      resetTaskForm();
    },
    onError: () => toast.error("Failed to update task"),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pm_master_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm-master-tasks"] });
      toast.success("Task deleted");
    },
    onError: () => toast.error("Failed to delete task"),
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachment: PMTaskAttachment) => {
      // Delete from storage first
      const fileName = attachment.file_url.split("/").pop();
      if (fileName) {
        await supabase.storage.from("nso-attachments").remove([`pm-tasks/${fileName}`]);
      }
      // Then delete from database
      const { error } = await supabase.from("pm_task_attachments").delete().eq("id", attachment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm-task-attachments"] });
      toast.success("Attachment deleted");
    },
    onError: () => toast.error("Failed to delete attachment"),
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !selectedTaskForAttachments) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `pm-tasks/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("nso-attachments")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("nso-attachments")
          .getPublicUrl(filePath);

        // Save attachment record
        const { error: dbError } = await supabase.from("pm_task_attachments").insert({
          task_id: selectedTaskForAttachments.id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: "system",
        });

        if (dbError) throw dbError;
      }
      
      queryClient.invalidateQueries({ queryKey: ["pm-task-attachments"] });
      toast.success(`${files.length} file(s) uploaded successfully`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload files");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const resetMasterForm = () => {
    setMasterForm({ name: "", asset_master_id: "", brand: "", task_type: "", description: "", status: "active" });
    setEditingMaster(null);
  };

  const resetTaskForm = () => {
    setTaskForm({ name: "", instruction: "", duration_hours: 1 });
    setEditingTask(null);
    setSelectedSectionId(null);
  };

  const handleEditMaster = (master: PMChecklistMaster) => {
    setEditingMaster(master);
    setMasterForm({
      name: master.name,
      asset_master_id: master.asset_master_id || "",
      brand: master.brand || "",
      task_type: master.task_type,
      description: master.description || "",
      status: master.status,
    });
    setMasterDialogOpen(true);
  };

  const handleEditSection = (section: PMSection) => {
    setEditingSection(section);
    setSectionForm({ name: section.name });
    setSectionDialogOpen(true);
  };

  const handleEditTask = (task: PMTask) => {
    setEditingTask(task);
    setTaskForm({
      name: task.name,
      instruction: task.instruction || "",
      duration_hours: task.duration_hours,
    });
    setSelectedSectionId(task.section_id);
    setTaskDialogOpen(true);
  };

  const handleAddTask = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    setTaskDialogOpen(true);
  };

  const handleOpenAttachments = (task: PMTask) => {
    setSelectedTaskForAttachments(task);
    setAttachmentsDialogOpen(true);
  };

  const handleMasterSubmit = () => {
    if (!masterForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!masterForm.task_type) {
      toast.error("Task Type is required");
      return;
    }
    if (editingMaster) {
      updateMasterMutation.mutate({ ...masterForm, id: editingMaster.id });
    } else {
      createMasterMutation.mutate(masterForm);
    }
  };

  const handleSectionSubmit = () => {
    if (!sectionForm.name.trim()) {
      toast.error("Section name is required");
      return;
    }
    if (editingSection) {
      updateSectionMutation.mutate({ id: editingSection.id, name: sectionForm.name });
    } else if (selectedMaster) {
      createSectionMutation.mutate({ name: sectionForm.name, master_id: selectedMaster.id });
    }
  };

  const handleTaskSubmit = () => {
    if (!taskForm.name.trim()) {
      toast.error("Task name is required");
      return;
    }
    if (editingTask) {
      updateTaskMutation.mutate({ ...taskForm, id: editingTask.id });
    } else if (selectedSectionId) {
      createTaskMutation.mutate({ ...taskForm, section_id: selectedSectionId });
    }
  };

  const getTasksForSection = (sectionId: string) => tasks.filter((t) => t.section_id === sectionId);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">PM Checklist Master</h1>
          <p className="text-muted-foreground">
            Create and manage preventive maintenance checklist templates
          </p>
        </div>
        <Button onClick={() => setMasterDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New PM Checklist
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Masters List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border bg-card">
            <div className="p-4 border-b">
              <h3 className="font-semibold">PM Checklists</h3>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {masters.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No PM checklists yet</p>
                  <p className="text-sm">Create your first checklist to get started</p>
                </div>
              ) : (
                masters.map((master) => (
                  <div
                    key={master.id}
                    className={`p-4 cursor-pointer hover:bg-accent/50 transition-colors ${
                      selectedMaster?.id === master.id ? "bg-accent" : ""
                    }`}
                    onClick={() => setSelectedMaster(master)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{master.name}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {master.task_type}
                          </Badge>
                          <Badge
                            variant={master.status === "active" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {master.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Asset: {getAssetName(master.asset_master_id)}
                        </p>
                        {master.brand && (
                          <p className="text-xs text-muted-foreground">Brand: {master.brand}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateMasterMutation.mutate(master);
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditMaster(master);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMasterMutation.mutate(master.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Master Details / Sections & Tasks */}
        <div className="lg:col-span-2">
          {selectedMaster ? (
            <div className="rounded-xl border bg-card">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{selectedMaster.name}</h3>
                    {selectedMaster.description && (
                      <p className="text-sm text-muted-foreground">{selectedMaster.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">{selectedMaster.task_type}</Badge>
                      <Badge variant="secondary">Asset: {getAssetName(selectedMaster.asset_master_id)}</Badge>
                      {selectedMaster.brand && (
                        <Badge variant="secondary">Brand: {selectedMaster.brand}</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingSection(null);
                      setSectionForm({ name: "" });
                      setSectionDialogOpen(true);
                    }}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Add Section
                  </Button>
                </div>
              </div>

              <div className="p-4">
                {sections.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FolderPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No sections yet</p>
                    <p className="text-sm">Add sections to organize your checklist tasks</p>
                  </div>
                ) : (
                  <Accordion type="multiple" defaultValue={sections.map((s) => s.id)} className="space-y-3">
                    {sections.map((section) => (
                      <AccordionItem
                        key={section.id}
                        value={section.id}
                        className="border rounded-lg px-4"
                      >
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center gap-3 flex-1">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{section.name}</span>
                            <Badge variant="outline" className="ml-2">
                              {getTasksForSection(section.id).length} tasks
                            </Badge>
                          </div>
                          <div className="flex gap-1 mr-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEditSection(section)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => deleteSectionMutation.mutate(section.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pt-2 pb-4">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Task Name</TableHead>
                                  <TableHead>Duration (Hours)</TableHead>
                                  <TableHead>Attachments</TableHead>
                                  <TableHead className="w-[120px]">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {getTasksForSection(section.id).map((task) => (
                                  <TableRow key={task.id}>
                                    <TableCell>
                                      <div>
                                        <p className="font-medium">{task.name}</p>
                                        {task.instruction && (
                                          <p className="text-xs text-muted-foreground line-clamp-2">
                                            {task.instruction}
                                          </p>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {task.duration_hours}h
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8"
                                        onClick={() => handleOpenAttachments(task)}
                                      >
                                        <Paperclip className="h-4 w-4 mr-1" />
                                        View
                                      </Button>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => handleEditTask(task)}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-destructive"
                                          onClick={() => deleteTaskMutation.mutate(task.id)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {getTasksForSection(section.id).length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                                      No tasks in this section
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                            <div className="mt-3 pt-3 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddTask(section.id)}
                              >
                                <Plus className="h-3 w-3 mr-2" />
                                Add Task
                              </Button>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Select a PM Checklist</h3>
              <p>Choose a checklist from the list to view and manage its sections and tasks</p>
            </div>
          )}
        </div>
      </div>

      {/* Master Dialog */}
      <Dialog open={masterDialogOpen} onOpenChange={(open) => {
        setMasterDialogOpen(open);
        if (!open) resetMasterForm();
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingMaster ? "Edit PM Checklist" : "New PM Checklist"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={masterForm.name}
                onChange={(e) => setMasterForm({ ...masterForm, name: e.target.value })}
                placeholder="Enter checklist name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset_master">Asset (from Asset Master)</Label>
              <Select
                value={masterForm.asset_master_id || "none"}
                onValueChange={(value) =>
                  setMasterForm({ ...masterForm, asset_master_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select asset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Select Asset --</SelectItem>
                  {assetMasters.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name} {asset.categories?.name ? `(${asset.categories.name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={masterForm.brand}
                onChange={(e) => setMasterForm({ ...masterForm, brand: e.target.value })}
                placeholder="Enter brand name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task_type">Task Type *</Label>
              <Select
                value={masterForm.task_type}
                onValueChange={(value) => setMasterForm({ ...masterForm, task_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select task type" />
                </SelectTrigger>
                <SelectContent>
                  {taskTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={masterForm.description}
                onChange={(e) => setMasterForm({ ...masterForm, description: e.target.value })}
                placeholder="Enter description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={masterForm.status}
                onValueChange={(value) => setMasterForm({ ...masterForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMasterDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMasterSubmit}>
              {editingMaster ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Section Dialog */}
      <Dialog open={sectionDialogOpen} onOpenChange={(open) => {
        setSectionDialogOpen(open);
        if (!open) {
          setSectionForm({ name: "" });
          setEditingSection(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSection ? "Edit Section" : "Add Section"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="section-name">Section Name *</Label>
              <Input
                id="section-name"
                value={sectionForm.name}
                onChange={(e) => setSectionForm({ name: e.target.value })}
                placeholder="Enter section name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSectionSubmit}>
              {editingSection ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={(open) => {
        setTaskDialogOpen(open);
        if (!open) resetTaskForm();
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? "Edit Task" : "Add Task"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-name">Task Name *</Label>
              <Input
                id="task-name"
                value={taskForm.name}
                onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
                placeholder="Enter task name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-instruction">Instruction</Label>
              <Textarea
                id="task-instruction"
                value={taskForm.instruction}
                onChange={(e) => setTaskForm({ ...taskForm, instruction: e.target.value })}
                placeholder="Enter task instructions"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-duration">Duration (Hours)</Label>
              <Input
                id="task-duration"
                type="number"
                min={0.25}
                step={0.25}
                value={taskForm.duration_hours}
                onChange={(e) => setTaskForm({ ...taskForm, duration_hours: parseFloat(e.target.value) || 1 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTaskSubmit}>
              {editingTask ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachments Dialog */}
      <Dialog open={attachmentsDialogOpen} onOpenChange={(open) => {
        setAttachmentsDialogOpen(open);
        if (!open) setSelectedTaskForAttachments(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Attachments - {selectedTaskForAttachments?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-4 mb-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>Uploading...</>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </>
                )}
              </Button>
              <p className="text-sm text-muted-foreground">
                Upload multiple files at once
              </p>
            </div>

            {taskAttachments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <Paperclip className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No attachments yet</p>
                <p className="text-sm">Upload files to attach them to this task</p>
              </div>
            ) : (
              <div className="space-y-2">
                {taskAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{attachment.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {attachment.file_type} • {formatFileSize(attachment.file_size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(attachment.file_url, "_blank")}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteAttachmentMutation.mutate(attachment)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachmentsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
