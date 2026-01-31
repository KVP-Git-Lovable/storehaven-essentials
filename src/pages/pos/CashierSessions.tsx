import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format, differenceInMinutes } from "date-fns";
import { 
  Play, 
  Square, 
  Clock, 
  Banknote, 
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function CashierSessions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("");
  const [actualClosing, setActualClosing] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [activeSession, setActiveSession] = useState<any>(null);

  // Fetch stores
  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
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

  // Fetch current user's active session
  const { data: currentSession } = useQuery({
    queryKey: ["current-cashier-session", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("cashier_sessions")
        .select(`
          *,
          store:stores(name)
        `)
        .eq("user_id", user.id)
        .eq("status", "open")
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch all sessions
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["cashier-sessions", selectedStore],
    queryFn: async () => {
      let query = supabase
        .from("cashier_sessions")
        .select(`
          *,
          store:stores(name),
          profile:profiles(full_name)
        `)
        .order("start_time", { ascending: false })
        .limit(50);

      if (selectedStore) {
        query = query.eq("store_id", selectedStore);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Calculate expected cash for a session
  const calculateExpectedCash = async (sessionId: string, openingFloat: number) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return openingFloat;

    // Fetch cash orders during session
    const { data: orders } = await supabase
      .from("orders")
      .select("total_amount, payment_method")
      .eq("store_id", session.store_id)
      .eq("payment_method", "cash")
      .gte("created_at", session.start_time)
      .lte("created_at", session.end_time || new Date().toISOString());

    const cashIn = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
    
    return openingFloat + cashIn;
  };

  // Open session mutation
  const openSessionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStore) throw new Error("Please select a store");
      if (!openingFloat) throw new Error("Please enter opening float");

      const { data, error } = await supabase
        .from("cashier_sessions")
        .insert({
          user_id: user?.id,
          store_id: selectedStore,
          opening_float: parseFloat(openingFloat),
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Cashier session opened");
      setIsOpenDialogOpen(false);
      setOpeningFloat("");
      queryClient.invalidateQueries({ queryKey: ["cashier-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["current-cashier-session"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to open session");
    },
  });

  // Close session mutation
  const closeSessionMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession) throw new Error("No active session");
      if (!actualClosing) throw new Error("Please enter actual closing amount");

      const closingAmount = parseFloat(actualClosing);
      const expectedClosing = await calculateExpectedCash(
        activeSession.id, 
        activeSession.opening_float
      );
      const difference = closingAmount - expectedClosing;

      const { error } = await supabase
        .from("cashier_sessions")
        .update({
          end_time: new Date().toISOString(),
          expected_closing: expectedClosing,
          actual_closing: closingAmount,
          difference,
          notes: closeNotes,
          status: "closed",
        })
        .eq("id", activeSession.id);

      if (error) throw error;
      return { difference };
    },
    onSuccess: ({ difference }) => {
      if (difference === 0) {
        toast.success("Session closed. Cash balanced perfectly!");
      } else if (difference > 0) {
        toast.success(`Session closed. Cash surplus: ₹${difference.toFixed(2)}`);
      } else {
        toast.warning(`Session closed. Cash shortage: ₹${Math.abs(difference).toFixed(2)}`);
      }
      setIsCloseDialogOpen(false);
      setActualClosing("");
      setCloseNotes("");
      setActiveSession(null);
      queryClient.invalidateQueries({ queryKey: ["cashier-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["current-cashier-session"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to close session");
    },
  });

  const handleCloseSession = (session: any) => {
    setActiveSession(session);
    setIsCloseDialogOpen(true);
  };

  const getSessionDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const minutes = differenceInMinutes(end, start);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getDifferenceColor = (diff: number | null) => {
    if (diff === null || diff === undefined) return "";
    if (diff === 0) return "text-green-600";
    if (diff > 0) return "text-blue-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cashier Sessions</h1>
          <p className="text-muted-foreground">Manage cash drawer and shift reconciliation</p>
        </div>
        {!currentSession && (
          <Button onClick={() => setIsOpenDialogOpen(true)}>
            <Play className="h-4 w-4 mr-2" />
            Open Session
          </Button>
        )}
      </div>

      {/* Current Session Card */}
      {currentSession && (
        <Card className="border-primary">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                Active Session
              </span>
              <Badge variant="secondary">{currentSession.store?.name}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-muted p-3 rounded-lg">
                <div className="text-xs text-muted-foreground">Started</div>
                <div className="font-medium">
                  {format(new Date(currentSession.start_time), "HH:mm")}
                </div>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <div className="text-xs text-muted-foreground">Duration</div>
                <div className="font-medium">
                  {getSessionDuration(currentSession.start_time)}
                </div>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <div className="text-xs text-muted-foreground">Opening Float</div>
                <div className="font-medium">₹{currentSession.opening_float}</div>
              </div>
              <div>
                <Button 
                  variant="destructive" 
                  className="w-full h-full"
                  onClick={() => handleCloseSession(currentSession)}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Close Session
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Session History
            </CardTitle>
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Cashier</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session: any) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <div className="font-medium">
                      {format(new Date(session.start_time), "dd MMM yyyy")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(session.start_time), "HH:mm")} - 
                      {session.end_time 
                        ? format(new Date(session.end_time), " HH:mm")
                        : " ongoing"}
                    </div>
                  </TableCell>
                  <TableCell>{session.store?.name || "-"}</TableCell>
                  <TableCell>{session.profile?.full_name || "Unknown"}</TableCell>
                  <TableCell>{getSessionDuration(session.start_time, session.end_time)}</TableCell>
                  <TableCell className="text-right">₹{session.opening_float}</TableCell>
                  <TableCell className="text-right">
                    {session.expected_closing !== null ? `₹${session.expected_closing}` : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {session.actual_closing !== null ? `₹${session.actual_closing}` : "-"}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${getDifferenceColor(session.difference)}`}>
                    {session.difference !== null ? (
                      <span className="flex items-center justify-end gap-1">
                        {session.difference > 0 && <TrendingUp className="h-3 w-3" />}
                        {session.difference < 0 && <TrendingDown className="h-3 w-3" />}
                        {session.difference === 0 && <CheckCircle className="h-3 w-3" />}
                        ₹{Math.abs(session.difference).toFixed(2)}
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={session.status === "open" ? "default" : "secondary"}>
                      {session.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {sessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No sessions found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Open Session Dialog */}
      <Dialog open={isOpenDialogOpen} onOpenChange={setIsOpenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Open Cashier Session
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Store *</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Opening Float (₹) *</Label>
              <Input
                type="number"
                placeholder="Enter cash in drawer"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Count the cash in your drawer before starting
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpenDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => openSessionMutation.mutate()}
              disabled={!selectedStore || !openingFloat || openSessionMutation.isPending}
            >
              {openSessionMutation.isPending ? "Opening..." : "Open Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Session Dialog */}
      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Square className="h-5 w-5" />
              Close Cashier Session
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {activeSession && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Opening Float:</span>
                  <span className="font-medium">₹{activeSession.opening_float}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Duration:</span>
                  <span className="font-medium">
                    {getSessionDuration(activeSession.start_time)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Actual Cash in Drawer (₹) *</Label>
              <Input
                type="number"
                placeholder="Count and enter total cash"
                value={actualClosing}
                onChange={(e) => setActualClosing(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Any notes about the session..."
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloseDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => closeSessionMutation.mutate()}
              disabled={!actualClosing || closeSessionMutation.isPending}
            >
              {closeSessionMutation.isPending ? "Closing..." : "Close Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
