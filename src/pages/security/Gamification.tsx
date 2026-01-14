import { useState, useEffect } from "react";
import { Trophy, Medal, Star, TrendingUp, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

interface GuardLeaderboard {
  id: string;
  name: string;
  total_points: number;
  stores?: { name: string } | null;
}

interface PointsLog {
  id: string;
  points: number;
  reason: string;
  created_at: string;
  security_guards: { name: string } | null;
}

interface Stats {
  totalPoints: number;
  totalGuards: number;
  avgPoints: number;
  topPerformer: string;
}

export default function Gamification() {
  const [leaderboard, setLeaderboard] = useState<GuardLeaderboard[]>([]);
  const [recentPoints, setRecentPoints] = useState<PointsLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPoints: 0,
    totalGuards: 0,
    avgPoints: 0,
    topPerformer: "-",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get leaderboard
      const { data: guards } = await supabase
        .from("security_guards")
        .select(`
          id,
          name,
          total_points,
          stores(name)
        `)
        .eq("status", "active")
        .order("total_points", { ascending: false })
        .limit(20);

      // Get recent points
      const { data: points } = await supabase
        .from("security_points_log")
        .select(`
          id,
          points,
          reason,
          created_at,
          security_guards(name)
        `)
        .order("created_at", { ascending: false })
        .limit(20);

      if (guards) {
        setLeaderboard(guards);
        const totalPoints = guards.reduce((sum, g) => sum + (g.total_points || 0), 0);
        setStats({
          totalPoints,
          totalGuards: guards.length,
          avgPoints: guards.length > 0 ? Math.round(totalPoints / guards.length) : 0,
          topPerformer: guards[0]?.name || "-",
        });
      }
      if (points) setRecentPoints(points as PointsLog[]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch gamification data");
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-500">🥇 1st</Badge>;
    if (index === 1) return <Badge className="bg-gray-400">🥈 2nd</Badge>;
    if (index === 2) return <Badge className="bg-amber-600">🥉 3rd</Badge>;
    return <Badge variant="outline">#{index + 1}</Badge>;
  };

  const getPointsBadge = (points: number) => {
    if (points >= 500) return { label: "Gold Guard", color: "bg-yellow-500" };
    if (points >= 250) return { label: "Silver Guard", color: "bg-gray-400" };
    if (points >= 100) return { label: "Bronze Guard", color: "bg-amber-600" };
    return { label: "Rookie", color: "bg-blue-500" };
  };

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
        <h1 className="text-2xl font-semibold">Gamification & Rewards</h1>
        <p className="text-muted-foreground">Guard leaderboard and points tracking</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Points Earned</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPoints.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Guards</CardTitle>
            <Medal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalGuards}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Points/Guard</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgPoints}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{stats.topPerformer}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No guards registered yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Rank</TableHead>
                    <TableHead>Guard</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((guard, index) => {
                    const badge = getPointsBadge(guard.total_points);
                    return (
                      <TableRow key={guard.id}>
                        <TableCell>{getRankBadge(index)}</TableCell>
                        <TableCell className="font-medium">{guard.name}</TableCell>
                        <TableCell>{guard.stores?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge className={badge.color}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {guard.total_points.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              Recent Points Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentPoints.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No points activity yet</p>
            ) : (
              <div className="space-y-3">
                {recentPoints.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{log.security_guards?.name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{log.reason}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={log.points > 0 ? "default" : "destructive"}>
                        {log.points > 0 ? "+" : ""}{log.points} pts
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(log.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How to Earn Points</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Trophy className="h-4 w-4 text-primary" />
                </div>
                <h4 className="font-medium">Attendance</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                +10 points for being present and on time for your shift
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                  <Medal className="h-4 w-4 text-success" />
                </div>
                <h4 className="font-medium">Patrol Scans</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                +5 points for each successful patrol point scan
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center">
                  <Star className="h-4 w-4 text-warning" />
                </div>
                <h4 className="font-medium">Good Feedback</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Bonus points based on positive manager feedback ratings
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
