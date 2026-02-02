import { useState, useEffect } from "react";
import { Plus, Search, Image, Calendar, Loader2, Trash2, Eye, Pencil } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const planogramSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  zone: z.string().min(1, "Zone is required"),
  deadline: z.string().optional(),
});

type PlanogramFormData = z.infer<typeof planogramSchema>;

type Planogram = {
  id: string;
  title: string;
  description: string | null;
  zone: string;
  image_url: string;
  deadline: string | null;
  status: string;
  created_at: string;
};

const zoneOptions = [
  { value: "window", label: "Window Display" },
  { value: "aisle", label: "Aisle" },
  { value: "counter", label: "Counter" },
  { value: "end-cap", label: "End-Cap" },
  { value: "entrance", label: "Entrance" },
  { value: "checkout", label: "Checkout Area" },
];

export default function Planograms() {
  const [searchQuery, setSearchQuery] = useState("");
  const [planograms, setPlanograms] = useState<Planogram[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedPlanogram, setSelectedPlanogram] = useState<Planogram | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planogramToDelete, setPlanogramToDelete] = useState<Planogram | null>(null);
  const { toast } = useToast();

  const form = useForm<PlanogramFormData>({
    resolver: zodResolver(planogramSchema),
    defaultValues: {
      title: "",
      description: "",
      zone: "",
      deadline: "",
    },
  });

  useEffect(() => {
    fetchPlanograms();
  }, []);

  const fetchPlanograms = async () => {
    const { data, error } = await supabase
      .from("planograms")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to load planograms", variant: "destructive" });
    } else {
      setPlanograms(data || []);
    }
    setLoading(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const resetForm = () => {
    form.reset({
      title: "",
      description: "",
      zone: "",
      deadline: "",
    });
    setSelectedImage(null);
    setPreviewUrl(null);
    setEditMode(false);
    setSelectedPlanogram(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditDialog = (planogram: Planogram) => {
    setEditMode(true);
    setSelectedPlanogram(planogram);
    form.reset({
      title: planogram.title,
      description: planogram.description || "",
      zone: planogram.zone,
      deadline: planogram.deadline ? new Date(planogram.deadline).toISOString().slice(0, 16) : "",
    });
    setPreviewUrl(planogram.image_url);
    setFormOpen(true);
  };

  const openViewDialog = (planogram: Planogram) => {
    setSelectedPlanogram(planogram);
    setViewOpen(true);
  };

  const openDeleteDialog = (planogram: Planogram) => {
    setPlanogramToDelete(planogram);
    setDeleteDialogOpen(true);
  };

  const onSubmit = async (data: PlanogramFormData) => {
    if (!editMode && !selectedImage) {
      toast({ title: "Error", description: "Please select an image", variant: "destructive" });
      return;
    }

    setUploading(true);
    
    let imageUrl = selectedPlanogram?.image_url || "";

    // Upload new image if selected
    if (selectedImage) {
      const fileExt = selectedImage.name.split(".").pop();
      const fileName = `planograms/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("vm-images")
        .upload(fileName, selectedImage);

      if (uploadError) {
        toast({ title: "Error", description: "Failed to upload image", variant: "destructive" });
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("vm-images").getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    }

    if (editMode && selectedPlanogram) {
      // Update existing planogram
      const { error } = await supabase
        .from("planograms")
        .update({
          title: data.title,
          description: data.description || null,
          zone: data.zone,
          image_url: imageUrl,
          deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
        })
        .eq("id", selectedPlanogram.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update planogram", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Planogram updated successfully" });
        resetForm();
        setFormOpen(false);
        fetchPlanograms();
      }
    } else {
      // Create new planogram
      const { error } = await supabase.from("planograms").insert({
        title: data.title,
        description: data.description || null,
        zone: data.zone,
        image_url: imageUrl,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      });

      if (error) {
        toast({ title: "Error", description: "Failed to create planogram", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Planogram created successfully" });
        resetForm();
        setFormOpen(false);
        fetchPlanograms();
      }
    }
    setUploading(false);
  };

  const handleDeleteConfirm = async () => {
    if (!planogramToDelete) return;

    const { error } = await supabase.from("planograms").delete().eq("id", planogramToDelete.id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete planogram", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Planogram removed" });
      fetchPlanograms();
    }
    setDeleteDialogOpen(false);
    setPlanogramToDelete(null);
  };

  const filteredPlanograms = planograms.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.zone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getZoneLabel = (value: string) => 
    zoneOptions.find((z) => z.value === value)?.label || value;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Planogram Repository</h1>
          <p className="text-muted-foreground">Manage master planograms and base photos</p>
        </div>
        <Button className="gap-2" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          Add Planogram
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search planograms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {filteredPlanograms.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No planograms found. Create your first master planogram.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pb-4">
            {filteredPlanograms.map((planogram) => (
              <Card key={planogram.id} className="overflow-hidden">
                <div className="aspect-video relative">
                  <img
                    src={planogram.image_url}
                    alt={planogram.title}
                    className="w-full h-full object-cover"
                  />
                  <Badge className="absolute top-2 right-2">{getZoneLabel(planogram.zone)}</Badge>
                </div>
                <CardHeader className="pb-2">
                  <h3 className="font-semibold">{planogram.title}</h3>
                  {planogram.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{planogram.description}</p>
                  )}
                </CardHeader>
                <CardContent className="pb-2">
                  {planogram.deadline && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Due: {new Date(planogram.deadline).toLocaleDateString()}</span>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => openViewDialog(planogram)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(planogram)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteDialog(planogram)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{editMode ? "Edit Planogram" : "Create Master Planogram"}</DialogTitle>
            <DialogDescription>
              {editMode ? "Update the planogram details below." : "Fill in the details to create a new planogram."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Spring Collection Window Display" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zone</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select zone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {zoneOptions.map((zone) => (
                            <SelectItem key={zone.value} value={zone.value}>{zone.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe the display requirements..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deadline</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div>
                  <FormLabel>Base Photo {editMode && "(optional - leave empty to keep current)"}</FormLabel>
                  <div className="mt-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="cursor-pointer"
                    />
                    {previewUrl && (
                      <div className="mt-2 rounded-lg overflow-hidden border">
                        <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-background pb-2">
                  <Button type="button" variant="outline" onClick={() => { setFormOpen(false); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={uploading}>
                    {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editMode ? "Save Changes" : "Create Planogram"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{selectedPlanogram?.title}</DialogTitle>
            <DialogDescription>View planogram details and image.</DialogDescription>
          </DialogHeader>
          {selectedPlanogram && (
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="space-y-4 pb-4">
                <div className="rounded-lg overflow-hidden border">
                  <img
                    src={selectedPlanogram.image_url}
                    alt={selectedPlanogram.title}
                    className="w-full object-contain max-h-[400px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Zone</p>
                    <p className="font-medium">{getZoneLabel(selectedPlanogram.zone)}</p>
                  </div>
                  {selectedPlanogram.deadline && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Deadline</p>
                      <p className="font-medium">{new Date(selectedPlanogram.deadline).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
                {selectedPlanogram.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Description</p>
                    <p className="mt-1">{selectedPlanogram.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created</p>
                  <p className="mt-1">{new Date(selectedPlanogram.created_at).toLocaleString()}</p>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setViewOpen(false)}>
                    Close
                  </Button>
                  <Button onClick={() => { setViewOpen(false); openEditDialog(selectedPlanogram); }}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Planogram</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{planogramToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
