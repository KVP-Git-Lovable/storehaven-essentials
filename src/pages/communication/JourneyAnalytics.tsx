import { useParams, useNavigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Send, Eye, MousePointer, Target, Mail, MessageSquare, Link2, CheckCircle2, XCircle } from "lucide-react";
import { WhatsAppIcon } from "@/components/communication/WhatsAppIcon";
import { format } from "date-fns";

const JourneyCostAnalytics = lazy(() => import("@/components/journey/JourneyCostAnalytics"));

const SUCCESS_STATUSES = new Set(["sent", "delivered", "queued", "accepted", "scheduled", "sending"]);
const FAIL_STATUSES = new Set(["failed", "undelivered"]);

// Template SID we track link clicks for (per spec).
const TRACKED_TEMPLATE_SID = "HX2a54377b41a3c48d5ae8984a4e900e56";

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

// Normalize phone to last-10-digits for match-by-suffix comparisons.
function last10(raw: string | null | undefined): string {
  return String(raw || "").replace(/\D/g, "").slice(-10);
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

  const isActive = journey?.status === "active";

  const { data: messages = [] } = useQuery({
    queryKey: ["journey-messages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journey_message_log")
        .select("*, journey_contacts(name, email, phone), whatsapp_templates:template_id(twilio_content_sid)")
        .eq("journey_id", id!)
        .order("sent_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    refetchInterval: isActive ? 5000 : false,
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
    refetchInterval: isActive ? 5000 : false,
  });

  // Pull link clicks for the tracked template, scoped to clicks attributed to this journey.
  const { data: linkClicks = [] } = useQuery({
    queryKey: ["journey-link-clicks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_link_clicks")
        .select("phone_number, clicked_at, journey_id")
        .eq("template_sid", TRACKED_TEMPLATE_SID)
        .eq("journey_id", id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const totalSent = messages.length;
  const opened = messages.filter((m: any) => m.status === "opened").length;
  const clicked = messages.filter((m: any) => m.status === "clicked").length;
  const completed = enrollments?.filter((e: any) => e.status === "completed").length || 0;
  const channelSummary = summarizeByChannel(messages);

  // Live progress (refreshes every 5s while journey is active)
  const totalEnrolled = enrollments?.length || 0;
  const sentCount = messages.filter((m: any) =>
    SUCCESS_STATUSES.has(m.status) || m.delivery_status === "delivered" || m.status === "delivered",
  ).length;
  const failedCount = messages.filter((m: any) =>
    FAIL_STATUSES.has(m.status) || m.delivery_status === "failed",
  ).length;
  const pendingCount = Math.max(0, totalEnrolled - sentCount - failedCount);
  const progressPct = totalEnrolled > 0 ? Math.round(((sentCount + failedCount) / totalEnrolled) * 100) : 0;

  // Detect whether this journey uses the tracked template — check both:
  // (a) message log rows that have template_id populated (new sends), and
  // (b) the journey's canvas_data message nodes (covers historical sends where template_id is NULL).
  const journeyUsesTrackedTemplate = (() => {
    const nodes = (journey?.canvas_data as any)?.nodes || [];
    return nodes.some((n: any) => {
      if (n?.type !== "message") return false;
      const tmplId = n?.data?.whatsapp_template_id;
      // We compare via template_id resolved against the messages join below, plus a body URL hint.
      const body = typeof n?.data?.template_body === "string"
        ? n.data.template_body
        : JSON.stringify(n?.data?.template_body || "");
      return body.includes("trayijewellers.in") || tmplId === "0ff21b07-ff6b-4d20-90b6-b089082b9f51";
    });
  })();
  const trackedMessages = messages.filter((m: any) => {
    // Prefer explicit template_id match when present
    if (m.whatsapp_templates?.twilio_content_sid === TRACKED_TEMPLATE_SID) return true;
    // Fallback: if journey uses the tracked template and the message is a whatsapp template send, treat as tracked
    return journeyUsesTrackedTemplate && (m.channel === "whatsapp_template" || m.channel === "whatsapp");
  });
  const hasTrackedTemplate = journeyUsesTrackedTemplate || trackedMessages.length > 0;

  // Build a Set of last10 phone digits that clicked (deduped per user).
  const clickedPhonesLast10 = new Set(linkClicks.map((c: any) => last10(c.phone_number)));

  // Recipients = unique contact phones to whom the tracked template was sent.
  const trackedRecipients = new Set(
    trackedMessages
      .map((m: any) => last10(m.journey_contacts?.phone))
      .filter(Boolean)
  );
  const uniqueClickers = Array.from(clickedPhonesLast10).filter((p) => trackedRecipients.has(p)).length;
  const clickRate = trackedRecipients.size > 0 ? (uniqueClickers / trackedRecipients.size) * 100 : 0;

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

        {totalEnrolled > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Live Send Progress</span>
                {isActive && (
                  <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    Live · refreshes every 5s
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total Enrolled</p>
                  <p className="text-2xl font-bold">{totalEnrolled.toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Sent</p>
                  <p className="text-2xl font-bold text-green-600">{sentCount.toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-amber-600">{pendingCount.toLocaleString("en-IN")}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-destructive">{failedCount.toLocaleString("en-IN")}</p>
                </div>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">{progressPct}% processed</p>
            </CardContent>
          </Card>
        )}

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

        {hasTrackedTemplate && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Link Engagement (Tracked Template)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Template Messages Sent</p>
                  <p className="text-2xl font-bold">{trackedMessages.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {trackedRecipients.size} unique recipient{trackedRecipients.size === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Unique Users Clicked</p>
                  <p className="text-2xl font-bold text-green-600">{uniqueClickers}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Click Rate</p>
                  <p className="text-2xl font-bold">{clickRate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                {hasTrackedTemplate && <TableHead>Link Status</TableHead>}
                <TableHead>Reason</TableHead>
                <TableHead>Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.length === 0 ? (
                <TableRow><TableCell colSpan={hasTrackedTemplate ? 6 : 5} className="text-center py-8 text-muted-foreground">No messages sent yet</TableCell></TableRow>
              ) : messages.map((m: any) => {
                const reason = m.error_message || (m.status === "scheduled_no_audience" ? "No audience matched" : "");
                const isTracked = m.whatsapp_templates?.twilio_content_sid === TRACKED_TEMPLATE_SID
                  || (journeyUsesTrackedTemplate && (m.channel === "whatsapp_template" || m.channel === "whatsapp"));
                const phoneL10 = last10(m.journey_contacts?.phone);
                const wasClicked = isTracked && phoneL10 && clickedPhonesLast10.has(phoneL10);
                return (
                  <TableRow key={m.id}>
                    <TableCell>{m.journey_contacts?.name || "—"}</TableCell>
                    <TableCell className="capitalize">{m.channel === "whatsapp_template" ? "WhatsApp" : m.channel}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{m.status}</Badge></TableCell>
                    {hasTrackedTemplate && (
                      <TableCell>
                        {isTracked ? (
                          wasClicked ? (
                            <Badge variant="outline" className="border-green-600 text-green-700 bg-green-50">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Link clicked
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <XCircle className="h-3 w-3 mr-1" />
                              Not clicked
                            </Badge>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
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

        {id && (
          <Suspense fallback={<Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Loading cost analytics…</CardContent></Card>}>
            <JourneyCostAnalytics journeyId={id} />
          </Suspense>
        )}
      </div>
    </TooltipProvider>
  );
}
