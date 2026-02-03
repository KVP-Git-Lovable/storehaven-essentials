import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Calendar, Loader2, PartyPopper, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: string;
  is_optional: boolean;
}

export default function Holidays() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    type: "national",
    is_optional: false,
  });
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();

  // Fetch holidays
  const { data: holidays, isLoading } = useQuery({
    queryKey: ["holidays", selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

      if (error) throw error;
      return data as Holiday[];
    },
  });

  // Create/Update holiday mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from("holidays")
          .update({ name: data.name, date: data.date, type: data.type, is_optional: data.is_optional })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("holidays")
          .insert({ name: data.name, date: data.date, type: data.type, is_optional: data.is_optional });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast.success(editingHoliday ? "Holiday updated" : "Holiday added");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Failed to save holiday: " + error.message);
    },
  });

  // Delete holiday mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("holidays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast.success("Holiday deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete holiday: " + error.message);
    },
  });

  const handleOpenDialog = (holiday?: Holiday) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setFormData({
        name: holiday.name,
        date: holiday.date,
        type: holiday.type,
        is_optional: holiday.is_optional,
      });
    } else {
      setEditingHoliday(null);
      setFormData({ name: "", date: "", type: "national", is_optional: false });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingHoliday(null);
    setFormData({ name: "", date: "", type: "national", is_optional: false });
  };

  const handleSave = () => {
    if (!formData.name || !formData.date) {
      toast.error("Please fill in all required fields");
      return;
    }
    saveMutation.mutate({ ...formData, id: editingHoliday?.id });
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      national: "default",
      festival: "secondary",
      religious: "outline",
    };
    return variants[type] || "outline";
  };

  const years = [currentYear - 1, currentYear, currentYear + 1];

  const totalHolidays = holidays?.length || 0;
  const mandatoryHolidays = holidays?.filter(h => !h.is_optional).length || 0;
  const optionalHolidays = holidays?.filter(h => h.is_optional).length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Holiday Calendar</h1>
          <p className="text-muted-foreground">View public holidays and company holidays</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" /> Add Holiday
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalHolidays}</p>
                <p className="text-sm text-muted-foreground">Total Holidays</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <PartyPopper className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mandatoryHolidays}</p>
                <p className="text-sm text-muted-foreground">Mandatory</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-500/10">
                <Calendar className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{optionalHolidays}</p>
                <p className="text-sm text-muted-foreground">Optional</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Holidays in {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            </div>
          ) : holidays && holidays.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Holiday Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Optional</TableHead>
                  {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">
                      {format(parseISO(holiday.date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(holiday.date), "EEEE")}
                    </TableCell>
                    <TableCell>{holiday.name}</TableCell>
                    <TableCell>
                      <Badge variant={getTypeBadge(holiday.type)}>
                        {holiday.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {holiday.is_optional ? (
                        <Badge variant="outline">Optional</Badge>
                      ) : (
                        <Badge variant="default">Mandatory</Badge>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(holiday)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(holiday.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No holidays configured for {selectedYear}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Holiday Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHoliday ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Holiday Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Independence Day"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="national">National</SelectItem>
                  <SelectItem value="festival">Festival</SelectItem>
                  <SelectItem value="religious">Religious</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_optional">Optional Holiday</Label>
              <Switch
                id="is_optional"
                checked={formData.is_optional}
                onCheckedChange={(checked) => setFormData({ ...formData, is_optional: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : editingHoliday ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}