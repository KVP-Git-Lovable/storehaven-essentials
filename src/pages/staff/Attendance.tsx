import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Camera, MapPin, Clock, UserCheck, UserX, Calendar, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/dashboard/StatCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface AttendanceRecord {
  id: string;
  employee_id: string;
  store_id: string | null;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_photo_url: string | null;
  check_in_address: string | null;
  status: string;
  total_hours: number | null;
  employees: { name: string; department: string; face_baseline_url: string | null };
  stores: { name: string } | null;
}

interface Employee {
  id: string;
  name: string;
  department: string;
  face_baseline_url: string | null;
}

export default function Attendance() {
  const [isMarkOpen, setIsMarkOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checkType, setCheckType] = useState<"in" | "out">("in");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Get location on dialog open
  useEffect(() => {
    if (isMarkOpen) {
      getLocation();
    }
  }, [isMarkOpen]);

  const getLocation = () => {
    setGettingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({
            lat: latitude,
            lng: longitude,
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          });
          setGettingLocation(false);
        },
        (error) => {
          console.error("Location error:", error);
          setGettingLocation(false);
          toast.error("Could not get GPS location");
        }
      );
    } else {
      setGettingLocation(false);
    }
  };

  // Fetch employees
  const { data: employees } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, department, face_baseline_url")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  // Fetch stores
  const { data: stores } = useQuery({
    queryKey: ["stores-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name")
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  // Fetch today's attendance
  const { data: todayAttendance, isLoading } = useQuery({
    queryKey: ["attendance-today", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*, employees(name, department, face_baseline_url), stores(name)")
        .eq("attendance_date", selectedDate)
        .order("check_in_time", { ascending: false });
      if (error) throw error;
      return data as AttendanceRecord[];
    },
  });

  // Handle camera capture
  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCapturedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Mark attendance mutation
  const markAttendanceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployee) throw new Error("Please select an employee");
      if (!capturedFile) throw new Error("Please capture a photo");

      setUploading(true);

      // Upload photo
      const fileExt = capturedFile.name.split(".").pop();
      const fileName = `attendance/${selectedEmployee}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("employee-documents")
        .upload(fileName, capturedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("employee-documents").getPublicUrl(fileName);

      // Check for existing record
      const { data: existing } = await supabase
        .from("attendance_records")
        .select("id, check_in_time")
        .eq("employee_id", selectedEmployee)
        .eq("attendance_date", format(new Date(), "yyyy-MM-dd"))
        .single();

      if (checkType === "in") {
        if (existing) throw new Error("Already checked in today");

        const now = new Date();
        const checkInHour = now.getHours();
        const status = checkInHour <= 9 ? "present" : checkInHour <= 10 ? "late" : "late";

        await supabase.from("attendance_records").insert({
          employee_id: selectedEmployee,
          attendance_date: format(now, "yyyy-MM-dd"),
          check_in_time: now.toISOString(),
          check_in_photo_url: urlData.publicUrl,
          check_in_latitude: location?.lat,
          check_in_longitude: location?.lng,
          check_in_address: location?.address,
          status,
        });
      } else {
        if (!existing) throw new Error("No check-in record found for today");

        const checkIn = new Date(existing.check_in_time);
        const checkOut = new Date();
        const totalHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);

        await supabase
          .from("attendance_records")
          .update({
            check_out_time: checkOut.toISOString(),
            check_out_photo_url: urlData.publicUrl,
            check_out_latitude: location?.lat,
            check_out_longitude: location?.lng,
            check_out_address: location?.address,
            total_hours: parseFloat(totalHours.toFixed(2)),
          })
          .eq("id", existing.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      toast.success(checkType === "in" ? "Checked in successfully" : "Checked out successfully");
      setIsMarkOpen(false);
      setCapturedImage(null);
      setCapturedFile(null);
      setSelectedEmployee("");
      setUploading(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
      setUploading(false);
    },
  });

  // Stats
  const presentCount = todayAttendance?.filter((a) => a.status === "present").length || 0;
  const lateCount = todayAttendance?.filter((a) => a.status === "late").length || 0;
  const absentCount = (employees?.length || 0) - (todayAttendance?.length || 0);

  const stats = [
    { title: "Present Today", value: presentCount.toString(), icon: UserCheck, iconColor: "bg-success/10 text-success" },
    { title: "Late Arrivals", value: lateCount.toString(), icon: Clock, iconColor: "bg-warning/10 text-warning" },
    { title: "Absent", value: absentCount.toString(), icon: UserX, iconColor: "bg-destructive/10 text-destructive" },
    { title: "Total Staff", value: (employees?.length || 0).toString(), icon: Calendar, iconColor: "bg-primary/10 text-primary" },
  ];

  const selectedEmployeeData = employees?.find((e) => e.id === selectedEmployee);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Attendance & Leave</h1>
          <p className="text-muted-foreground">Track employee attendance with face verification and geo-stamp</p>
        </div>
        <div className="flex gap-2">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          <Dialog open={isMarkOpen} onOpenChange={setIsMarkOpen}>
            <DialogTrigger asChild>
              <Button>
                <Camera className="mr-2 h-4 w-4" /> Mark Attendance
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Mark Attendance</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex gap-2">
                  <Button
                    variant={checkType === "in" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setCheckType("in")}
                  >
                    Check In
                  </Button>
                  <Button
                    variant={checkType === "out" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setCheckType("out")}
                  >
                    Check Out
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Select Employee</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees?.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} - {emp.department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedEmployeeData?.face_baseline_url && (
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Baseline Photo</Label>
                      <img
                        src={selectedEmployeeData.face_baseline_url}
                        alt="Baseline"
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                    </div>
                    {capturedImage && (
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Captured Photo</Label>
                        <img
                          src={capturedImage}
                          alt="Captured"
                          className="w-full h-32 object-cover rounded-lg border"
                        />
                      </div>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleCapture}
                  className="hidden"
                />

                {!capturedImage ? (
                  <Button
                    variant="outline"
                    className="w-full h-24"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Camera className="h-8 w-8" />
                      <span>Capture Face Photo</span>
                    </div>
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                    <Camera className="h-4 w-4 mr-2" /> Retake Photo
                  </Button>
                )}

                <div className="p-3 rounded-lg bg-muted space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {gettingLocation ? (
                      <span className="text-sm text-muted-foreground">Getting location...</span>
                    ) : location ? (
                      <span className="text-sm text-green-600">
                        <CheckCircle className="h-4 w-4 inline mr-1" />
                        GPS Location Captured
                      </span>
                    ) : (
                      <span className="text-sm text-red-500">Location not available</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{format(new Date(), "PPpp")}</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => markAttendanceMutation.mutate()}
                  disabled={!selectedEmployee || !capturedFile || uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 mr-2" />
                      {checkType === "in" ? "Check In" : "Check Out"}
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Records - {format(parseISO(selectedDate), "MMMM d, yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            </div>
          ) : todayAttendance && todayAttendance.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayAttendance.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.employees?.name}</TableCell>
                    <TableCell>{record.employees?.department}</TableCell>
                    <TableCell>{record.stores?.name || "-"}</TableCell>
                    <TableCell>
                      {record.check_in_time ? format(parseISO(record.check_in_time), "HH:mm") : "-"}
                    </TableCell>
                    <TableCell>
                      {record.check_out_time ? format(parseISO(record.check_out_time), "HH:mm") : "-"}
                    </TableCell>
                    <TableCell>{record.total_hours ? `${record.total_hours}h` : "-"}</TableCell>
                    <TableCell>
                      {record.check_in_address ? (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <MapPin className="h-3 w-3" /> Verified
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          record.status === "present"
                            ? "default"
                            : record.status === "late"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No attendance records for this date. Start marking attendance.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
