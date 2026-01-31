import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Building, CheckCircle, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--success))"];

export default function NSODashboard() {
  const [stats, setStats] = useState({
    totalProjects: 0,
    inProgress: 0,
    completed: 0,
    delayed: 0,
    avgCompletion: 0,
  });
  const [storeTypeData, setStoreTypeData] = useState<{ name: string; count: number }[]>([]);
  const [phaseData, setPhaseData] = useState<{ phase: string; progress: number }[]>([]);
  const [projectProgress, setProjectProgress] = useState<{ name: string; completion: number }[]>([]);
  const [timeline, setTimeline] = useState<{ month: string; opened: number; planned: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch NSO checklist masters
      const { data: masters, count } = await supabase.from("nso_checklist_masters").select("*", { count: "exact" });
      
      if (masters) {
        const active = masters.filter(m => m.status === "active");
        
        setStats({
          totalProjects: count || 0,
          inProgress: Math.floor((count || 0) * 0.4),
          completed: Math.floor((count || 0) * 0.3),
          delayed: Math.floor((count || 0) * 0.1),
          avgCompletion: 68,
        });

        // Store type distribution
        const typeCount: Record<string, number> = {};
        masters.forEach(m => {
          const type = m.store_type || "Standard";
          typeCount[type] = (typeCount[type] || 0) + 1;
        });
        setStoreTypeData(Object.entries(typeCount).map(([name, count]) => ({ name, count })));
      }

      // Simulated phase progress
      setPhaseData([
        { phase: "Site Selection", progress: 100 },
        { phase: "Design & Planning", progress: 85 },
        { phase: "Construction", progress: 60 },
        { phase: "Fit-Out", progress: 45 },
        { phase: "Staffing", progress: 30 },
        { phase: "Launch Prep", progress: 15 },
      ]);

      // Simulated project progress
      setProjectProgress([
        { name: "Whitefield Store", completion: 85 },
        { name: "Koramangala Store", completion: 72 },
        { name: "Indiranagar Store", completion: 65 },
        { name: "JP Nagar Store", completion: 45 },
        { name: "HSR Layout Store", completion: 30 },
      ]);

      // Simulated timeline
      setTimeline([
        { month: "Jan", opened: 2, planned: 3 },
        { month: "Feb", opened: 3, planned: 3 },
        { month: "Mar", opened: 4, planned: 4 },
        { month: "Apr", opened: 2, planned: 5 },
      ]);
    } catch (error) {
      console.error("Error fetching NSO dashboard:", error);
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
        <h1 className="text-2xl font-semibold">New Store Opening Dashboard</h1>
        <p className="text-sm text-muted-foreground">Track NSO projects and launch timelines</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Projects</p>
                <p className="text-2xl font-bold">{stats.totalProjects}</p>
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
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
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
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Delayed</p>
                <p className="text-2xl font-bold">{stats.delayed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <TrendingUp className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Completion</p>
                <p className="text-2xl font-bold">{stats.avgCompletion}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects by Store Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={storeTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, count }) => `${name}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {storeTypeData.map((_, index) => (
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
            <CardTitle className="text-base">Store Opening Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={timeline}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="opened" name="Opened" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="planned" name="Planned" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phase Progress (Average)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {phaseData.map((phase) => (
              <div key={phase.phase} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{phase.phase}</span>
                  <span className="text-muted-foreground">{phase.progress}%</span>
                </div>
                <Progress value={phase.progress} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Project Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={projectProgress} layout="vertical">
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="completion" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
