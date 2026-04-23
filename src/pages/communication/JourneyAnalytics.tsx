import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Send, Eye, MousePointer, Target, Mail, MessageSquare } from "lucide-react";
import { WhatsAppIcon } from "@/components/communication/WhatsAppIcon";
import { format } from "date-fns";

const SUCCESS_STATUSES = new Set(["sent", "delivered", "queued", "accepted", "scheduled", "sending"]);
const FAIL_STATUSES = new Set(["failed", "undelivered"]);

const channelMeta: Record<string, { label: string; Icon: any; iconClass: string; bgClass: string }> = {
  whatsapp: { label: "WhatsApp", Icon: WhatsAppIcon, iconClass: "text-green-600", bgClass: "bg-green-100" },
  whatsapp_template: { label: "WhatsApp", Icon: WhatsAppIcon, iconClass: "text-green-600", bgClass: "bg-green-100" },
  sms: { label: "SMS", Icon: MessageSquare, iconClass: "text-blue-600", bgClass: "bg-blue-100" },
  email: { label: "Email", Icon: Mail, iconClass: "text-purple-600", bgClass: "bg-purple-100" },
};

function summarizeByChannel(messages: any[]) {
  const groups: Record<string, { sent: number; delivered: number; failed: number }> = {
    whatsapp: { sent: 0, delivered: 0, failed: 0 },
    sms: { sent: 0, delivered: 0, failed: 0 },
    email: { sent: 0, delivered: 0, failed: 0 },
  };
  for (const m of messages) {
    const ch = m.channel === "whatsapp_template" ? "whatsapp" : m.channel;
    if (!groups[ch]) continue;
    if (m.delivery_status === "delivered" || m.status === "delivered") groups[ch].delivered++;
    else if (FAIL_STATUSES.has(m.status) || m.delivery_status === "failed") groups[ch].failed++;
    else if (SUCCESS_STATUSES.has(m.status)) groups[ch].sent++;
  }
  return groups;
}

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
  const channelSummary = summarizeByChannel(messages);

  return (
    <TooltipProvider>
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
          <CardHeader><CardTitle>Channel-wise Delivery</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(["whatsapp", "sms", "email"] as const).map((ch) => {
                const meta = channelMeta[ch];
                const stats = channelSummary[ch];
                const ChIcon = meta.Icon;
                return (
                  <div key={ch} className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`p-1.5 rounded ${meta.bgClass}`}><ChIcon className={`h-4 w-4 ${meta.iconClass}`} /></div>
                      <span className="font-medium text-sm">{meta.label}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><p className="text-xs text-muted-foreground">Sent</p><p className="text-lg font-semibold">{stats.sent}</p></div>
                      <div><p className="text-xs text-muted-foreground">Delivered</p><p className="text-lg font-semibold text-green-600">{stats.delivered}</p></div>
                      <div><p className="text-xs text-muted-foreground">Failed</p><p className="text-lg font-semibold text-destructive">{stats.failed}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Messages</CardTitle></CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No messages sent yet</TableCell></TableRow>
              ) : messages.map((m: any) => {
                const reason = m.error_message || (m.status === "scheduled_no_audience" ? "No audience matched" : "");
                return (
                  <TableRow key={m.id}>
                    <TableCell>{m.journey_contacts?.name || "—"}</TableCell>
                    <TableCell className="capitalize">{m.channel === "whatsapp_template" ? "WhatsApp" : m.channel}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{m.status}</Badge></TableCell>
                    <TableCell className="max-w-[260px]">
                      {reason ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-destructive line-clamp-1 cursor-help">{reason}</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm"><span className="text-xs">{reason}</span></TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(m.sent_at), "MMM d, HH:mm")}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </TooltipProvider>
  );
}
