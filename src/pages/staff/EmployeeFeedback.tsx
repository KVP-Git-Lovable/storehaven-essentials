import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Loader2, Star, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type FeedbackEntry = {
  id: string;
  employee_id: string | null;
  reviewer_id: string | null;
  rating: number;
  feedback_text: string | null;
  feedback_date: string;
  feedback_type: string;
  created_at: string;
  employee_name?: string;
  reviewer_name?: string;
};

type ProfileOption = { id: string; username: string | null };

export default function EmployeeFeedback() {
  const [feedbacks, setFeedbacks] = useState<FeedbackEntry[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Form state
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formRating, setFormRating] = useState(0);
  const [formText, setFormText] = useState("");
  const [formType, setFormType] = useState("manager");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [fbRes, profileRes] = await Promise.all([
      supabase.from("employee_feedback").select("*").order("feedback_date", { ascending: false }),
      supabase.from("profiles").select("id, username"),
    ]);

    const profileMap = new Map((profileRes.data || []).map(p => [p.id, p.username || "Unnamed"]));
    setProfiles(profileRes.data || []);

    const enriched = (fbRes.data || []).map(fb => ({
      ...fb,
      employee_name: profileMap.get(fb.employee_id || "") || "—",
      reviewer_name: profileMap.get(fb.reviewer_id || "") || "—",
    }));
    setFeedbacks(enriched);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const total = feedbacks.length;
    const avgRating = total > 0 ? (feedbacks.reduce((sum, f) => sum + f.rating, 0) / total).toFixed(1) : "0";
    const thisMonth = feedbacks.filter(f => {
      const d = new Date(f.feedback_date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return [
      { title: "Total Feedbacks", value: total.toString(), icon: MessageSquare, iconColor: "bg-primary/10 text-primary" },
      { title: "Average Rating", value: avgRating, icon: Star, iconColor: "bg-warning/10 text-warning" },
      { title: "This Month", value: thisMonth.toString(), icon: MessageSquare, iconColor: "bg-info/10 text-info" },
    ];
  }, [feedbacks]);

  const handleSubmit = async () => {
    if (!formEmployeeId || formRating === 0) {
      toast({ title: "Please select an employee and rating", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("employee_feedback").insert({
      employee_id: formEmployeeId,
      reviewer_id: user?.id || null,
      rating: formRating,
      feedback_text: formText || null,
      feedback_type: formType,
    });
    if (error) {
      toast({ title: "Error", description: "Failed to submit feedback", variant: "destructive" });
    } else {
      toast({ title: "Feedback submitted" });
      setDialogOpen(false);
      setFormEmployeeId("");
      setFormRating(0);
      setFormText("");
      setFormType("manager");
      fetchData();
    }
  };

  const filtered = feedbacks.filter(f =>
    (f.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    (f.reviewer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employee Feedback</h1>
          <p className="text-muted-foreground">Quick star rating and feedback</p>
        </div>
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Give Feedback
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by employee or reviewer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Feedback</TableHead>
              <TableHead>Reviewed By</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No feedback found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((fb) => (
                <TableRow key={fb.id}>
                  <TableCell className="font-medium">{fb.employee_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{fb.feedback_type || "manager"}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`h-4 w-4 ${s <= fb.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate">{fb.feedback_text || "—"}</TableCell>
                  <TableCell>{fb.reviewer_name}</TableCell>
                  <TableCell>{new Date(fb.feedback_date).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Give Employee Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee</Label>
              <Select value={formEmployeeId} onValueChange={setFormEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.username || "Unnamed"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Feedback Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager Feedback</SelectItem>
                  <SelectItem value="peer">Peer / Team Feedback</SelectItem>
                  <SelectItem value="self">Self Assessment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rating</Label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star
                    key={s}
                    className={`h-8 w-8 cursor-pointer transition-colors ${s <= formRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-amber-300"}`}
                    onClick={() => setFormRating(s)}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>Feedback</Label>
              <Textarea
                placeholder="Write your feedback..."
                rows={4}
                value={formText}
                onChange={e => setFormText(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>Submit Feedback</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
