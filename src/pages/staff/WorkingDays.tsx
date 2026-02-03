import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Loader2, Clock, Sun, Moon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/hooks/usePermissions";

interface WorkingDay {
  day: string;
  dayNumber: number;
  isWorking: boolean;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
}

export default function WorkingDays() {
  const { isAdmin } = usePermissions();
  const [editMode, setEditMode] = useState(false);

  // Sample working days configuration
  const workingDays: WorkingDay[] = [
    { day: "Monday", dayNumber: 1, isWorking: true, startTime: "09:00", endTime: "18:00", breakStart: "13:00", breakEnd: "14:00" },
    { day: "Tuesday", dayNumber: 2, isWorking: true, startTime: "09:00", endTime: "18:00", breakStart: "13:00", breakEnd: "14:00" },
    { day: "Wednesday", dayNumber: 3, isWorking: true, startTime: "09:00", endTime: "18:00", breakStart: "13:00", breakEnd: "14:00" },
    { day: "Thursday", dayNumber: 4, isWorking: true, startTime: "09:00", endTime: "18:00", breakStart: "13:00", breakEnd: "14:00" },
    { day: "Friday", dayNumber: 5, isWorking: true, startTime: "09:00", endTime: "18:00", breakStart: "13:00", breakEnd: "14:00" },
    { day: "Saturday", dayNumber: 6, isWorking: true, startTime: "09:00", endTime: "14:00", breakStart: "", breakEnd: "" },
    { day: "Sunday", dayNumber: 0, isWorking: false, startTime: "", endTime: "", breakStart: "", breakEnd: "" },
  ];

  const workingDaysCount = workingDays.filter(d => d.isWorking).length;
  const totalHoursPerWeek = workingDays.reduce((acc, day) => {
    if (!day.isWorking) return acc;
    const start = day.startTime.split(":").map(Number);
    const end = day.endTime.split(":").map(Number);
    const breakHours = day.breakStart && day.breakEnd ? 1 : 0;
    return acc + (end[0] - start[0]) - breakHours;
  }, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Working Days Configuration</h1>
          <p className="text-muted-foreground">Define weekly working hours and days off</p>
        </div>
        {isAdmin && (
          <Button variant={editMode ? "default" : "outline"} onClick={() => setEditMode(!editMode)}>
            {editMode ? "Save Changes" : "Edit Schedule"}
          </Button>
        )}
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
                <p className="text-2xl font-bold">{workingDaysCount}</p>
                <p className="text-sm text-muted-foreground">Working Days/Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <Clock className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalHoursPerWeek}</p>
                <p className="text-sm text-muted-foreground">Hours/Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-500/10">
                <Sun className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{7 - workingDaysCount}</p>
                <p className="text-sm text-muted-foreground">Days Off/Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Schedule</CardTitle>
          <CardDescription>Standard working hours for all employees</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
                <TableHead>Break</TableHead>
                <TableHead>Total Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workingDays.map((day) => {
                const hours = day.isWorking ? (() => {
                  const start = day.startTime.split(":").map(Number);
                  const end = day.endTime.split(":").map(Number);
                  const breakHours = day.breakStart && day.breakEnd ? 1 : 0;
                  return (end[0] - start[0]) - breakHours;
                })() : 0;

                return (
                  <TableRow key={day.day} className={!day.isWorking ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{day.day}</TableCell>
                    <TableCell>
                      {editMode ? (
                        <Switch checked={day.isWorking} />
                      ) : (
                        <Badge variant={day.isWorking ? "default" : "secondary"}>
                          {day.isWorking ? "Working" : "Off"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{day.isWorking ? day.startTime : "-"}</TableCell>
                    <TableCell>{day.isWorking ? day.endTime : "-"}</TableCell>
                    <TableCell>
                      {day.breakStart && day.breakEnd 
                        ? `${day.breakStart} - ${day.breakEnd}`
                        : "-"
                      }
                    </TableCell>
                    <TableCell>
                      {day.isWorking ? `${hours}h` : "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
