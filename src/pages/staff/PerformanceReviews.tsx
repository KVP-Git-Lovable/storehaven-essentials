import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Plus, Star, TrendingUp, Users, Award, Loader2, Edit, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface PerformanceReview {
  id: string;
  employee_id: string;
  review_period_start: string;
  review_period_end: string;
  reviewed_by: string;
  review_date: string;
  overall_rating: number | null;
  ranking_in_team: number | null;
  kra_achievement: number | null;
  competency_score: number | null;
  strengths: string | null;
  weaknesses: string | null;
  training_needs: string | null;
  career_interests: string | null;
  promotion_potential: string | null;
  status: string;
  employees: { name: string; department: string; position: string };
}

interface ReviewForm {
  employee_id: string;
  review_period_start: string;
  review_period_end: string;
  reviewed_by: string;
  overall_rating: number;
  ranking_in_team: number;
  kra_achievement: number;
  competency_score: number;
  strengths: string;
  weaknesses: string;
  training_needs: string;
  career_interests: string;
  promotion_potential: string;
}

const defaultForm: ReviewForm = {
  employee_id: "",
  review_period_start: "",
  review_period_end: "",
  reviewed_by: "",
  overall_rating: 3,
  ranking_in_team: 1,
  kra_achievement: 80,
  competency_score: 75,
  strengths: "",
  weaknesses: "",
  training_needs: "",
  career_interests: "",
  promotion_potential: "medium",
};

export default function PerformanceReviews() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReviewForm>(defaultForm);
  const [viewReview, setViewReview] = useState<PerformanceReview | null>(null);
  const queryClient = useQueryClient();

  // Fetch employees
  const { data: employees } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, department, position")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch reviews
  const { data: reviews, isLoading } = useQuery({
    queryKey: ["performance-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_reviews")
        .select("*, employees(name, department, position)")
        .order("review_date", { ascending: false });
      if (error) throw error;
      return data as PerformanceReview[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: ReviewForm) => {
      const payload = {
        employee_id: data.employee_id,
        review_period_start: data.review_period_start,
        review_period_end: data.review_period_end,
        reviewed_by: data.reviewed_by,
        overall_rating: data.overall_rating,
        ranking_in_team: data.ranking_in_team,
        kra_achievement: data.kra_achievement,
        competency_score: data.competency_score,
        strengths: data.strengths || null,
        weaknesses: data.weaknesses || null,
        training_needs: data.training_needs || null,
        career_interests: data.career_interests || null,
        promotion_potential: data.promotion_potential,
        status: "submitted",
      };

      if (editingId) {
        const { error } = await supabase.from("performance_reviews").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("performance_reviews").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance-reviews"] });
      toast.success(editingId ? "Review updated" : "Review submitted");
      setIsDialogOpen(false);
      setEditingId(null);
      setForm(defaultForm);
    },
    onError: (error: any) => toast.error(error.message),
  });

  const handleSubmit = () => {
    if (!form.employee_id || !form.review_period_start || !form.review_period_end || !form.reviewed_by) {
      toast.error("Please fill all required fields");
      return;
    }
    saveMutation.mutate(form);
  };

  const handleEdit = (review: PerformanceReview) => {
    setEditingId(review.id);
    setForm({
      employee_id: review.employee_id,
      review_period_start: review.review_period_start,
      review_period_end: review.review_period_end,
      reviewed_by: review.reviewed_by,
      overall_rating: review.overall_rating || 3,
      ranking_in_team: review.ranking_in_team || 1,
      kra_achievement: review.kra_achievement || 80,
      competency_score: review.competency_score || 75,
      strengths: review.strengths || "",
      weaknesses: review.weaknesses || "",
      training_needs: review.training_needs || "",
      career_interests: review.career_interests || "",
      promotion_potential: review.promotion_potential || "medium",
    });
    setIsDialogOpen(true);
  };

  const getRatingColor = (rating: number | null) => {
    if (!rating) return "text-muted-foreground";
    if (rating >= 4) return "text-green-600";
    if (rating >= 3) return "text-yellow-600";
    return "text-red-600";
  };

  const getPotentialBadge = (potential: string | null) => {
    const colors: Record<string, string> = {
      high: "bg-green-100 text-green-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-red-100 text-red-800",
    };
    return colors[potential || "medium"] || colors.medium;
  };

  // Stats
  const highPerformers = reviews?.filter((r) => (r.overall_rating || 0) >= 4).length || 0;
  const promotionReady = reviews?.filter((r) => r.promotion_potential === "high").length || 0;
  const avgRating = reviews?.length
    ? (reviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / reviews.length).toFixed(1)
    : "0";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Performance Reviews</h1>
          <p className="text-muted-foreground">Evaluate employee performance, identify talent, and plan growth</p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingId(null);
              setForm(defaultForm);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Review
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Performance Review" : "Create Performance Review"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employee *</Label>
                  <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees?.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} - {emp.position}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reviewed By *</Label>
                  <Input
                    value={form.reviewed_by}
                    onChange={(e) => setForm({ ...form, reviewed_by: e.target.value })}
                    placeholder="Manager name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Review Period Start *</Label>
                  <Input
                    type="date"
                    value={form.review_period_start}
                    onChange={(e) => setForm({ ...form, review_period_start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Review Period End *</Label>
                  <Input
                    type="date"
                    value={form.review_period_end}
                    onChange={(e) => setForm({ ...form, review_period_end: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Overall Rating (1-5): {form.overall_rating}</Label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setForm({ ...form, overall_rating: star })}
                        className="p-1"
                      >
                        <Star
                          className={`h-6 w-6 ${
                            star <= form.overall_rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Team Ranking: #{form.ranking_in_team}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.ranking_in_team}
                    onChange={(e) => setForm({ ...form, ranking_in_team: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>KRA Achievement: {form.kra_achievement}%</Label>
                  <Slider
                    value={[form.kra_achievement]}
                    onValueChange={([v]) => setForm({ ...form, kra_achievement: v })}
                    max={100}
                    step={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Competency Score: {form.competency_score}%</Label>
                  <Slider
                    value={[form.competency_score]}
                    onValueChange={([v]) => setForm({ ...form, competency_score: v })}
                    max={100}
                    step={5}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Promotion Potential</Label>
                <Select
                  value={form.promotion_potential}
                  onValueChange={(v) => setForm({ ...form, promotion_potential: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High - Ready for promotion</SelectItem>
                    <SelectItem value="medium">Medium - Needs development</SelectItem>
                    <SelectItem value="low">Low - Requires improvement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Strengths</Label>
                <Textarea
                  value={form.strengths}
                  onChange={(e) => setForm({ ...form, strengths: e.target.value })}
                  placeholder="Key strengths observed"
                />
              </div>

              <div className="space-y-2">
                <Label>Areas for Improvement</Label>
                <Textarea
                  value={form.weaknesses}
                  onChange={(e) => setForm({ ...form, weaknesses: e.target.value })}
                  placeholder="Areas needing development"
                />
              </div>

              <div className="space-y-2">
                <Label>Training Needs</Label>
                <Textarea
                  value={form.training_needs}
                  onChange={(e) => setForm({ ...form, training_needs: e.target.value })}
                  placeholder="Recommended training programs"
                />
              </div>

              <div className="space-y-2">
                <Label>Career Interests</Label>
                <Textarea
                  value={form.career_interests}
                  onChange={(e) => setForm({ ...form, career_interests: e.target.value })}
                  placeholder="Employee's career aspirations"
                />
              </div>

              <Button onClick={handleSubmit} className="w-full">
                {editingId ? "Update Review" : "Submit Review"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{reviews?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Total Reviews</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{avgRating}</div>
                <div className="text-sm text-muted-foreground">Avg Rating</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{highPerformers}</div>
                <div className="text-sm text-muted-foreground">High Performers</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Award className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{promotionReady}</div>
                <div className="text-sm text-muted-foreground">Promotion Ready</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reviews Table */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            </div>
          ) : reviews && reviews.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Review Period</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>KRA %</TableHead>
                  <TableHead>Ranking</TableHead>
                  <TableHead>Potential</TableHead>
                  <TableHead>Reviewed By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="font-medium">{review.employees?.name}</TableCell>
                    <TableCell>{review.employees?.department}</TableCell>
                    <TableCell>
                      {format(parseISO(review.review_period_start), "MMM yy")} -{" "}
                      {format(parseISO(review.review_period_end), "MMM yy")}
                    </TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 ${getRatingColor(review.overall_rating)}`}>
                        <Star className="h-4 w-4 fill-current" />
                        {review.overall_rating || "-"}
                      </div>
                    </TableCell>
                    <TableCell>{review.kra_achievement ? `${review.kra_achievement}%` : "-"}</TableCell>
                    <TableCell>#{review.ranking_in_team || "-"}</TableCell>
                    <TableCell>
                      <Badge className={getPotentialBadge(review.promotion_potential)}>
                        {review.promotion_potential || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell>{review.reviewed_by}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewReview(review)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(review)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No performance reviews yet. Create your first review.
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Review Dialog */}
      <Dialog open={!!viewReview} onOpenChange={() => setViewReview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Performance Review Details</DialogTitle>
          </DialogHeader>
          {viewReview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Employee</Label>
                  <p className="font-medium">{viewReview.employees?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Position</Label>
                  <p>{viewReview.employees?.position}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold">{viewReview.overall_rating}/5</div>
                  <div className="text-xs text-muted-foreground">Rating</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{viewReview.kra_achievement}%</div>
                  <div className="text-xs text-muted-foreground">KRA</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">#{viewReview.ranking_in_team}</div>
                  <div className="text-xs text-muted-foreground">Rank</div>
                </div>
                <div className="text-center">
                  <Badge className={getPotentialBadge(viewReview.promotion_potential)}>
                    {viewReview.promotion_potential}
                  </Badge>
                  <div className="text-xs text-muted-foreground mt-1">Potential</div>
                </div>
              </div>
              {viewReview.strengths && (
                <div>
                  <Label className="text-muted-foreground">Strengths</Label>
                  <p className="mt-1">{viewReview.strengths}</p>
                </div>
              )}
              {viewReview.weaknesses && (
                <div>
                  <Label className="text-muted-foreground">Areas for Improvement</Label>
                  <p className="mt-1">{viewReview.weaknesses}</p>
                </div>
              )}
              {viewReview.training_needs && (
                <div>
                  <Label className="text-muted-foreground">Training Needs</Label>
                  <p className="mt-1">{viewReview.training_needs}</p>
                </div>
              )}
              {viewReview.career_interests && (
                <div>
                  <Label className="text-muted-foreground">Career Interests</Label>
                  <p className="mt-1">{viewReview.career_interests}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
