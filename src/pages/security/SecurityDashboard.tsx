import { useState, useEffect } from "react";
import { ShieldCheck, Users, AlertTriangle, Clock, Trophy, QrCode, Loader2 } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useStoreAccess } from "@/hooks/useStoreAccess";
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
  const { accessibleStoreIds, isAdmin, loading: accessLoading } = useStoreAccess();

  useEffect(() => {
    if (!accessLoading) {
      fetchDashboardData();
    }
  }, [accessLoading, accessibleStoreIds]);

  const fetchDashboardData = async () => {
    try {
      const storeIds = Array.from(accessibleStoreIds);
      
      // Get total guards with store filter
      let guardsQuery = supabase
        .from("security_guards")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      
      if (!isAdmin && storeIds.length > 0) {
        guardsQuery = guardsQuery.in("store_id", storeIds);
      }
      const { count: totalGuards } = await guardsQuery;

      // Get today's roster count with store filter
      const today = new Date().toISOString().split("T")[0];
      let rosterQuery = supabase
        .from("security_roster_daily")
        .select("*, security_guards!inner(store_id)", { count: "exact", head: true })
        .eq("assignment_date", today)
        .eq("status", "scheduled");
      
      if (!isAdmin && storeIds.length > 0) {
        rosterQuery = supabase
          .from("security_roster_daily")
          .select("*, security_guards!inner(store_id)", { count: "exact", head: true })
          .eq("assignment_date", today)
          .eq("status", "scheduled")
          .in("security_guards.store_id", storeIds);
      }
      const { count: onDuty } = await rosterQuery;

      // Get top guard by points with store filter
      let topGuardQuery = supabase
        .from("security_guards")
        .select("total_points")
        .order("total_points", { ascending: false })
        .limit(1);
      
      if (!isAdmin && storeIds.length > 0) {
        topGuardQuery = topGuardQuery.in("store_id", storeIds);
      }
      const { data: topGuard } = await topGuardQuery.single();

      // Get recent visits with store filter
      let visitsQuery = supabase
        .from("security_patrol_visits")
        .select(`
          id,
          scanned_at,
          is_on_time,
          security_guards!inner(name, store_id),
          security_patrol_points(name)
        `)
        .order("scanned_at", { ascending: false })
        .limit(5);
      
      if (!isAdmin && storeIds.length > 0) {
        visitsQuery = supabase
          .from("security_patrol_visits")
          .select(`
            id,
            scanned_at,
            is_on_time,
            security_guards!inner(name, store_id),
            security_patrol_points(name)
          `)
          .in("security_guards.store_id", storeIds)
          .order("scanned_at", { ascending: false })
          .limit(5);
      }
      const { data: visits } = await visitsQuery;

      // Get top 5 guards by points with store filter
      let topGuardsQuery = supabase
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
      
      if (!isAdmin && storeIds.length > 0) {
        topGuardsQuery = topGuardsQuery.in("store_id", storeIds);
      }
      const { data: guards } = await topGuardsQuery;

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

  if (loading || accessLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
