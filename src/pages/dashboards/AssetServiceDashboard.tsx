import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, AlertTriangle, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { Badge } from "@/components/ui/badge";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--success))"];

export default function AssetServiceDashboard() {
  const [stats, setStats] = useState({
    totalPM: 0,
    completedPM: 0,
    overduePM: 0,
    totalTickets: 0,
    openTickets: 0,
  });
  const [pmStatusData, setPMStatusData] = useState<{ name: string; value: number }[]>([]);
  const [ticketStatusData, setTicketStatusData] = useState<{ name: string; value: number }[]>([]);
  const [ticketPriorityData, setTicketPriorityData] = useState<{ name: string; count: number }[]>([]);
  const [pmFrequencyData, setPMFrequencyData] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch maintenance tasks
      const { data: pmTasks } = await supabase.from("maintenance_tasks").select("*");
      
      if (pmTasks) {
        const completed = pmTasks.filter(t => t.status === "completed");
        const overdue = pmTasks.filter(t => t.status === "overdue");

        setStats(prev => ({
          ...prev,
          totalPM: pmTasks.length,
          completedPM: completed.length,
          overduePM: overdue.length,
        }));

        // PM Status distribution
        const statusCount: Record<string, number> = {};
        pmTasks.forEach(t => {
          statusCount[t.status] = (statusCount[t.status] || 0) + 1;
        });
        setPMStatusData(Object.entries(statusCount).map(([name, value]) => ({ name, value })));

        // PM Frequency distribution
        const freqCount: Record<string, number> = {};
        pmTasks.forEach(t => {
          freqCount[t.frequency] = (freqCount[t.frequency] || 0) + 1;
        });
        setPMFrequencyData(Object.entries(freqCount).map(([name, count]) => ({ name, count })));
      }

      // Fetch service tickets
      const { data: tickets } = await supabase.from("service_tickets").select("*");
      
      if (tickets) {
        const open = tickets.filter(t => ["open", "in_progress"].includes(t.status));

        setStats(prev => ({
          ...prev,
          totalTickets: tickets.length,
          openTickets: open.length,
        }));

        // Ticket Status distribution
        const statusCount: Record<string, number> = {};
        tickets.forEach(t => {
          statusCount[t.status] = (statusCount[t.status] || 0) + 1;
        });
        setTicketStatusData(Object.entries(statusCount).map(([name, value]) => ({ name, value })));

        // Ticket Priority distribution
        const priorityCount: Record<string, number> = {};
        tickets.forEach(t => {
          priorityCount[t.priority] = (priorityCount[t.priority] || 0) + 1;
        });
        setTicketPriorityData(Object.entries(priorityCount).map(([name, count]) => ({ name, count })));
      }
    } catch (error) {
      console.error("Error fetching service dashboard:", error);
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
        <h1 className="text-2xl font-semibold">Asset Service Dashboard</h1>
        <p className="text-sm text-muted-foreground">Preventive Maintenance & Service Tickets Overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wrench className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total PM Tasks</p>
                <p className="text-2xl font-bold">{stats.totalPM}</p>
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
                <p className="text-sm text-muted-foreground">PM Completed</p>
                <p className="text-2xl font-bold">{stats.completedPM}</p>
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
                <p className="text-sm text-muted-foreground">PM Overdue</p>
                <p className="text-2xl font-bold">{stats.overduePM}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <TrendingUp className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Tickets</p>
                <p className="text-2xl font-bold">{stats.totalTickets}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open Tickets</p>
                <p className="text-2xl font-bold">{stats.openTickets}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 - PM */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PM Task Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pmStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pmStatusData.map((_, index) => (
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
            <CardTitle className="text-base">PM by Frequency</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={pmFrequencyData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 - Tickets */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Service Ticket Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={ticketStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {ticketStatusData.map((_, index) => (
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
            <CardTitle className="text-base">Tickets by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ticketPriorityData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
