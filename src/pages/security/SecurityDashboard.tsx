import { useState, useEffect } from "react";
import { ShieldCheck, Users, AlertTriangle, Clock, Trophy, QrCode } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface GuardWithStore {
  id: string;
  name: string;
  phone: string;
  status: string;
  total_points: number;
  stores: { name: string } | null;
}

interface RecentVisit {
  id: string;
  scanned_at: string;
  is_on_time: boolean | null;
  security_guards: { name: string } | null;
  security_patrol_points: { name: string } | null;
}

export default function SecurityDashboard() {
  const [stats, setStats] = useState({
    totalGuards: 0,
    onDuty: 0,
    pendingScans: 0,
    topPoints: 0,
  });
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([]);
  const [topGuards, setTopGuards] = useState<GuardWithStore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Get total guards
      const { count: totalGuards } = await supabase
        .from("security_guards")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Get today's roster count
      const today = new Date().toISOString().split("T")[0];
      const { count: onDuty } = await supabase
        .from("security_roster_daily")
        .select("*", { count: "exact", head: true })
        .eq("assignment_date", today)
        .eq("status", "scheduled");

      // Get top guard by points
      const { data: topGuard } = await supabase
        .from("security_guards")
        .select("total_points")
        .order("total_points", { ascending: false })
        .limit(1)
        .single();

      // Get recent visits
      const { data: visits } = await supabase
        .from("security_patrol_visits")
        .select(`
          id,
          scanned_at,
          is_on_time,
          security_guards(name),
          security_patrol_points(name)
        `)
        .order("scanned_at", { ascending: false })
        .limit(5);

      // Get top 5 guards by points
      const { data: guards } = await supabase
        .from("security_guards")
        .select(`
          id,
          name,
          phone,
          status,
          total_points,
          stores(name)
        `)
        .eq("status", "active")
        .order("total_points", { ascending: false })
        .limit(5);

      setStats({
        totalGuards: totalGuards || 0,
        onDuty: onDuty || 0,
        pendingScans: 0,
        topPoints: topGuard?.total_points || 0,
      });
      setRecentVisits((visits as unknown as RecentVisit[]) || []);
      setTopGuards((guards as unknown as GuardWithStore[]) || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: "Total Guards", value: stats.totalGuards.toString(), icon: Users, iconColor: "bg-primary/10 text-primary" },
    { title: "On Duty Today", value: stats.onDuty.toString(), icon: ShieldCheck, iconColor: "bg-success/10 text-success" },
    { title: "Pending Scans", value: stats.pendingScans.toString(), icon: Clock, iconColor: "bg-warning/10 text-warning" },
    { title: "Top Points", value: stats.topPoints.toString(), icon: Trophy, iconColor: "bg-accent/10 text-accent-foreground" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold">Security Dashboard</h1>
        <p className="text-muted-foreground">Overview of security operations and patrol activities</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Recent Patrol Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentVisits.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No patrol visits recorded yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guard</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentVisits.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell className="font-medium">
                        {visit.security_guards?.name || "Unknown"}
                      </TableCell>
                      <TableCell>{visit.security_patrol_points?.name || "Unknown"}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(visit.scanned_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={visit.is_on_time ? "default" : "destructive"}>
                          {visit.is_on_time ? "On Time" : "Late"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topGuards.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No guards registered yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Guard</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topGuards.map((guard, index) => (
                    <TableRow key={guard.id}>
                      <TableCell>
                        <Badge variant={index === 0 ? "default" : "secondary"}>
                          #{index + 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{guard.name}</TableCell>
                      <TableCell>{guard.stores?.name || "-"}</TableCell>
                      <TableCell className="text-right font-semibold">{guard.total_points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
