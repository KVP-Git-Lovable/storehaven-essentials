import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { UserCheck, TrendingUp, TrendingDown, Store, Plus, Calendar, Edit, Trash2 } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FootfallRecord {
  id: string;
  store_id: string;
  record_date: string;
  entry_count: number;
  exit_count: number;
  peak_hour_start: string | null;
  peak_hour_end: string | null;
  peak_hour_count: number | null;
  conversion_count: number | null;
  notes: string | null;
  recorded_by: string | null;
  stores?: { name: string };
}

interface FootfallForm {
  store_id: string;
  record_date: Date;
  entry_count: number;
  exit_count: number;
  peak_hour_start: string;
  peak_hour_end: string;
  peak_hour_count: number;
  conversion_count: number;
  notes: string;
}

const defaultForm: FootfallForm = {
  store_id: "",
  record_date: new Date(),
  entry_count: 0,
  exit_count: 0,
  peak_hour_start: "",
  peak_hour_end: "",
  peak_hour_count: 0,
  conversion_count: 0,
  notes: "",
};

export default function Footfall() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FootfallForm>(defaultForm);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const queryClient = useQueryClient();

  // Fetch stores
  const { data: stores } = useQuery({
    queryKey: ["stores-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch footfall records
  const { data: records, isLoading } = useQuery({
    queryKey: ["footfall-records", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("footfall_records")
        .select("*, stores(name)")
        .gte("record_date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("record_date", format(dateRange.to, "yyyy-MM-dd"))
        .order("record_date", { ascending: false });
      if (error) throw error;
      return data as FootfallRecord[];
    },
  });

  // Calculate statistics
  const stats = useMemo(() => {
    if (!records || records.length === 0) {
      return {
        totalToday: 0,
        peakStore: "N/A",
        highestGrowth: "N/A",
        avgConversion: 0,
      };
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");

    const todayRecords = records.filter((r) => r.record_date === today);
    const yesterdayRecords = records.filter((r) => r.record_date === yesterday);

    const totalToday = todayRecords.reduce((sum, r) => sum + r.entry_count, 0);

    // Find peak store today
    const storeToday = todayRecords.reduce((acc, r) => {
      acc[r.stores?.name || "Unknown"] = (acc[r.stores?.name || "Unknown"] || 0) + r.entry_count;
      return acc;
    }, {} as Record<string, number>);
    const peakStore = Object.entries(storeToday).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    // Calculate growth per store
    const growthByStore: Record<string, number> = {};
    todayRecords.forEach((tr) => {
      const storeName = tr.stores?.name || "Unknown";
      const yRecord = yesterdayRecords.find((yr) => yr.store_id === tr.store_id);
      if (yRecord && yRecord.entry_count > 0) {
        growthByStore[storeName] = ((tr.entry_count - yRecord.entry_count) / yRecord.entry_count) * 100;
      }
    });
    const highestGrowthEntry = Object.entries(growthByStore).sort((a, b) => b[1] - a[1])[0];
    const highestGrowth = highestGrowthEntry
      ? `${highestGrowthEntry[0]} ${highestGrowthEntry[1] >= 0 ? "+" : ""}${highestGrowthEntry[1].toFixed(0)}%`
      : "N/A";

    // Average conversion rate
    const totalEntries = records.reduce((sum, r) => sum + r.entry_count, 0);
    const totalConversions = records.reduce((sum, r) => sum + (r.conversion_count || 0), 0);
    const avgConversion = totalEntries > 0 ? (totalConversions / totalEntries) * 100 : 0;

    return { totalToday, peakStore, highestGrowth, avgConversion };
  }, [records]);

  // Chart data - daily trend
  const trendChartData = useMemo(() => {
    if (!records) return [];
    const byDate: Record<string, number> = {};
    records.forEach((r) => {
      byDate[r.record_date] = (byDate[r.record_date] || 0) + r.entry_count;
    });
    return Object.entries(byDate)
      .map(([date, count]) => ({ date: format(parseISO(date), "MMM dd"), count }))
      .reverse();
  }, [records]);

  // Chart data - by store (today)
  const storeChartData = useMemo(() => {
    if (!records) return [];
    const today = format(new Date(), "yyyy-MM-dd");
    const todayRecords = records.filter((r) => r.record_date === today);
    return todayRecords.map((r) => ({
      store: r.stores?.name || "Unknown",
      entries: r.entry_count,
      conversions: r.conversion_count || 0,
    }));
  }, [records]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: FootfallForm) => {
      const payload = {
        store_id: data.store_id,
        record_date: format(data.record_date, "yyyy-MM-dd"),
        entry_count: data.entry_count,
        exit_count: data.exit_count,
        peak_hour_start: data.peak_hour_start || null,
        peak_hour_end: data.peak_hour_end || null,
        peak_hour_count: data.peak_hour_count || null,
        conversion_count: data.conversion_count || null,
        notes: data.notes || null,
      };
      const { error } = await supabase.from("footfall_records").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["footfall-records"] });
      toast.success("Footfall record added");
      setIsDialogOpen(false);
      setForm(defaultForm);
    },
    onError: (error: any) => {
      if (error.message.includes("unique_store_date")) {
        toast.error("A record for this store and date already exists");
      } else {
        toast.error(error.message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FootfallForm }) => {
      const payload = {
        store_id: data.store_id,
        record_date: format(data.record_date, "yyyy-MM-dd"),
        entry_count: data.entry_count,
        exit_count: data.exit_count,
        peak_hour_start: data.peak_hour_start || null,
        peak_hour_end: data.peak_hour_end || null,
        peak_hour_count: data.peak_hour_count || null,
        conversion_count: data.conversion_count || null,
        notes: data.notes || null,
      };
      const { error } = await supabase.from("footfall_records").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["footfall-records"] });
      toast.success("Footfall record updated");
      setIsDialogOpen(false);
      setEditingId(null);
      setForm(defaultForm);
    },
    onError: (error: any) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("footfall_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["footfall-records"] });
      toast.success("Record deleted");
    },
    onError: (error: any) => toast.error(error.message),
  });

  const handleSubmit = () => {
    if (!form.store_id || form.entry_count < 0) {
      toast.error("Please select a store and enter valid entry count");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (record: FootfallRecord) => {
    setEditingId(record.id);
    setForm({
      store_id: record.store_id,
      record_date: parseISO(record.record_date),
      entry_count: record.entry_count,
      exit_count: record.exit_count,
      peak_hour_start: record.peak_hour_start || "",
      peak_hour_end: record.peak_hour_end || "",
      peak_hour_count: record.peak_hour_count || 0,
      conversion_count: record.conversion_count || 0,
      notes: record.notes || "",
    });
    setIsDialogOpen(true);
  };

  const statCards = [
    {
      title: "Total Today",
      value: stats.totalToday.toLocaleString(),
      icon: UserCheck,
      iconColor: "bg-primary/10 text-primary",
    },
    {
      title: "Peak Store",
      value: stats.peakStore,
      icon: Store,
      iconColor: "bg-success/10 text-success",
    },
    {
      title: "Highest Growth",
      value: stats.highestGrowth,
      icon: TrendingUp,
      iconColor: "bg-info/10 text-info",
    },
    {
      title: "Avg Conversion",
      value: `${stats.avgConversion.toFixed(1)}%`,
      icon: TrendingDown,
      iconColor: "bg-warning/10 text-warning",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Footfall Tracking</h1>
          <p className="text-muted-foreground">Monitor and analyze customer visits across stores</p>
        </div>
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" />
                {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarPicker
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
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
                <Plus className="mr-2 h-4 w-4" /> Add Record
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Footfall Record" : "Add Footfall Record"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Store *</Label>
                    <Select value={form.store_id} onValueChange={(v) => setForm({ ...form, store_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select store" />
                      </SelectTrigger>
                      <SelectContent>
                        {stores?.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <Calendar className="mr-2 h-4 w-4" />
                          {format(form.record_date, "PPP")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarPicker
                          mode="single"
                          selected={form.record_date}
                          onSelect={(date) => date && setForm({ ...form, record_date: date })}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Entry Count *</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.entry_count}
                      onChange={(e) => setForm({ ...form, entry_count: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Exit Count</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.exit_count}
                      onChange={(e) => setForm({ ...form, exit_count: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Peak Start</Label>
                    <Input
                      type="time"
                      value={form.peak_hour_start}
                      onChange={(e) => setForm({ ...form, peak_hour_start: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Peak End</Label>
                    <Input
                      type="time"
                      value={form.peak_hour_end}
                      onChange={(e) => setForm({ ...form, peak_hour_end: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Peak Count</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.peak_hour_count}
                      onChange={(e) => setForm({ ...form, peak_hour_count: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Conversions (Purchases)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.conversion_count}
                    onChange={(e) => setForm({ ...form, conversion_count: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Any observations or comments"
                  />
                </div>
                <Button onClick={handleSubmit} className="w-full">
                  {editingId ? "Update Record" : "Add Record"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Store Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {storeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={storeChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="store" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="entries" name="Entries" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="conversions" name="Conversions" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data for today. Add a footfall record to see store performance.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Footfall Records</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : records && records.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                  <TableHead className="text-right">Exits</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">Conv. Rate</TableHead>
                  <TableHead>Peak Hours</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const convRate =
                    record.entry_count > 0
                      ? ((record.conversion_count || 0) / record.entry_count) * 100
                      : 0;
                  return (
                    <TableRow key={record.id}>
                      <TableCell>{format(parseISO(record.record_date), "MMM dd, yyyy")}</TableCell>
                      <TableCell className="font-medium">{record.stores?.name}</TableCell>
                      <TableCell className="text-right">{record.entry_count.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{record.exit_count.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{(record.conversion_count || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{convRate.toFixed(1)}%</TableCell>
                      <TableCell>
                        {record.peak_hour_start && record.peak_hour_end
                          ? `${record.peak_hour_start.slice(0, 5)} - ${record.peak_hour_end.slice(0, 5)}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(record)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(record.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No footfall records found for the selected date range. Click "Add Record" to start tracking.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
