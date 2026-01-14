import { useState, useEffect, useRef } from "react";
import { Camera, QrCode, CheckCircle, AlertTriangle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Guard {
  id: string;
  name: string;
  login_pin: string | null;
}

interface PatrolPoint {
  id: string;
  name: string;
  location_description: string | null;
  qr_code: string;
  stores?: { name: string };
}

interface Visit {
  id: string;
  scanned_at: string;
  is_on_time: boolean | null;
  notes: string | null;
  security_patrol_points: { name: string } | null;
}

export default function PatrolScan() {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [selectedGuard, setSelectedGuard] = useState<string>("");
  const [pin, setPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticatedGuard, setAuthenticatedGuard] = useState<Guard | null>(null);
  const [qrCode, setQrCode] = useState("");
  const [notes, setNotes] = useState("");
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [matchedPoint, setMatchedPoint] = useState<PatrolPoint | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchGuards();
  }, []);

  useEffect(() => {
    if (isAuthenticated && authenticatedGuard) {
      fetchRecentVisits(authenticatedGuard.id);
    }
  }, [isAuthenticated, authenticatedGuard]);

  const fetchGuards = async () => {
    const { data } = await supabase
      .from("security_guards")
      .select("id, name, login_pin")
      .eq("status", "active");
    if (data) setGuards(data);
  };

  const fetchRecentVisits = async (guardId: string) => {
    const { data } = await supabase
      .from("security_patrol_visits")
      .select(`
        id,
        scanned_at,
        is_on_time,
        notes,
        security_patrol_points(name)
      `)
      .eq("guard_id", guardId)
      .order("scanned_at", { ascending: false })
      .limit(10);
    
    if (data) setRecentVisits(data as Visit[]);
  };

  const handleLogin = () => {
    const guard = guards.find(g => g.id === selectedGuard);
    if (!guard) {
      toast.error("Please select a guard");
      return;
    }

    // If guard has no PIN set, allow login; otherwise verify PIN
    if (!guard.login_pin || guard.login_pin === pin) {
      setIsAuthenticated(true);
      setAuthenticatedGuard(guard);
      toast.success(`Welcome, ${guard.name}!`);
    } else {
      toast.error("Invalid PIN");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthenticatedGuard(null);
    setSelectedGuard("");
    setPin("");
    setQrCode("");
    setNotes("");
    setSelfieFile(null);
    setSelfiePreview(null);
    setMatchedPoint(null);
  };

  const handleQRChange = async (code: string) => {
    setQrCode(code);
    if (code.length > 5) {
      const { data } = await supabase
        .from("security_patrol_points")
        .select(`*, stores(name)`)
        .eq("qr_code", code)
        .single();
      
      if (data) {
        setMatchedPoint(data);
        toast.success(`Location found: ${data.name}`);
      } else {
        setMatchedPoint(null);
      }
    }
  };

  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelfieFile(file);
      const reader = new FileReader();
      reader.onload = () => setSelfiePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitVisit = async () => {
    if (!authenticatedGuard || !matchedPoint) {
      toast.error("Please scan a valid QR code");
      return;
    }

    if (!selfieFile) {
      toast.error("Please take a selfie");
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload selfie
      const fileName = `${authenticatedGuard.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("security-documents")
        .upload(fileName, selfieFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("security-documents")
        .getPublicUrl(fileName);

      // Create visit record
      const { error: visitError } = await supabase
        .from("security_patrol_visits")
        .insert({
          guard_id: authenticatedGuard.id,
          patrol_point_id: matchedPoint.id,
          selfie_url: publicUrl,
          notes: notes || null,
          is_on_time: true, // In production, calculate based on schedule
        });

      if (visitError) throw visitError;

      // Award points for the scan
      await supabase.from("security_points_log").insert({
        guard_id: authenticatedGuard.id,
        points: 5,
        reason: "Patrol scan completed",
        reference_type: "patrol_visit",
      });

      // Update total points - increment by 5
      const currentGuard = guards.find(g => g.id === authenticatedGuard.id);
      const newPoints = (currentGuard as any)?.total_points ? (currentGuard as any).total_points + 5 : 5;
      
      await supabase
        .from("security_guards")
        .update({ total_points: newPoints })
        .eq("id", authenticatedGuard.id);

      toast.success("Visit recorded! +5 points earned");
      
      // Reset form
      setQrCode("");
      setNotes("");
      setSelfieFile(null);
      setSelfiePreview(null);
      setMatchedPoint(null);
      
      fetchRecentVisits(authenticatedGuard.id);
    } catch (error) {
      console.error("Error submitting visit:", error);
      toast.error("Failed to record visit");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto space-y-6 animate-fade-in py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <QrCode className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Guard Login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Guard</Label>
              <Select value={selectedGuard} onValueChange={setSelectedGuard}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your name" />
                </SelectTrigger>
                <SelectContent>
                  {guards.map((guard) => (
                    <SelectItem key={guard.id} value={guard.id}>
                      {guard.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>PIN Code</Label>
              <Input
                type="password"
                placeholder="Enter your PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={6}
              />
            </div>
            <Button className="w-full" onClick={handleLogin}>
              Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Patrol Scan</h1>
          <p className="text-muted-foreground">Welcome, {authenticatedGuard?.name}</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>Logout</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scan QR Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Enter QR Code</Label>
              <Input
                placeholder="Scan or type QR code..."
                value={qrCode}
                onChange={(e) => handleQRChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Scan the QR code at your patrol point or type it manually
              </p>
            </div>

            {matchedPoint && (
              <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                <div className="flex items-center gap-2 text-success mb-2">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Location Verified</span>
                </div>
                <div className="space-y-1 text-sm">
                  <p><strong>Point:</strong> {matchedPoint.name}</p>
                  <p><strong>Store:</strong> {matchedPoint.stores?.name}</p>
                  {matchedPoint.location_description && (
                    <p><strong>Location:</strong> {matchedPoint.location_description}</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Take Selfie</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleSelfieChange}
              />
              {selfiePreview ? (
                <div className="relative">
                  <img 
                    src={selfiePreview} 
                    alt="Selfie preview" 
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Retake
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-32 flex flex-col gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-8 w-8" />
                  <span>Take Selfie</span>
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Any observations or notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Button 
              className="w-full" 
              onClick={handleSubmitVisit}
              disabled={!matchedPoint || !selfieFile || isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Visit"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Recent Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentVisits.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No visits recorded today</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentVisits.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell className="font-medium">
                        {visit.security_patrol_points?.name || "Unknown"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(visit.scanned_at).toLocaleTimeString()}
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
      </div>
    </div>
  );
}
