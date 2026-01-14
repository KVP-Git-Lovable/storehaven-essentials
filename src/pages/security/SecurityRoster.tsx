import { useState, useEffect } from "react";
import { Plus, Calendar, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHIFT_TYPES = ["Morning", "Evening", "Night"];

interface Guard {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
}

interface RosterTemplate {
  id: string;
  guard_id: string;
  store_id: string;
  day_of_week: number;
  shift_type: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  security_guards?: { name: string };
  stores?: { name: string };
}

interface DailyAssignment {
  id: string;
  guard_id: string;
  store_id: string;
  assignment_date: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  security_guards?: { name: string };
  stores?: { name: string };
}

export default function SecurityRoster() {
  const [templates, setTemplates] = useState<RosterTemplate[]>([]);
  const [dailyAssignments, setDailyAssignments] = useState<DailyAssignment[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isDailyDialogOpen, setIsDailyDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  // Form state for templates
  const [templateForm, setTemplateForm] = useState({
    guard_id: "",
    store_id: "",
    day_of_week: "1",
    shift_type: "Morning",
    start_time: "08:00",
    end_time: "20:00",
  });

  // Form state for daily
  const [dailyForm, setDailyForm] = useState({
    guard_id: "",
    store_id: "",
    assignment_date: new Date().toISOString().split("T")[0],
    shift_type: "Morning",
    start_time: "08:00",
    end_time: "20:00",
  });

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    try {
      const [guardsRes, storesRes, templatesRes, dailyRes] = await Promise.all([
        supabase.from("security_guards").select("id, name").eq("status", "active"),
        supabase.from("stores").select("id, name").eq("status", "active"),
        supabase.from("security_roster_templates").select(`
          *,
          security_guards(name),
          stores(name)
        `).eq("is_active", true),
        supabase.from("security_roster_daily").select(`
          *,
          security_guards(name),
          stores(name)
        `).eq("assignment_date", selectedDate).order("start_time"),
      ]);

      if (guardsRes.data) setGuards(guardsRes.data);
      if (storesRes.data) setStores(storesRes.data);
      if (templatesRes.data) setTemplates(templatesRes.data);
      if (dailyRes.data) setDailyAssignments(dailyRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch roster data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTemplate = async () => {
    try {
      const { error } = await supabase.from("security_roster_templates").insert({
        guard_id: templateForm.guard_id,
        store_id: templateForm.store_id,
        day_of_week: parseInt(templateForm.day_of_week),
        shift_type: templateForm.shift_type,
        start_time: templateForm.start_time,
        end_time: templateForm.end_time,
      });

      if (error) throw error;
      toast.success("Weekly schedule template added");
      setIsTemplateDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error adding template:", error);
      toast.error("Failed to add template");
    }
  };

  const handleAddDaily = async () => {
    try {
      const { error } = await supabase.from("security_roster_daily").insert({
        guard_id: dailyForm.guard_id,
        store_id: dailyForm.store_id,
        assignment_date: dailyForm.assignment_date,
        shift_type: dailyForm.shift_type,
        start_time: dailyForm.start_time,
        end_time: dailyForm.end_time,
      });

      if (error) throw error;
      toast.success("Daily assignment added");
      setIsDailyDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error adding assignment:", error);
      toast.error("Failed to add assignment");
    }
  };

  const generateFromTemplate = async () => {
    try {
      const dayOfWeek = new Date(selectedDate).getDay();
      const matchingTemplates = templates.filter(t => t.day_of_week === dayOfWeek);

      if (matchingTemplates.length === 0) {
        toast.info("No templates found for this day");
        return;
      }

      const assignments = matchingTemplates.map(t => ({
        guard_id: t.guard_id,
        store_id: t.store_id,
        assignment_date: selectedDate,
        shift_type: t.shift_type,
        start_time: t.start_time,
        end_time: t.end_time,
      }));

      const { error } = await supabase.from("security_roster_daily").insert(assignments);
      if (error) throw error;
      
      toast.success(`Generated ${assignments.length} assignments from templates`);
      fetchData();
    } catch (error) {
      console.error("Error generating assignments:", error);
      toast.error("Failed to generate assignments");
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Security Roster</h1>
          <p className="text-muted-foreground">Manage guard schedules and shifts</p>
        </div>
      </div>

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Daily Assignments</TabsTrigger>
          <TabsTrigger value="templates">Weekly Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <div className="flex items-center gap-4 justify-between">
            <div className="flex items-center gap-4">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto"
              />
              <Button variant="outline" onClick={generateFromTemplate}>
                <Calendar className="h-4 w-4 mr-2" />
                Generate from Templates
              </Button>
            </div>
            <Button onClick={() => setIsDailyDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Assignment
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Assignments for {new Date(selectedDate).toLocaleDateString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guard</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyAssignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No assignments for this date
                      </TableCell>
                    </TableRow>
                  ) : (
                    dailyAssignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-medium">
                          {assignment.security_guards?.name}
                        </TableCell>
                        <TableCell>{assignment.stores?.name}</TableCell>
                        <TableCell>{assignment.shift_type}</TableCell>
                        <TableCell>
                          {assignment.start_time} - {assignment.end_time}
                        </TableCell>
                        <TableCell>
                          {assignment.check_in_time 
                            ? new Date(assignment.check_in_time).toLocaleTimeString() 
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {assignment.check_out_time 
                            ? new Date(assignment.check_out_time).toLocaleTimeString() 
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              assignment.status === "completed" ? "default" :
                              assignment.status === "in-progress" ? "secondary" : "outline"
                            }
                          >
                            {assignment.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsTemplateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Template
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Weekly Recurring Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guard</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No schedule templates created yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">
                          {template.security_guards?.name}
                        </TableCell>
                        <TableCell>{template.stores?.name}</TableCell>
                        <TableCell>{DAYS_OF_WEEK[template.day_of_week]}</TableCell>
                        <TableCell>{template.shift_type}</TableCell>
                        <TableCell>{template.start_time} - {template.end_time}</TableCell>
                        <TableCell>
                          <Badge variant={template.is_active ? "default" : "secondary"}>
                            {template.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Weekly Schedule Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Guard</Label>
              <Select value={templateForm.guard_id} onValueChange={(v) => setTemplateForm({...templateForm, guard_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select guard" /></SelectTrigger>
                <SelectContent>
                  {guards.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Store</Label>
              <Select value={templateForm.store_id} onValueChange={(v) => setTemplateForm({...templateForm, store_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select value={templateForm.day_of_week} onValueChange={(v) => setTemplateForm({...templateForm, day_of_week: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day, index) => (
                    <SelectItem key={index} value={index.toString()}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Shift Type</Label>
              <Select value={templateForm.shift_type} onValueChange={(v) => setTemplateForm({...templateForm, shift_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHIFT_TYPES.map((shift) => (
                    <SelectItem key={shift} value={shift}>{shift}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={templateForm.start_time} onChange={(e) => setTemplateForm({...templateForm, start_time: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={templateForm.end_time} onChange={(e) => setTemplateForm({...templateForm, end_time: e.target.value})} />
              </div>
            </div>
            <Button className="w-full" onClick={handleAddTemplate}>Add Template</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Daily Assignment Dialog */}
      <Dialog open={isDailyDialogOpen} onOpenChange={setIsDailyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Daily Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Guard</Label>
              <Select value={dailyForm.guard_id} onValueChange={(v) => setDailyForm({...dailyForm, guard_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select guard" /></SelectTrigger>
                <SelectContent>
                  {guards.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Store</Label>
              <Select value={dailyForm.store_id} onValueChange={(v) => setDailyForm({...dailyForm, store_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={dailyForm.assignment_date} onChange={(e) => setDailyForm({...dailyForm, assignment_date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Shift Type</Label>
              <Select value={dailyForm.shift_type} onValueChange={(v) => setDailyForm({...dailyForm, shift_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHIFT_TYPES.map((shift) => (
                    <SelectItem key={shift} value={shift}>{shift}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={dailyForm.start_time} onChange={(e) => setDailyForm({...dailyForm, start_time: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={dailyForm.end_time} onChange={(e) => setDailyForm({...dailyForm, end_time: e.target.value})} />
              </div>
            </div>
            <Button className="w-full" onClick={handleAddDaily}>Add Assignment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
