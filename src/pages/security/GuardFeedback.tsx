import { useState, useEffect } from "react";
import { Plus, Star, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Guard {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
}

interface Feedback {
  id: string;
  guard_id: string;
  store_id: string;
  submitted_by: string;
  feedback_date: string;
  work_ethics_rating: number | null;
  dependability_rating: number | null;
  quality_of_service_rating: number | null;
  punctuality_rating: number | null;
  alertness_rating: number | null;
  comments: string | null;
  overall_rating: number | null;
  security_guards?: { name: string };
  stores?: { name: string };
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="focus:outline-none"
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              star <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function DisplayStars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
          }`}
        />
      ))}
    </div>
  );
}

export default function GuardFeedback() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [form, setForm] = useState({
    guard_id: "",
    store_id: "",
    submitted_by: "",
    work_ethics_rating: 0,
    dependability_rating: 0,
    quality_of_service_rating: 0,
    punctuality_rating: 0,
    alertness_rating: 0,
    comments: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [feedbackRes, guardsRes, storesRes] = await Promise.all([
        supabase.from("security_guard_feedback").select(`
          *,
          security_guards(name),
          stores(name)
        `).order("feedback_date", { ascending: false }),
        supabase.from("security_guards").select("id, name").eq("status", "active"),
        supabase.from("stores").select("id, name").eq("status", "active"),
      ]);

      if (feedbackRes.data) setFeedbacks(feedbackRes.data);
      if (guardsRes.data) setGuards(guardsRes.data);
      if (storesRes.data) setStores(storesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch feedback data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.guard_id || !form.store_id || !form.submitted_by) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const overall = (
        form.work_ethics_rating +
        form.dependability_rating +
        form.quality_of_service_rating +
        form.punctuality_rating +
        form.alertness_rating
      ) / 5;

      const { error } = await supabase.from("security_guard_feedback").insert({
        guard_id: form.guard_id,
        store_id: form.store_id,
        submitted_by: form.submitted_by,
        work_ethics_rating: form.work_ethics_rating || null,
        dependability_rating: form.dependability_rating || null,
        quality_of_service_rating: form.quality_of_service_rating || null,
        punctuality_rating: form.punctuality_rating || null,
        alertness_rating: form.alertness_rating || null,
        comments: form.comments || null,
        overall_rating: overall > 0 ? overall : null,
      });

      if (error) throw error;

      // Award points for good feedback
      if (overall >= 4) {
        await supabase.from("security_points_log").insert({
          guard_id: form.guard_id,
          points: Math.round(overall * 2),
          reason: "Positive feedback received",
          reference_type: "feedback",
        });
      }

      toast.success("Feedback submitted successfully");
      setIsFormOpen(false);
      setForm({
        guard_id: "",
        store_id: "",
        submitted_by: "",
        work_ethics_rating: 0,
        dependability_rating: 0,
        quality_of_service_rating: 0,
        punctuality_rating: 0,
        alertness_rating: 0,
        comments: "",
      });
      fetchData();
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback");
    }
  };

  const filteredFeedbacks = feedbacks.filter((fb) =>
    fb.security_guards?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fb.stores?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Guard Feedback</h1>
          <p className="text-muted-foreground">Manager feedback on security guard performance</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Feedback
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by guard or store..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guard</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Work Ethics</TableHead>
              <TableHead>Dependability</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead>Punctuality</TableHead>
              <TableHead>Alertness</TableHead>
              <TableHead>Overall</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFeedbacks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No feedback records found
                </TableCell>
              </TableRow>
            ) : (
              filteredFeedbacks.map((fb) => (
                <TableRow key={fb.id}>
                  <TableCell className="font-medium">{fb.security_guards?.name}</TableCell>
                  <TableCell>{fb.stores?.name}</TableCell>
                  <TableCell>{new Date(fb.feedback_date).toLocaleDateString()}</TableCell>
                  <TableCell><DisplayStars rating={fb.work_ethics_rating} /></TableCell>
                  <TableCell><DisplayStars rating={fb.dependability_rating} /></TableCell>
                  <TableCell><DisplayStars rating={fb.quality_of_service_rating} /></TableCell>
                  <TableCell><DisplayStars rating={fb.punctuality_rating} /></TableCell>
                  <TableCell><DisplayStars rating={fb.alertness_rating} /></TableCell>
                  <TableCell>
                    <Badge variant={
                      (fb.overall_rating || 0) >= 4 ? "default" :
                      (fb.overall_rating || 0) >= 3 ? "secondary" : "destructive"
                    }>
                      {fb.overall_rating?.toFixed(1) || "-"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Feedback Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Guard Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Guard *</Label>
                <Select value={form.guard_id} onValueChange={(v) => setForm({...form, guard_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select guard" /></SelectTrigger>
                  <SelectContent>
                    {guards.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Store *</Label>
                <Select value={form.store_id} onValueChange={(v) => setForm({...form, store_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Submitted By *</Label>
              <Input
                value={form.submitted_by}
                onChange={(e) => setForm({...form, submitted_by: e.target.value})}
                placeholder="Manager name"
              />
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Rating Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Work Ethics</Label>
                  <StarRating value={form.work_ethics_rating} onChange={(v) => setForm({...form, work_ethics_rating: v})} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Dependability</Label>
                  <StarRating value={form.dependability_rating} onChange={(v) => setForm({...form, dependability_rating: v})} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Quality of Service</Label>
                  <StarRating value={form.quality_of_service_rating} onChange={(v) => setForm({...form, quality_of_service_rating: v})} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Punctuality</Label>
                  <StarRating value={form.punctuality_rating} onChange={(v) => setForm({...form, punctuality_rating: v})} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Alertness</Label>
                  <StarRating value={form.alertness_rating} onChange={(v) => setForm({...form, alertness_rating: v})} />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label>Comments</Label>
              <Textarea
                value={form.comments}
                onChange={(e) => setForm({...form, comments: e.target.value})}
                placeholder="Additional comments about the guard's performance..."
                rows={3}
              />
            </div>

            <Button className="w-full" onClick={handleSubmit}>
              Submit Feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
