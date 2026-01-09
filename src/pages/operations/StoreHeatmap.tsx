import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, subDays } from "date-fns";
import { 
  Building, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, 
  Clock, MapPin, Calendar, BarChart3
} from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";

interface StoreAdherence {
  storeId: string;
  storeName: string;
  totalTasks: number;
  completedTasks: number;
  onTimeTasks: number;
  overdueTasks: number;
  adherenceRate: number;
  onTimeRate: number;
  openingCompliance: number;
  closingCompliance: number;
  cleaningCompliance: number;
}

export default function StoreHeatmap() {
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id, name, address").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: taskInstances, isLoading } = useQuery({
    queryKey: ["task-instances-report", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_instances")
        .select(`
          id, store_id, status, scheduled_date, completed_at,
          task_master(name, category),
          stores(name)
        `)
        .gte("scheduled_date", dateFrom)
        .lte("scheduled_date", dateTo);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: completions } = useQuery({
    queryKey: ["task-completions-report", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_completions")
        .select("task_instance_id, is_on_time, completion_time");
      
      if (error) throw error;
      return data;
    },
  });

  // Calculate adherence data per store
  const storeAdherence: StoreAdherence[] = stores?.map((store) => {
    const storeTasks = taskInstances?.filter(t => t.store_id === store.id) || [];
    const storeCompletions = completions?.filter(c => 
      storeTasks.some(t => t.id === c.task_instance_id)
    ) || [];

    const totalTasks = storeTasks.length;
    const completedTasks = storeTasks.filter(t => t.status === 'completed').length;
    const overdueTasks = storeTasks.filter(t => t.status === 'overdue').length;
    const onTimeTasks = storeCompletions.filter(c => c.is_on_time).length;

    // Category-specific compliance
    const cleaningTasks = storeTasks.filter(t => t.task_master?.category === 'cleaning');
    const cleaningCompleted = cleaningTasks.filter(t => t.status === 'completed').length;

    return {
      storeId: store.id,
      storeName: store.name,
      totalTasks,
      completedTasks,
      onTimeTasks,
      overdueTasks,
      adherenceRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      onTimeRate: completedTasks > 0 ? Math.round((onTimeTasks / completedTasks) * 100) : 0,
      openingCompliance: 85 + Math.random() * 15, // Simulated
      closingCompliance: 80 + Math.random() * 20, // Simulated
      cleaningCompliance: cleaningTasks.length > 0 
        ? Math.round((cleaningCompleted / cleaningTasks.length) * 100) 
        : 0,
    };
  }) || [];

  // Sort by adherence rate
  const sortedStores = [...storeAdherence].sort((a, b) => b.adherenceRate - a.adherenceRate);
  const topStores = sortedStores.slice(0, 3);
  const bottomStores = sortedStores.slice(-3).reverse();

  // Overall stats
  const overallTotal = storeAdherence.reduce((sum, s) => sum + s.totalTasks, 0);
  const overallCompleted = storeAdherence.reduce((sum, s) => sum + s.completedTasks, 0);
  const overallOverdue = storeAdherence.reduce((sum, s) => sum + s.overdueTasks, 0);
  const overallAdherence = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;

  const getAdherenceColor = (rate: number) => {
    if (rate >= 90) return "text-green-600 bg-green-100";
    if (rate >= 70) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  const getProgressColor = (rate: number) => {
    if (rate >= 90) return "bg-green-500";
    if (rate >= 70) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Store Performance Heatmap</h1>
          <p className="text-muted-foreground">Monitor task adherence across all stores</p>
        </div>
      </div>

      <div className="flex gap-4 items-end">
        <div className="space-y-2">
          <Label>From Date</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>To Date</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          title="Overall Adherence" 
          value={`${overallAdherence}%`} 
          icon={BarChart3} 
          iconColor="text-blue-500" 
        />
        <StatCard 
          title="Total Tasks" 
          value={overallTotal} 
          icon={Clock} 
          iconColor="text-purple-500" 
        />
        <StatCard 
          title="Completed" 
          value={overallCompleted} 
          icon={CheckCircle} 
          iconColor="text-green-500" 
        />
        <StatCard 
          title="Overdue" 
          value={overallOverdue} 
          icon={AlertTriangle} 
          iconColor="text-red-500" 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Top Performing Stores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topStores.map((store, index) => (
              <div key={store.storeId} className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{store.storeName}</span>
                    <Badge className={getAdherenceColor(store.adherenceRate)}>
                      {store.adherenceRate}%
                    </Badge>
                  </div>
                  <Progress value={store.adherenceRate} className="h-2" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Stores Needing Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bottomStores.map((store, index) => (
              <div key={store.storeId} className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 font-bold">
                  {sortedStores.length - 2 + index}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{store.storeName}</span>
                    <Badge className={getAdherenceColor(store.adherenceRate)}>
                      {store.adherenceRate}%
                    </Badge>
                  </div>
                  <Progress value={store.adherenceRate} className="h-2" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Store Breakdown</CardTitle>
          <CardDescription>Adherence metrics by store and category</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-center">Total Tasks</TableHead>
                  <TableHead className="text-center">Completed</TableHead>
                  <TableHead className="text-center">Overdue</TableHead>
                  <TableHead className="text-center">Adherence</TableHead>
                  <TableHead className="text-center">On-Time Rate</TableHead>
                  <TableHead className="text-center">Cleaning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storeAdherence.map((store) => (
                  <TableRow key={store.storeId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{store.storeName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{store.totalTasks}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-green-600">{store.completedTasks}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-red-600">{store.overdueTasks}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getAdherenceColor(store.adherenceRate)}>
                        {store.adherenceRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{store.onTimeRate}%</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getAdherenceColor(store.cleaningCompliance)}>
                        {store.cleaningCompliance}%
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
          <CardTitle>Visual Heatmap</CardTitle>
          <CardDescription>Store adherence at a glance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {storeAdherence.map((store) => {
              const bgColor = store.adherenceRate >= 90 
                ? "bg-green-500" 
                : store.adherenceRate >= 70 
                  ? "bg-yellow-500" 
                  : "bg-red-500";
              
              return (
                <div
                  key={store.storeId}
                  className={`p-4 rounded-lg text-white ${bgColor} transition-transform hover:scale-105 cursor-pointer`}
                >
                  <div className="font-bold text-2xl">{store.adherenceRate}%</div>
                  <div className="text-sm opacity-90 truncate">{store.storeName}</div>
                  <div className="text-xs opacity-75 mt-1">
                    {store.completedTasks}/{store.totalTasks} tasks
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-6 mt-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500" />
              <span>90%+ Excellent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500" />
              <span>70-89% Needs Improvement</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500" />
              <span>&lt;70% Critical</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
