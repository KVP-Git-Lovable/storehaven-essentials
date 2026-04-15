import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Eye, MousePointer, Target } from "lucide-react";
import { format } from "date-fns";

export default function JourneyAnalytics() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: journey } = useQuery({
    queryKey: ["journey", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("journeys").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["journey-messages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journey_message_log")
        .select("*, journey_contacts(name, email)")
        .eq("journey_id", id!)
        .order("sent_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: enrollments } = useQuery({
    queryKey: ["journey-enrollments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journey_enrollments")
        .select("id, status", { count: "exact" })
        .eq("journey_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const totalSent = messages.length;
  const opened = messages.filter((m: any) => m.status === "opened").length;
  const clicked = messages.filter((m: any) => m.status === "clicked").length;
  const completed = enrollments?.filter((e: any) => e.status === "completed").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/communication/journeys/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{journey?.name || "Journey"} — Analytics</h1>
          <p className="text-muted-foreground">Performance metrics and message activity</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><Send className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Messages Sent</p>
                <p className="text-2xl font-bold">{totalSent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100"><Eye className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Open Rate</p>
                <p className="text-2xl font-bold">{totalSent ? ((opened / totalSent) * 100).toFixed(1) : 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100"><MousePointer className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Click Rate</p>
                <p className="text-2xl font-bold">{totalSent ? ((clicked / totalSent) * 100).toFixed(1) : 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100"><Target className="h-5 w-5 text-orange-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Messages</CardTitle></CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No messages sent yet</TableCell></TableRow>
            ) : messages.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell>{m.journey_contacts?.name || "—"}</TableCell>
                <TableCell className="capitalize">{m.channel}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{m.status}</Badge></TableCell>
                <TableCell>{format(new Date(m.sent_at), "MMM d, HH:mm")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
