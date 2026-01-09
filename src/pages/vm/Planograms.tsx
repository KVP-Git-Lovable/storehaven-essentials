import { useState, useEffect } from "react";
import { Plus, Search, Image, Calendar, Loader2, Trash2, Eye } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [open, setOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

  const onSubmit = async (data: PlanogramFormData) => {
    if (!selectedImage) {
      toast({ title: "Error", description: "Please select an image", variant: "destructive" });
      return;
    }

    setUploading(true);
    
    // Upload image to storage
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

    const { error } = await supabase.from("planograms").insert({
      title: data.title,
      description: data.description || null,
      zone: data.zone,
      image_url: urlData.publicUrl,
      deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to create planogram", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Planogram created successfully" });
      form.reset();
      setSelectedImage(null);
      setPreviewUrl(null);
      setOpen(false);
      fetchPlanograms();
    }
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("planograms").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete planogram", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Planogram removed" });
      fetchPlanograms();
    }
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Planogram Repository</h1>
          <p className="text-muted-foreground">Manage master planograms and base photos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Planogram
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Master Planogram</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  <FormLabel>Base Photo</FormLabel>
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
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={uploading}>
                    {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Planogram
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
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

      {filteredPlanograms.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No planograms found. Create your first master planogram.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                <Button variant="outline" size="sm" className="flex-1">
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(planogram.id)}
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
  );
}
