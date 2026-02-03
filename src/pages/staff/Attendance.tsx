import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Camera, MapPin, Clock, UserCheck, UserX, Calendar, Loader2, CheckCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/StatCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FaceCaptureDialog } from "@/components/staff/FaceCaptureDialog";
import { FaceVerificationBadge } from "@/components/attendance/FaceVerificationBadge";
import { useAuth } from "@/hooks/useAuth";

interface AttendanceRecord {
  id: string;
  user_id: string | null;
  employee_id: string | null;
  store_id: string | null;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_photo_url: string | null;
  check_in_address: string | null;
  status: string;
  total_hours: number | null;
  face_verification_status: string | null;
  face_match_score: number | null;
  profiles: { username: string; email: string; profile_photo_url: string | null; face_baseline_url: string | null } | null;
  stores: { name: string } | null;
}

interface UserProfile {
  id: string;
  username: string;
  email: string;
  profile_photo_url: string | null;
  face_baseline_url: string | null;
}

export default function Attendance() {
  const { user, profile } = useAuth();
  const [isMarkOpen, setIsMarkOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checkType, setCheckType] = useState<"in" | "out">("in");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [verifyingFace, setVerifyingFace] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{ status: string; score: number; reason?: string } | null>(null);
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

  // Fetch current user's profile for baseline photo
  const { data: currentProfile, isLoading: loadingProfile } = useQuery({
    queryKey: ["current-profile-attendance", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, email, profile_photo_url, face_baseline_url")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as UserProfile | null;
    },
    enabled: !!user?.id,
  });

  // Fetch today's attendance
  const { data: todayAttendance, isLoading } = useQuery({
    queryKey: ["attendance-today", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*, profiles(username, email, profile_photo_url, face_baseline_url), stores(name)")
        .eq("attendance_date", selectedDate)
        .order("check_in_time", { ascending: false });
      if (error) throw error;
      return data as unknown as AttendanceRecord[];
    },
  });

  // Handle camera capture from FaceCaptureDialog
  const handleFaceCapture = (imageData: string, file: File) => {
    setCapturedImage(imageData);
    setCapturedFile(file);
    setVerificationResult(null);
  };

  // Get baseline photo URL (prefer face_baseline_url, fallback to profile_photo_url)
  const baselinePhotoUrl = useMemo(() => {
    return currentProfile?.face_baseline_url || currentProfile?.profile_photo_url || null;
  }, [currentProfile]);

  // Verify face against profile photo
  const verifyFace = async (attendancePhotoUrl: string, recordId?: string) => {
    setVerifyingFace(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-face", {
        body: {
          profilePhotoUrl: baselinePhotoUrl,
          attendancePhotoUrl,
          attendanceRecordId: recordId,
        },
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error("Face verification error:", error);
      return { status: "blocked", score: 0, reason: error.message, error: "verification_failed" };
    } finally {
      setVerifyingFace(false);
    }
  };

  // Mark attendance mutation
  const markAttendanceMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("You must be logged in to mark attendance");
      if (!capturedFile) throw new Error("Please capture a photo");

      setUploading(true);

      // Upload photo
      const fileExt = capturedFile.name.split(".").pop();
      const fileName = `attendance/${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("employee-documents")
        .upload(fileName, capturedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("employee-documents").getPublicUrl(fileName);

      // Verify face if baseline exists
      let verifyResult: { status: string; score: number; reason?: string; error?: string } = { 
        status: "skipped", 
        score: 0, 
        reason: "No baseline photo" 
      };
      if (baselinePhotoUrl) {
        setVerifyingFace(true);
        verifyResult = await verifyFace(urlData.publicUrl);
        setVerificationResult(verifyResult);
        setVerifyingFace(false);

        // Block check-in if face verification failed
        if (verifyResult.error || verifyResult.status === "blocked") {
          throw new Error(verifyResult.reason || "Face verification failed");
        }
      }

      // Check for existing record using user_id
      const { data: existing } = await supabase
        .from("attendance_records")
        .select("id, check_in_time")
        .eq("user_id", user.id)
        .eq("attendance_date", format(new Date(), "yyyy-MM-dd"))
        .single();

      if (checkType === "in") {
        if (existing) throw new Error("Already checked in today");

        const now = new Date();
        const checkInHour = now.getHours();
        const status = checkInHour <= 9 ? "present" : "late";

        await supabase.from("attendance_records").insert({
          user_id: user.id,
          attendance_date: format(now, "yyyy-MM-dd"),
          check_in_time: now.toISOString(),
          check_in_photo_url: urlData.publicUrl,
          check_in_latitude: location?.lat,
          check_in_longitude: location?.lng,
          check_in_address: location?.address,
          status,
          face_verification_status: verifyResult.status,
          face_match_score: verifyResult.score,
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
            face_verification_status: verifyResult.status,
            face_match_score: verifyResult.score,
          })
          .eq("id", existing.id);
      }
    },
    onSuccess: () => {
      // Optimistic refresh - invalidate immediately for instant sync
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      // Also refetch to ensure fresh data
      queryClient.refetchQueries({ queryKey: ["attendance-today", selectedDate] });
      toast.success(checkType === "in" ? "Checked in successfully" : "Checked out successfully");
      setIsMarkOpen(false);
      setCapturedImage(null);
      setCapturedFile(null);
      setUploading(false);
      setVerificationResult(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
      setUploading(false);
    },
  });

  // Stats
  const presentCount = todayAttendance?.filter((a) => a.status === "present").length || 0;
  const lateCount = todayAttendance?.filter((a) => a.status === "late").length || 0;
  const totalRecords = todayAttendance?.length || 0;

  const stats = [
    { title: "Present Today", value: presentCount.toString(), icon: UserCheck, iconColor: "bg-success/10 text-success" },
    { title: "Late Arrivals", value: lateCount.toString(), icon: Clock, iconColor: "bg-warning/10 text-warning" },
    { title: "Total Records", value: totalRecords.toString(), icon: Calendar, iconColor: "bg-primary/10 text-primary" },
  ];

  const displayName = currentProfile?.username || profile?.username || user?.email?.split("@")[0] || "User";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Attendance & Leave</h1>
          <p className="text-muted-foreground">Track attendance with face verification and geo-stamp</p>
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

                {/* Current User Display */}
                {loadingProfile ? (
                  <div className="p-4 rounded-lg bg-muted flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading your profile...</span>
                  </div>
                ) : (
                  <>
                    {/* Current user display */}
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-3">
                        {currentProfile?.profile_photo_url ? (
                          <img
                            src={currentProfile.profile_photo_url}
                            alt="Profile"
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{displayName}</p>
                          <p className="text-xs text-muted-foreground">{currentProfile?.email || user?.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Captured photo preview */}
                    {capturedImage && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Captured Photo</Label>
                        <img
                          src={capturedImage}
                          alt="Captured"
                          className="w-full h-32 object-cover rounded-lg border"
                        />
                      </div>
                    )}
                  </>
                )}

                {!capturedImage ? (
                  <Button
                    variant="outline"
                    className="w-full h-24"
                    onClick={() => setIsCameraOpen(true)}
                    disabled={!user}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Camera className="h-8 w-8" />
                      <span>Capture Face Photo</span>
                    </div>
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => setIsCameraOpen(true)}>
                    <Camera className="h-4 w-4 mr-2" /> Retake Photo
                  </Button>
                )}

                <FaceCaptureDialog
                  open={isCameraOpen}
                  onOpenChange={setIsCameraOpen}
                  onCapture={handleFaceCapture}
                />

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

                {/* Verification Status Display */}
                {verifyingFace && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-sm text-blue-700">Verifying face match...</span>
                  </div>
                )}

                {verificationResult && !verifyingFace && (
                  <div className={`p-3 rounded-lg border ${
                    verificationResult.status === "matched" 
                      ? "bg-green-50 border-green-200" 
                      : verificationResult.status === "blocked"
                      ? "bg-amber-50 border-amber-200"
                      : verificationResult.status === "skipped"
                      ? "bg-blue-50 border-blue-200"
                      : "bg-red-50 border-red-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      {verificationResult.status === "blocked" ? (
                        <span className="text-sm text-amber-800 font-medium">
                          ⚠️ {verificationResult.reason}
                        </span>
                      ) : verificationResult.status === "skipped" ? (
                        <span className="text-sm text-blue-800 font-medium">
                          ℹ️ Face verification skipped
                        </span>
                      ) : (
                        <>
                          <FaceVerificationBadge 
                            status={verificationResult.status as "matched" | "mismatch"}
                            score={verificationResult.score}
                          />
                          {verificationResult.reason && (
                            <span className="text-xs text-muted-foreground">{verificationResult.reason}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => markAttendanceMutation.mutate()}
                  disabled={
                    !user || 
                    !capturedFile || 
                    uploading || 
                    verifyingFace
                  }
                >
                  {uploading || verifyingFace ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {verifyingFace ? "Verifying Face..." : "Processing..."}
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
      <div className="grid gap-4 md:grid-cols-3">
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
                  <TableHead>User</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Photo</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayAttendance.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.profiles?.username || record.profiles?.email || "Unknown"}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(record.attendance_date), "dd MMM")}
                    </TableCell>
                    <TableCell>
                      {record.check_in_time ? format(parseISO(record.check_in_time), "HH:mm") : "-"}
                    </TableCell>
                    <TableCell>
                      {record.check_out_time ? format(parseISO(record.check_out_time), "HH:mm") : "-"}
                    </TableCell>
                    <TableCell>
                      {record.check_in_photo_url ? (
                        <img 
                          src={record.check_in_photo_url} 
                          alt="Check-in" 
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        "-"
                      )}
                    </TableCell>
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
                      <FaceVerificationBadge
                        status={(record.face_verification_status as "pending" | "verifying" | "matched" | "mismatch" | "skipped") || "pending"}
                        score={record.face_match_score}
                      />
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
