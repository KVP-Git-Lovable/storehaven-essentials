import { useState, useEffect } from "react";
import { Search, Loader2, Star, CheckCircle, XCircle, AlertTriangle, MapPin, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageComparisonSlider } from "@/components/vm/ImageComparisonSlider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type SubmittedTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string;
  frequency: string;
  submitted_photo_url: string | null;
  submitted_at: string | null;
  submitted_latitude: number | null;
  submitted_longitude: number | null;
  submitted_location_address: string | null;
  submission_notes: string | null;
  planogram: { id: string; title: string; image_url: string } | null;
  store: { id: string; name: string } | null;
  assigned_user: { id: string; username: string } | null;
};

export default function ReviewSubmissions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [tasks, setTasks] = useState<SubmittedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<SubmittedTask | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<"slider" | "side-by-side">("slider");
  const { toast } = useToast();

  useEffect(() => {
    fetchSubmittedTasks();
  }, []);

  const fetchSubmittedTasks = async () => {
    const { data, error } = await supabase
      .from("vm_compliance_tasks")
      .select(`
        *,
        planogram:planograms(id, title, image_url),
        store:stores(id, name),
        assigned_user:profiles!vm_compliance_tasks_assigned_to_user_id_fkey(id, username)
      `)
      .eq("status", "submitted")
      .not("submitted_photo_url", "is", null)
      .order("submitted_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to load submissions", variant: "destructive" });
    } else {
      setTasks(data as SubmittedTask[] || []);
    }
    setLoading(false);
  };

  const handleReview = (task: SubmittedTask) => {
    setSelectedTask(task);
    setRating(0);
    setFeedback("");
    setReviewOpen(true);
  };

  // Calculate next due date for recurring tasks
  const calculateNextDueDate = (currentDue: string, frequency: string): Date => {
    const date = new Date(currentDue);
    switch (frequency) {
      case "daily":
        date.setDate(date.getDate() + 1);
        break;
      case "weekly":
        date.setDate(date.getDate() + 7);
        break;
      case "monthly":
        date.setMonth(date.getMonth() + 1);
        break;
    }
    return date;
  };

  const submitReview = async (status: "approved" | "rejected" | "correction_required") => {
    if (!selectedTask || rating === 0) {
      toast({ title: "Error", description: "Please provide a rating", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    // Update task status
    const { error: updateError } = await supabase
      .from("vm_compliance_tasks")
      .update({ status })
      .eq("id", selectedTask.id);

    if (updateError) {
      toast({ title: "Error", description: "Failed to submit review", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // Auto-generate next recurring task if approved and is a recurring task
    if (status === "approved" && selectedTask.frequency !== "one-time") {
      const nextDueDate = calculateNextDueDate(selectedTask.due_date, selectedTask.frequency);
      await supabase.from("vm_compliance_tasks").insert({
        planogram_id: selectedTask.planogram?.id,
        store_id: selectedTask.store?.id,
        title: selectedTask.title,
        description: selectedTask.description,
        frequency: selectedTask.frequency,
        due_date: nextDueDate.toISOString(),
        parent_task_id: selectedTask.id,
        is_recurring: true,
        status: "pending",
      });
    }

    toast({ 
      title: "Review Submitted", 
      description: status === "approved" ? "Submission approved!" : "Feedback sent to store" 
    });
    setReviewOpen(false);
    fetchSubmittedTasks();
    setSubmitting(false);
  };

  const filteredTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.store?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <h1 className="text-2xl font-semibold">Review Submissions</h1>
        <p className="text-muted-foreground">Compare and approve store display compliance photos</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search submissions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mb-4 text-green-500" />
            <p className="text-lg font-medium">No pending reviews</p>
            <p>All submissions have been reviewed.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task) => (
            <Card key={task.id} className="overflow-hidden">
              <div className="aspect-video relative">
                <img
                  src={task.submitted_photo_url || ""}
                  alt="Submission"
                  className="w-full h-full object-cover"
                />
                <Badge className="absolute top-2 right-2 bg-blue-500">Pending Review</Badge>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{task.title}</CardTitle>
                <CardDescription>{task.store?.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {task.submitted_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{new Date(task.submitted_at).toLocaleString()}</span>
                  </div>
                )}
                {task.submitted_location_address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">{task.submitted_location_address}</span>
                  </div>
                )}
                <Button onClick={() => handleReview(task)} className="w-full mt-2">
                  Review Submission
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Compliance Photo</DialogTitle>
          </DialogHeader>

          {selectedTask && selectedTask.planogram && selectedTask.submitted_photo_url && (
            <div className="space-y-4">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "slider" | "side-by-side")}>
                <TabsList>
                  <TabsTrigger value="slider">Slider Compare</TabsTrigger>
                  <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
                </TabsList>

                <TabsContent value="slider" className="mt-4">
                  <ImageComparisonSlider
                    baseImage={selectedTask.planogram.image_url}
                    actualImage={selectedTask.submitted_photo_url}
                  />
                </TabsContent>

                <TabsContent value="side-by-side" className="mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-2 block">Planogram (Base)</Label>
                      <div className="rounded-lg overflow-hidden border">
                        <img
                          src={selectedTask.planogram.image_url}
                          alt="Planogram"
                          className="w-full h-48 object-cover"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="mb-2 block">Submitted Photo</Label>
                      <div className="rounded-lg overflow-hidden border">
                        <img
                          src={selectedTask.submitted_photo_url}
                          alt="Submitted"
                          className="w-full h-48 object-cover"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Submission Details */}
              <div className="p-3 rounded-lg bg-muted">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Store:</span>
                    <span className="ml-2 font-medium">{selectedTask.store?.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Assigned to:</span>
                    <span className="ml-2 font-medium">{selectedTask.assigned_user?.username || "Unassigned"}</span>
                  </div>
                  {selectedTask.submitted_at && (
                    <div>
                      <span className="text-muted-foreground">Submitted:</span>
                      <span className="ml-2">{new Date(selectedTask.submitted_at).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedTask.submitted_location_address && (
                    <div>
                      <span className="text-muted-foreground">Location:</span>
                      <span className="ml-2">{selectedTask.submitted_location_address}</span>
                    </div>
                  )}
                </div>
                {selectedTask.submission_notes && (
                  <div className="mt-2 pt-2 border-t">
                    <span className="text-muted-foreground">Notes:</span>
                    <p className="mt-1">{selectedTask.submission_notes}</p>
                  </div>
                )}
              </div>

              {/* Rating */}
              <div>
                <Label>Rating (1-5 Stars)</Label>
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback */}
              <div>
                <Label>Feedback</Label>
                <Textarea
                  placeholder="Provide feedback for the store manager..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="mt-2"
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 text-red-600 hover:text-red-700"
                  onClick={() => submitReview("rejected")}
                  disabled={submitting}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-orange-600 hover:text-orange-700"
                  onClick={() => submitReview("correction_required")}
                  disabled={submitting}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Request Correction
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => submitReview("approved")}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
