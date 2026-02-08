import { useState, useEffect } from "react";
import { Plus, Star, FileText, Upload, Trash2, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CandidateDetailsSheetProps {
  candidateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requisitions: { id: string; title: string }[];
  onUpdate: () => void;
}

type Interview = {
  id: string;
  round_number: number;
  round_type: string;
  interviewer_name: string | null;
  scheduled_at: string | null;
  status: string;
  rating: number | null;
  feedback: string | null;
  recommendation: string | null;
};

type OfferLetter = {
  id: string;
  offered_position: string;
  offered_department: string;
  offered_salary: number | null;
  joining_date: string | null;
  offer_date: string;
  status: string;
};

type CandidateDoc = {
  id: string;
  document_type: string;
  document_name: string | null;
  file_url: string;
  file_name: string;
  verified: boolean | null;
};

const candidateStatuses = [
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "selected", label: "Selected" },
  { value: "offer_sent", label: "Offer Sent" },
  { value: "offer_accepted", label: "Offer Accepted" },
  { value: "joined", label: "Joined" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

const statusColors: Record<string, string> = {
  applied: "bg-blue-100 text-blue-800",
  screening: "bg-purple-100 text-purple-800",
  interview: "bg-amber-100 text-amber-800",
  selected: "bg-green-100 text-green-800",
  offer_sent: "bg-emerald-100 text-emerald-800",
  offer_accepted: "bg-teal-100 text-teal-800",
  joined: "bg-green-200 text-green-900",
  rejected: "bg-red-100 text-red-800",
  withdrawn: "bg-gray-100 text-gray-800",
};

export function CandidateDetailsSheet({
  candidateId, open, onOpenChange, requisitions, onUpdate,
}: CandidateDetailsSheetProps) {
  const { toast } = useToast();
  const [candidate, setCandidate] = useState<any>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [offers, setOffers] = useState<OfferLetter[]>([]);
  const [documents, setDocuments] = useState<CandidateDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);

  // Interview form state
  const [interviewForm, setInterviewForm] = useState({
    round_type: "screening",
    interviewer_name: "",
    scheduled_at: "",
    duration_minutes: 30,
  });

  // Offer form state
  const [offerForm, setOfferForm] = useState({
    offered_position: "",
    offered_department: "",
    offered_salary: "",
    joining_date: "",
  });

  useEffect(() => {
    if (open && candidateId) fetchDetails();
  }, [open, candidateId]);

  const fetchDetails = async () => {
    setLoading(true);
    const [candRes, intRes, offRes, docRes] = await Promise.all([
      supabase.from("candidates").select("*").eq("id", candidateId).single(),
      supabase.from("interview_rounds").select("*").eq("candidate_id", candidateId).order("round_number"),
      supabase.from("offer_letters").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: false }),
      supabase.from("candidate_documents").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: false }),
    ]);
    if (candRes.data) setCandidate(candRes.data);
    if (intRes.data) setInterviews(intRes.data);
    if (offRes.data) setOffers(offRes.data);
    if (docRes.data) setDocuments(docRes.data);
    setLoading(false);
  };

  const updateStatus = async (newStatus: string) => {
    const { error } = await supabase.from("candidates").update({ status: newStatus }).eq("id", candidateId);
    if (!error) {
      setCandidate((c: any) => ({ ...c, status: newStatus }));
      onUpdate();
      toast({ title: "Status updated" });
    }
  };

  const addInterview = async () => {
    const nextRound = interviews.length + 1;
    const { error } = await supabase.from("interview_rounds").insert({
      candidate_id: candidateId,
      round_number: nextRound,
      round_type: interviewForm.round_type,
      interviewer_name: interviewForm.interviewer_name || null,
      scheduled_at: interviewForm.scheduled_at || null,
      duration_minutes: interviewForm.duration_minutes,
      status: "scheduled",
    });
    if (!error) {
      toast({ title: "Interview scheduled" });
      setInterviewDialogOpen(false);
      setInterviewForm({ round_type: "screening", interviewer_name: "", scheduled_at: "", duration_minutes: 30 });
      fetchDetails();
    }
  };

  const updateInterviewResult = async (interviewId: string, rating: number, feedback: string, recommendation: string, status: string) => {
    await supabase.from("interview_rounds").update({ rating, feedback, recommendation, status }).eq("id", interviewId);
    fetchDetails();
    toast({ title: "Interview result saved" });
  };

  const createOffer = async () => {
    const { error } = await supabase.from("offer_letters").insert({
      candidate_id: candidateId,
      requisition_id: candidate?.requisition_id || null,
      offered_position: offerForm.offered_position,
      offered_department: offerForm.offered_department,
      offered_salary: offerForm.offered_salary ? Number(offerForm.offered_salary) : null,
      joining_date: offerForm.joining_date || null,
      status: "draft",
    });
    if (!error) {
      toast({ title: "Offer letter created" });
      setOfferDialogOpen(false);
      setOfferForm({ offered_position: "", offered_department: "", offered_salary: "", joining_date: "" });
      fetchDetails();
    }
  };

  const updateOfferStatus = async (offerId: string, status: string) => {
    await supabase.from("offer_letters").update({ status }).eq("id", offerId);
    fetchDetails();
    if (status === "accepted") updateStatus("offer_accepted");
    if (status === "sent") updateStatus("offer_sent");
    toast({ title: "Offer status updated" });
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${candidateId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("candidate-documents").upload(path, file);
    if (uploadError) {
      toast({ title: "Upload failed", variant: "destructive" });
      return;
    }
    const { data: urlData } = supabase.storage.from("candidate-documents").getPublicUrl(path);
    await supabase.from("candidate_documents").insert({
      candidate_id: candidateId,
      document_type: docType,
      document_name: file.name,
      file_url: urlData.publicUrl,
      file_name: file.name,
    });
    fetchDetails();
    toast({ title: "Document uploaded" });
  };

  if (loading || !candidate) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl">{candidate.name}</SheetTitle>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusColors[candidate.status] || ""}`}>
                {candidate.status.replace("_", " ")}
              </span>
            </div>
          </SheetHeader>

          <div className="mt-4 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Email:</span> {candidate.email || "—"}</div>
              <div><span className="text-muted-foreground">Phone:</span> {candidate.phone || "—"}</div>
              <div><span className="text-muted-foreground">Experience:</span> {candidate.experience_years != null ? `${candidate.experience_years} yrs` : "—"}</div>
              <div><span className="text-muted-foreground">Expected CTC:</span> {candidate.expected_salary ? `₹${candidate.expected_salary.toLocaleString()}` : "—"}</div>
              <div><span className="text-muted-foreground">Notice:</span> {candidate.notice_period_days ? `${candidate.notice_period_days} days` : "—"}</div>
              <div><span className="text-muted-foreground">Source:</span> {candidate.source || "—"}</div>
            </div>
          </div>

          <div className="mt-4">
            <Label>Update Status</Label>
            <Select value={candidate.status} onValueChange={updateStatus}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {candidateStatuses.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="interviews" className="mt-6">
            <TabsList className="w-full">
              <TabsTrigger value="interviews" className="flex-1">Interviews ({interviews.length})</TabsTrigger>
              <TabsTrigger value="offers" className="flex-1">Offers ({offers.length})</TabsTrigger>
              <TabsTrigger value="documents" className="flex-1">Documents ({documents.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="interviews" className="space-y-3 mt-3">
              <Button size="sm" onClick={() => setInterviewDialogOpen(true)} className="gap-1">
                <Plus className="h-3 w-3" /> Schedule Interview
              </Button>
              {interviews.map(int => (
                <InterviewCard key={int.id} interview={int} onSave={updateInterviewResult} />
              ))}
              {interviews.length === 0 && (
                <p className="text-muted-foreground text-sm">No interviews scheduled</p>
              )}
            </TabsContent>

            <TabsContent value="offers" className="space-y-3 mt-3">
              <Button size="sm" onClick={() => setOfferDialogOpen(true)} className="gap-1">
                <Plus className="h-3 w-3" /> Create Offer
              </Button>
              {offers.map(offer => (
                <div key={offer.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{offer.offered_position}</p>
                      <p className="text-sm text-muted-foreground">{offer.offered_department}</p>
                    </div>
                    <Badge variant={offer.status === "accepted" ? "default" : "secondary"}>{offer.status}</Badge>
                  </div>
                  <div className="text-sm grid grid-cols-2 gap-1">
                    <span>Salary: {offer.offered_salary ? `₹${offer.offered_salary.toLocaleString()}` : "—"}</span>
                    <span>Joining: {offer.joining_date || "—"}</span>
                  </div>
                  <div className="flex gap-2">
                    {offer.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => updateOfferStatus(offer.id, "sent")}>
                        Send Offer
                      </Button>
                    )}
                    {offer.status === "sent" && (
                      <>
                        <Button size="sm" onClick={() => updateOfferStatus(offer.id, "accepted")}>
                          <CheckCircle className="h-3 w-3 mr-1" /> Accepted
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => updateOfferStatus(offer.id, "rejected")}>
                          <XCircle className="h-3 w-3 mr-1" /> Declined
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {offers.length === 0 && (
                <p className="text-muted-foreground text-sm">No offers created</p>
              )}
            </TabsContent>

            <TabsContent value="documents" className="space-y-3 mt-3">
              <div className="space-y-2">
                {["Resume", "ID Proof", "Address Proof", "Education Certificate", "Experience Letter", "Offer Letter", "Other"].map(docType => (
                  <div key={docType} className="flex items-center justify-between border rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{docType}</span>
                      {documents.find(d => d.document_type === docType) && (
                        <Badge variant="secondary" className="text-xs">Uploaded</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {documents.find(d => d.document_type === docType) && (
                        <a
                          href={documents.find(d => d.document_type === docType)?.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          View
                        </a>
                      )}
                      <label className="cursor-pointer">
                        <Upload className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        <input type="file" className="hidden" onChange={(e) => handleDocUpload(e, docType)} />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Interview Dialog */}
      <Dialog open={interviewDialogOpen} onOpenChange={setInterviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Round Type</Label>
              <Select value={interviewForm.round_type} onValueChange={(v) => setInterviewForm(p => ({ ...p, round_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="screening">Screening</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="managerial">Managerial</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Interviewer Name</Label>
              <Input value={interviewForm.interviewer_name} onChange={(e) => setInterviewForm(p => ({ ...p, interviewer_name: e.target.value }))} />
            </div>
            <div>
              <Label>Scheduled At</Label>
              <Input type="datetime-local" value={interviewForm.scheduled_at} onChange={(e) => setInterviewForm(p => ({ ...p, scheduled_at: e.target.value }))} />
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Input type="number" value={interviewForm.duration_minutes} onChange={(e) => setInterviewForm(p => ({ ...p, duration_minutes: Number(e.target.value) }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setInterviewDialogOpen(false)}>Cancel</Button>
              <Button onClick={addInterview}>Schedule</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Offer Dialog */}
      <Dialog open={offerDialogOpen} onOpenChange={setOfferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Offer Letter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Position</Label>
              <Input value={offerForm.offered_position} onChange={(e) => setOfferForm(p => ({ ...p, offered_position: e.target.value }))} />
            </div>
            <div>
              <Label>Department</Label>
              <Input value={offerForm.offered_department} onChange={(e) => setOfferForm(p => ({ ...p, offered_department: e.target.value }))} />
            </div>
            <div>
              <Label>Salary (₹)</Label>
              <Input type="number" value={offerForm.offered_salary} onChange={(e) => setOfferForm(p => ({ ...p, offered_salary: e.target.value }))} />
            </div>
            <div>
              <Label>Joining Date</Label>
              <Input type="date" value={offerForm.joining_date} onChange={(e) => setOfferForm(p => ({ ...p, joining_date: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOfferDialogOpen(false)}>Cancel</Button>
              <Button onClick={createOffer}>Create Offer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Interview card sub-component
function InterviewCard({ interview, onSave }: { interview: Interview; onSave: (id: string, rating: number, feedback: string, rec: string, status: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(interview.rating || 0);
  const [feedback, setFeedback] = useState(interview.feedback || "");
  const [recommendation, setRecommendation] = useState(interview.recommendation || "proceed");

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium">Round {interview.round_number} — <span className="capitalize">{interview.round_type}</span></p>
          {interview.interviewer_name && <p className="text-sm text-muted-foreground">By: {interview.interviewer_name}</p>}
          {interview.scheduled_at && (
            <p className="text-xs text-muted-foreground">{new Date(interview.scheduled_at).toLocaleString()}</p>
          )}
        </div>
        <Badge variant={interview.status === "completed" ? "default" : "secondary"}>{interview.status}</Badge>
      </div>

      {interview.status === "completed" && interview.rating && (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map(s => (
            <Star key={s} className={`h-4 w-4 ${s <= (interview.rating || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
          ))}
          <span className="ml-2 text-sm text-muted-foreground capitalize">{interview.recommendation}</span>
        </div>
      )}

      {interview.status === "completed" && interview.feedback && (
        <p className="text-sm">{interview.feedback}</p>
      )}

      {interview.status === "scheduled" && !editing && (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Add Result
        </Button>
      )}

      {editing && (
        <div className="space-y-2 border-t pt-2">
          <div>
            <Label className="text-xs">Rating</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <Star
                  key={s}
                  className={`h-5 w-5 cursor-pointer ${s <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                  onClick={() => setRating(s)}
                />
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Feedback</Label>
            <Textarea rows={2} value={feedback} onChange={e => setFeedback(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Recommendation</Label>
            <Select value={recommendation} onValueChange={setRecommendation}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="proceed">Proceed to Next</SelectItem>
                <SelectItem value="hire">Hire</SelectItem>
                <SelectItem value="hold">Hold</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { onSave(interview.id, rating, feedback, recommendation, "completed"); setEditing(false); }}>
              Save Result
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
