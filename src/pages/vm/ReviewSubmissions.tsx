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

type Submission = {
  id: string;
  image_url: string;
  latitude: number | null;
  longitude: number | null;
  location_address: string | null;
  captured_at: string;
  submitted_by: string;
  notes: string | null;
  task: {
    id: string;
    title: string;
    status: string;
    planogram: { id: string; title: string; image_url: string } | null;
    store: { id: string; name: string } | null;
  } | null;
};

export default function ReviewSubmissions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<"slider" | "side-by-side">("slider");
  const { toast } = useToast();

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    const { data, error } = await supabase
      .from("vm_photo_submissions")
      .select(`
        *,
        task:vm_compliance_tasks(
          id,
          title,
          status,
          planogram:planograms(id, title, image_url),
          store:stores(id, name)
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to load submissions", variant: "destructive" });
    } else {
      // Filter to only show submitted tasks (not yet reviewed)
      const pendingSubmissions = (data as Submission[] || []).filter(
        (s) => s.task?.status === "submitted"
      );
      setSubmissions(pendingSubmissions);
    }
    setLoading(false);
  };

  const handleReview = (submission: Submission) => {
    setSelectedSubmission(submission);
    setRating(0);
    setFeedback("");
    setReviewOpen(true);
  };

  const submitReview = async (status: "approved" | "rejected" | "correction_required") => {
    if (!selectedSubmission || rating === 0) {
      toast({ title: "Error", description: "Please provide a rating", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    // Create review record
    const { error: reviewError } = await supabase.from("vm_reviews").insert({
      submission_id: selectedSubmission.id,
      task_id: selectedSubmission.task?.id,
      rating,
      status,
      feedback: feedback || null,
    });

    if (reviewError) {
      toast({ title: "Error", description: "Failed to submit review", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // Update task status
    await supabase
      .from("vm_compliance_tasks")
      .update({ status })
      .eq("id", selectedSubmission.task?.id);

    // Create correction task if needed
    if (status === "correction_required" && selectedSubmission.task) {
      await supabase.from("vm_correction_tasks").insert({
        review_id: selectedSubmission.id, // This will be updated with actual review id
        original_task_id: selectedSubmission.task.id,
        description: feedback || "Please correct the display as per feedback",
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
      });
    }

    toast({ 
      title: "Review Submitted", 
      description: status === "approved" ? "Submission approved!" : "Feedback sent to store" 
    });
    setReviewOpen(false);
    fetchSubmissions();
    setSubmitting(false);
  };

  const filteredSubmissions = submissions.filter(
    (s) =>
      s.task?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.task?.store?.name.toLowerCase().includes(searchQuery.toLowerCase())
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

      {filteredSubmissions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mb-4 text-green-500" />
            <p className="text-lg font-medium">No pending reviews</p>
            <p>All submissions have been reviewed.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSubmissions.map((submission) => (
            <Card key={submission.id} className="overflow-hidden">
              <div className="aspect-video relative">
                <img
                  src={submission.image_url}
                  alt="Submission"
                  className="w-full h-full object-cover"
                />
                <Badge className="absolute top-2 right-2 bg-blue-500">Pending Review</Badge>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{submission.task?.title}</CardTitle>
                <CardDescription>{submission.task?.store?.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{new Date(submission.captured_at).toLocaleString()}</span>
                </div>
                {submission.location_address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">{submission.location_address}</span>
                  </div>
                )}
                <Button onClick={() => handleReview(submission)} className="w-full mt-2">
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

          {selectedSubmission && selectedSubmission.task?.planogram && (
            <div className="space-y-4">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "slider" | "side-by-side")}>
                <TabsList>
                  <TabsTrigger value="slider">Slider Compare</TabsTrigger>
                  <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
                </TabsList>

                <TabsContent value="slider" className="mt-4">
                  <ImageComparisonSlider
                    baseImage={selectedSubmission.task.planogram.image_url}
                    actualImage={selectedSubmission.image_url}
                  />
                </TabsContent>

                <TabsContent value="side-by-side" className="mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-2 block">Planogram (Base)</Label>
                      <div className="rounded-lg overflow-hidden border">
                        <img
                          src={selectedSubmission.task.planogram.image_url}
                          alt="Planogram"
                          className="w-full h-48 object-cover"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="mb-2 block">Actual Photo</Label>
                      <div className="rounded-lg overflow-hidden border">
                        <img
                          src={selectedSubmission.image_url}
                          alt="Actual"
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
                    <span className="ml-2 font-medium">{selectedSubmission.task.store?.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Submitted by:</span>
                    <span className="ml-2 font-medium">{selectedSubmission.submitted_by}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Captured:</span>
                    <span className="ml-2">{new Date(selectedSubmission.captured_at).toLocaleString()}</span>
                  </div>
                  {selectedSubmission.location_address && (
                    <div>
                      <span className="text-muted-foreground">Location:</span>
                      <span className="ml-2">{selectedSubmission.location_address}</span>
                    </div>
                  )}
                </div>
                {selectedSubmission.notes && (
                  <div className="mt-2 pt-2 border-t">
                    <span className="text-muted-foreground">Notes:</span>
                    <p className="mt-1">{selectedSubmission.notes}</p>
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
