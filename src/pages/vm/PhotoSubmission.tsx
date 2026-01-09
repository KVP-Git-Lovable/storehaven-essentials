import { useState, useEffect, useRef } from "react";
import { Camera, Upload, MapPin, Clock, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type ComplianceTask = {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: string;
  planogram: { id: string; title: string; image_url: string } | null;
  store: { id: string; name: string } | null;
};

export default function PhotoSubmission() {
  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTasks();
    getLocation();
  }, []);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("vm_compliance_tasks")
      .select(`
        *,
        planogram:planograms(id, title, image_url),
        store:stores(id, name)
      `)
      .in("status", ["pending", "correction_required"])
      .order("due_date", { ascending: true });

    if (error) {
      toast({ title: "Error", description: "Failed to load tasks", variant: "destructive" });
    } else {
      setTasks(data as ComplianceTask[] || []);
    }
    setLoading(false);
  };

  const getLocation = () => {
    setGettingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          // Simple reverse geocoding placeholder - in production use a proper API
          setLocation({
            lat: latitude,
            lng: longitude,
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          });
          setGettingLocation(false);
        },
        (error) => {
          console.error("Location error:", error);
          setGettingLocation(false);
          toast({ title: "Location", description: "Could not get GPS location", variant: "destructive" });
        }
      );
    } else {
      setGettingLocation(false);
    }
  };

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCapturedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTaskId) {
      toast({ title: "Error", description: "Please select a task", variant: "destructive" });
      return;
    }
    if (!capturedFile) {
      toast({ title: "Error", description: "Please capture a photo", variant: "destructive" });
      return;
    }

    setUploading(true);

    // Upload image to storage
    const fileExt = capturedFile.name.split(".").pop();
    const fileName = `submissions/${selectedTaskId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("vm-images")
      .upload(fileName, capturedFile);

    if (uploadError) {
      toast({ title: "Error", description: "Failed to upload photo", variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("vm-images").getPublicUrl(fileName);

    // Create submission record
    const { error: submissionError } = await supabase.from("vm_photo_submissions").insert({
      task_id: selectedTaskId,
      image_url: urlData.publicUrl,
      latitude: location?.lat || null,
      longitude: location?.lng || null,
      location_address: location?.address || null,
      captured_at: new Date().toISOString(),
      notes: notes || null,
    });

    if (submissionError) {
      toast({ title: "Error", description: "Failed to submit photo", variant: "destructive" });
      setUploading(false);
      return;
    }

    // Update task status to submitted
    await supabase
      .from("vm_compliance_tasks")
      .update({ status: "submitted" })
      .eq("id", selectedTaskId);

    toast({ title: "Success", description: "Photo submitted for review" });
    setCapturedImage(null);
    setCapturedFile(null);
    setNotes("");
    setSelectedTaskId("");
    fetchTasks();
    setUploading(false);
  };

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">Submit Compliance Photo</h1>
        <p className="text-muted-foreground">Capture and upload store display photos for compliance review</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Task Selection & Base Photo */}
        <Card>
          <CardHeader>
            <CardTitle>Select Task</CardTitle>
            <CardDescription>Choose a pending compliance task to submit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a task" />
              </SelectTrigger>
              <SelectContent>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title} - {task.store?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTask && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{selectedTask.title}</span>
                    <Badge variant={selectedTask.status === "correction_required" ? "destructive" : "outline"}>
                      {selectedTask.status}
                    </Badge>
                  </div>
                  {selectedTask.description && (
                    <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Due: {new Date(selectedTask.due_date).toLocaleString()}</span>
                  </div>
                </div>

                {selectedTask.planogram && (
                  <div>
                    <Label className="mb-2 block">Reference Planogram (Base Photo)</Label>
                    <div className="rounded-lg overflow-hidden border">
                      <img
                        src={selectedTask.planogram.image_url}
                        alt="Base planogram"
                        className="w-full h-48 object-cover"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{selectedTask.planogram.title}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Photo Capture */}
        <Card>
          <CardHeader>
            <CardTitle>Capture Photo</CardTitle>
            <CardDescription>Take a photo of your store display for comparison</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCapture}
              className="hidden"
            />

            {capturedImage ? (
              <div className="space-y-4">
                <div className="rounded-lg overflow-hidden border">
                  <img src={capturedImage} alt="Captured" className="w-full h-48 object-cover" />
                </div>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                  <Camera className="h-4 w-4 mr-2" />
                  Retake Photo
                </Button>
              </div>
            ) : (
              <Button onClick={() => fileInputRef.current?.click()} className="w-full h-32" variant="outline">
                <div className="flex flex-col items-center gap-2">
                  <Camera className="h-8 w-8" />
                  <span>Capture Photo</span>
                </div>
              </Button>
            )}

            {/* Location Info */}
            <div className="p-3 rounded-lg bg-muted">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {gettingLocation ? (
                  <span className="text-sm text-muted-foreground">Getting location...</span>
                ) : location ? (
                  <span className="text-sm">{location.address}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Location not available</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{new Date().toLocaleString()}</span>
              </div>
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add any notes about the display..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-2"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!selectedTaskId || !capturedFile || uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Submit for Review
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {tasks.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mb-4 text-green-500" />
            <p className="text-lg font-medium">All caught up!</p>
            <p>No pending compliance tasks at the moment.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
