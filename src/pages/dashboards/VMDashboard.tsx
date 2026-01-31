import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Eye, CheckCircle, Clock, AlertTriangle, Star } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import { Badge } from "@/components/ui/badge";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--success))"];

export default function VMDashboard() {
  const [stats, setStats] = useState({
    totalPlanograms: 0,
    activeTasks: 0,
    pendingReview: 0,
    approvedSubmissions: 0,
    avgComplianceScore: 0,
  });
  const [taskStatusData, setTaskStatusData] = useState<{ name: string; value: number }[]>([]);
  const [zoneData, setZoneData] = useState<{ name: string; count: number }[]>([]);
  const [reviewData, setReviewData] = useState<{ status: string; count: number }[]>([]);
  const [complianceTrend, setComplianceTrend] = useState<{ week: string; score: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch planograms
      const { data: planograms, count: planogramCount } = await supabase.from("planograms").select("*", { count: "exact" });
      
      // Fetch compliance tasks
      const { data: tasks } = await supabase.from("vm_compliance_tasks").select("*");
      
      // Fetch submissions
      const { data: submissions } = await supabase.from("vm_photo_submissions").select("*");
      
      // Fetch reviews
      const { data: reviews } = await supabase.from("vm_reviews").select("*");

      if (planograms && tasks) {
        const pendingTasks = tasks?.filter(t => t.status === "pending").length || 0;
        const approved = reviews?.filter(r => r.status === "approved").length || 0;
        const avgScore = reviews?.length > 0 
          ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length 
          : 0;

        setStats({
          totalPlanograms: planogramCount || 0,
          activeTasks: tasks?.length || 0,
          pendingReview: pendingTasks,
          approvedSubmissions: approved,
          avgComplianceScore: Math.round(avgScore * 20), // Convert 1-5 to percentage
        });

        // Task status distribution
        if (tasks) {
          const statusCount: Record<string, number> = {};
          tasks.forEach(t => {
            statusCount[t.status] = (statusCount[t.status] || 0) + 1;
          });
          setTaskStatusData(Object.entries(statusCount).map(([name, value]) => ({ name, value })));
        }

        // Zone distribution from planograms
        if (planograms) {
          const zoneCount: Record<string, number> = {};
          planograms.forEach(p => {
            zoneCount[p.zone] = (zoneCount[p.zone] || 0) + 1;
          });
          setZoneData(Object.entries(zoneCount).map(([name, count]) => ({ name, count })));
        }

        // Review status
        if (reviews) {
          const reviewCount: Record<string, number> = {};
          reviews.forEach(r => {
            reviewCount[r.status] = (reviewCount[r.status] || 0) + 1;
          });
          setReviewData(Object.entries(reviewCount).map(([status, count]) => ({ status, count })));
        }

        // Simulated compliance trend
        setComplianceTrend([
          { week: "Week 1", score: 72 },
          { week: "Week 2", score: 78 },
          { week: "Week 3", score: 82 },
          { week: "Week 4", score: 85 },
        ]);
      }
    } catch (error) {
      console.error("Error fetching VM dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">Visual Merchandising Dashboard</h1>
        <p className="text-sm text-muted-foreground">Planogram compliance and VM task tracking</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Planograms</p>
                <p className="text-2xl font-bold">{stats.totalPlanograms}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Clock className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Tasks</p>
                <p className="text-2xl font-bold">{stats.activeTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold">{stats.pendingReview}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{stats.approvedSubmissions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Star className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Score</p>
                <p className="text-2xl font-bold">{stats.avgComplianceScore}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={taskStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {taskStatusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Planograms by Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={zoneData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={reviewData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ status, count }) => `${status}: ${count}`}
                >
                  {reviewData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance Score Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={complianceTrend}>
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
