import { useParams, useNavigate } from "react-router-dom";
import { lazy, Suspense, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Send, Eye, MousePointer, Target, Mail, MessageSquare, Link2, CheckCircle2, XCircle, BookOpen, TrendingUp, TrendingDown, Users, DollarSign, AlertTriangle, Lightbulb, Sparkles, Download, FileText, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppIcon } from "@/components/communication/WhatsAppIcon";
import { format } from "date-fns";
import { useJourneyAnalytics } from "@/hooks/useJourneyAnalytics";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, Legend, CartesianGrid } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const JourneyCostAnalytics = lazy(() => import("@/components/journey/JourneyCostAnalytics"));
const JourneyEngagementSummary = lazy(() => import("@/components/journey/JourneyEngagementSummary"));
const RateLimitedRetrySection = lazy(() => import("@/components/journey/RateLimitedRetrySection"));
const JourneyLogsDialog = lazy(() => import("@/components/journey/JourneyLogsDialog"));

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
  const queryClient = useQueryClient();
  const [toggling, setToggling] = useState(false);
  const [rangeKey, setRangeKey] = useState<"7d" | "30d" | "all">("30d");
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const range = useMemo(() => {
    const now = new Date();
    if (rangeKey === "all") return undefined;
    const days = rangeKey === "7d" ? 7 : 30;
    const from = new Date(now);
    from.setDate(from.getDate() - days);
    return { from, to: now };
  }, [rangeKey]);
  const ja = useJourneyAnalytics(useParams<{ id: string }>().id || "", range);

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

  const handleToggleSending = async () => {
    if (!id) return;
    const action = isActive ? "pause" : "resume";
    setToggling(true);
    try {
      const { data, error } = await supabase.functions.invoke("journey-actions", {
        body: { action, journey_id: id },
      });
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error);
      if (isActive) {
        toast.success("Sending stopped", {
          description: "No new messages will be sent. In-flight Twilio requests may still land.",
        });
      } else {
        toast.success("Sending resumed", {
          description: "Picking up from where it left off — queued contacts will continue.",
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["journey", id] });
      await queryClient.invalidateQueries({ queryKey: ["journey-enrollments", id] });
    } catch (e: any) {
      toast.error("Failed to update journey", { description: e?.message || String(e) });
    } finally {
      setToggling(false);
    }
  };

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

  // Live read count, sourced from journey_message_log.status='read'
  // (canonical field updated by the Twilio status webhook).
  const { data: readCount = 0 } = useQuery({
    queryKey: ["journey-read-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("journey_message_log")
        .select("id", { count: "exact", head: true })
        .eq("journey_id", id!)
        .eq("status", "read");
      if (error) throw error;
      return count || 0;
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

  // Live progress — sourced from the same unified analytics hook used by the
  // Journey Funnel and KPI cards, so counts always reconcile across sections.
  const totalEnrolled = ja.kpis.entered || 0;
  const sentCount = (ja.kpis as any).uniqueDelivered || 0;
  const failedCount = (ja.kpis as any).uniqueFailed || 0;
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/communication/journeys/${id}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {journey?.name || "Journey"} — Analytics
                {journey?.status === "active" && <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>}
              </h1>
              <p className="text-sm text-muted-foreground">
                {journey?.created_at && <>Created {format(new Date(journey.created_at), "dd MMM yyyy")} · </>}
                Audience {ja.kpis.entered.toLocaleString("en-IN")} · Channel WhatsApp
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as any)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setLogsOpen(true)}>
              <FileText className="h-4 w-4 mr-1" /> View Logs
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => window.print()}>Print / Save as PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const rows = [["Metric", "Value"],
                    ["Entered", ja.kpis.entered], ["Delivered", ja.kpis.delivered], ["Read", ja.kpis.read],
                    ["Clicked", ja.kpis.clicked], ["Replied", ja.kpis.replies], ["Orders", ja.kpis.ordersCount],
                    ["Revenue", ja.kpis.revenue]];
                  const csv = rows.map((r) => r.join(",")).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                  a.download = `journey-${id}-analytics.csv`; a.click();
                }}>Download CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(window.location.href)}>Copy shareable link</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/communication/journeys/${id}/conversations`)}
            >
              <WhatsAppIcon className="h-4 w-4 mr-1 text-green-600" /> View WhatsApp Conversations
            </Button>
          </div>
        </div>

        {/* SECTION 1 — Executive KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <KpiTile label="Entered Journey" value={ja.kpis.entered.toLocaleString("en-IN")} icon={<Users className="h-4 w-4" />} />
          <KpiTile label="Active" value={ja.kpis.active.toLocaleString("en-IN")} />
          <KpiTile label="Completed" value={ja.kpis.completed.toLocaleString("en-IN")} />
          <KpiTile label="Delivery Rate" value={`${ja.kpis.deliveryRate.toFixed(1)}%`} accent="text-green-600" icon={<Send className="h-4 w-4" />} />
          <KpiTile label="Read Rate" value={`${ja.kpis.readRate.toFixed(1)}%`} accent="text-blue-600" icon={<BookOpen className="h-4 w-4" />} />
          <KpiTile label="Click Rate" value={`${ja.kpis.clickRate.toFixed(1)}%`} accent="text-purple-600" icon={<MousePointer className="h-4 w-4" />} />
          <KpiTile label="Reply Rate" value={`${ja.kpis.replyRate.toFixed(1)}%`} icon={<MessageSquare className="h-4 w-4" />} />
          <KpiTile label="Conversion Rate" value={`${ja.kpis.conversionRate.toFixed(2)}%`} icon={<Target className="h-4 w-4" />} />
          <KpiTile label="Revenue Generated" value={`₹${ja.kpis.revenue.toLocaleString("en-IN")}`} accent="text-green-600" icon={<DollarSign className="h-4 w-4" />} />
          <KpiTile label="Orders Attributed" value={ja.kpis.ordersCount.toLocaleString("en-IN")} />
          <KpiTile label="Avg Order Value" value={`₹${Math.round(ja.kpis.avgOrderValue).toLocaleString("en-IN")}`} />
          <KpiTile label="Opted Out" value={ja.kpis.optedOut.toLocaleString("en-IN")} accent={ja.kpis.optedOut > 0 ? "text-destructive" : ""} />
        </div>

        {/* SECTION 2/3/4 — Funnel + Trend + Health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-base">Journey Funnel</CardTitle></CardHeader>
            <CardContent>
              <FunnelView funnel={ja.funnel} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-base">Engagement Over Time</CardTitle></CardHeader>
            <CardContent className="h-[260px]">
              {ja.trend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No activity yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ja.trend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RTooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="delivered" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="read" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="clicked" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="replied" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Journey Health Score</CardTitle></CardHeader>
            <CardContent>
              <div className="text-center mb-4">
                <div className={`text-5xl font-bold ${ja.health.score >= 70 ? "text-green-600" : ja.health.score >= 40 ? "text-amber-600" : "text-destructive"}`}>{ja.health.score}<span className="text-base text-muted-foreground">/100</span></div>
                <p className="text-xs text-muted-foreground mt-1">{ja.health.score >= 80 ? "Excellent" : ja.health.score >= 60 ? "Good" : ja.health.score >= 40 ? "Needs attention" : "At risk"}</p>
              </div>
              {ja.health.strengths.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-green-700 mb-1">Strengths</p>
                  {ja.health.strengths.map((s, i) => <p key={i} className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" />{s}</p>)}
                </div>
              )}
              {ja.health.areas.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-700 mb-1">Areas to Improve</p>
                  {ja.health.areas.map((s, i) => <p key={i} className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-600" />{s}</p>)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* SECTION 3 — Node performance + Heatmap + Segments + Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Node / Message Performance</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Node</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="text-right">Read</TableHead>
                    <TableHead className="text-right">Clicked</TableHead>
                    <TableHead className="text-right">Replied</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ja.nodePerformance.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-4 text-muted-foreground text-sm">No node activity</TableCell></TableRow>
                  ) : ja.nodePerformance.map((n) => (
                    <TableRow key={n.nodeId}>
                      <TableCell className="font-medium">{n.label}</TableCell>
                      <TableCell className="text-right">{n.sent.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">{n.delivered.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">{n.read.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">{n.clicked.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">{n.replied.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right text-destructive">{n.failed.toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /> AI Insights</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {ja.insights.length === 0 ? (
                <p className="text-xs text-muted-foreground">Insights will appear as the journey accumulates data.</p>
              ) : ja.insights.map((i, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  {i.kind === "warn" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5" /> :
                   i.kind === "success" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5" /> :
                   <Lightbulb className="h-3.5 w-3.5 text-blue-600 mt-0.5" />}
                  <span className="text-foreground">{i.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Best Time to Engage</CardTitle></CardHeader>
            <CardContent>
              <Heatmap data={ja.heat} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Audience Segments</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <SegRow label="Highly Engaged" value={ja.segments.highlyEngaged} color="bg-green-50 text-green-700" />
                <SegRow label="Warm" value={ja.segments.warm} color="bg-amber-50 text-amber-700" />
                <SegRow label="Cold" value={ja.segments.cold} color="bg-blue-50 text-blue-700" />
                <SegRow label="Lost" value={ja.segments.lost} color="bg-red-50 text-red-700" />
                <SegRow label="High Intent" value={ja.segments.highIntent} color="bg-purple-50 text-purple-700" />
                <SegRow label="High Value" value={ja.segments.highValue} color="bg-emerald-50 text-emerald-700" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SECTION 7/8 — Cohort & Attribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Revenue Attribution</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2 text-center">
                {(["d1","d7","d15","d30"] as const).map((k, i) => (
                  <div key={k} className="rounded-lg border p-2">
                    <p className="text-[10px] text-muted-foreground uppercase">{["1 day","7 days","15 days","30 days"][i]}</p>
                    <p className="text-sm font-semibold">₹{(ja.attribution[k] as number).toLocaleString("en-IN")}</p>
                    <p className="text-[10px] text-muted-foreground">{ja.attribution[`${k}Count` as const] as number} orders</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>AOV: <span className="text-foreground font-medium">₹{Math.round(ja.kpis.avgOrderValue).toLocaleString("en-IN")}</span></div>
                <div>Revenue / Customer: <span className="text-foreground font-medium">₹{Math.round(ja.kpis.revenuePerCustomer).toLocaleString("en-IN")}</span></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Cohort Analysis (Retention)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cohort (Week of)</TableHead>
                    <TableHead className="text-right">Entered</TableHead>
                    <TableHead className="text-right">Day 1 Read %</TableHead>
                    <TableHead className="text-right">Day 7 Read %</TableHead>
                    <TableHead className="text-right">Day 30 Conv %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ja.cohorts.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground text-sm">No cohort data yet</TableCell></TableRow>
                  ) : ja.cohorts.map((c) => (
                    <TableRow key={c.week}>
                      <TableCell>{format(new Date(c.week), "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-right">{c.entered}</TableCell>
                      <TableCell className="text-right">{c.d1ReadPct.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{c.d7ReadPct.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{c.d30ConvPct.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Read</p>
                  <p className="text-2xl font-bold text-blue-600">{readCount.toLocaleString("en-IN")}</p>
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

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                <div className="p-2 rounded-lg bg-indigo-100"><BookOpen className="h-5 w-5 text-indigo-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Read</p>
                  <p className="text-2xl font-bold">{readCount}</p>
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
                <TableHead>Read Status</TableHead>
                {hasTrackedTemplate && <TableHead>Link Status</TableHead>}
                <TableHead>Reason</TableHead>
                <TableHead>Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.length === 0 ? (
                <TableRow><TableCell colSpan={hasTrackedTemplate ? 7 : 6} className="text-center py-8 text-muted-foreground">No messages sent yet</TableCell></TableRow>
              ) : (showAllMessages ? messages : messages.slice(0, 5)).map((m: any) => {
                const reason = m.error_message || (m.status === "scheduled_no_audience" ? "No audience matched" : "");
                const isTracked = m.whatsapp_templates?.twilio_content_sid === TRACKED_TEMPLATE_SID
                  || (journeyUsesTrackedTemplate && (m.channel === "whatsapp_template" || m.channel === "whatsapp"));
                const phoneL10 = last10(m.journey_contacts?.phone);
                const wasClicked = isTracked && phoneL10 && clickedPhonesLast10.has(phoneL10);
                const isWa = m.channel === "whatsapp" || m.channel === "whatsapp_template";
                const st = String(m.status || "").toLowerCase();
                const ds = String(m.delivery_status || "").toLowerCase();
                let readBadge: JSX.Element;
                if (!isWa) {
                  readBadge = <span className="text-xs text-muted-foreground">—</span>;
                } else if (st === "read") {
                  readBadge = (
                    <Badge variant="outline" className="border-blue-600 text-blue-700 bg-blue-50">
                      <BookOpen className="h-3 w-3 mr-1" />
                      Read
                    </Badge>
                  );
                } else if (st === "failed" || st === "undelivered" || ds === "failed") {
                  readBadge = (
                    <Badge variant="outline" className="border-destructive text-destructive bg-destructive/5">
                      Failed
                    </Badge>
                  );
                } else if (st === "delivered" || ds === "delivered") {
                  readBadge = (
                    <Badge variant="outline" className="text-muted-foreground">Not Read</Badge>
                  );
                } else {
                  readBadge = (
                    <Badge variant="outline" className="text-muted-foreground">Pending</Badge>
                  );
                }
                return (
                  <TableRow key={m.id}>
                    <TableCell>{m.journey_contacts?.name || "—"}</TableCell>
                    <TableCell className="capitalize">{m.channel === "whatsapp_template" ? "WhatsApp" : m.channel}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{m.status}</Badge></TableCell>
                    <TableCell>{readBadge}</TableCell>
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
          {messages.length > 5 && (
            <div className="p-3 border-t text-center">
              <Button variant="ghost" size="sm" onClick={() => setShowAllMessages((v) => !v)}>
                {showAllMessages ? "Show less" : `Show more (${messages.length - 5} more)`}
              </Button>
            </div>
          )}
        </Card>

        {id && (
          <Suspense fallback={<Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Loading cost analytics…</CardContent></Card>}>
            <JourneyCostAnalytics journeyId={id} />
          </Suspense>
        )}

        {id && (
          <Suspense fallback={<Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Loading rate-limited failures…</CardContent></Card>}>
            <RateLimitedRetrySection journeyId={id} />
          </Suspense>
        )}

        {id && (
          <Suspense fallback={<Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Loading engagement…</CardContent></Card>}>
            <JourneyEngagementSummary journeyId={id} isActive={isActive} />
          </Suspense>
        )}
      </div>
      {id && (
        <Suspense fallback={null}>
          <JourneyLogsDialog open={logsOpen} onOpenChange={setLogsOpen} journeyId={id} journeyName={journey?.name} />
        </Suspense>
      )}
    </TooltipProvider>
  );
}

function KpiTile({ label, value, accent, icon }: { label: string; value: string; accent?: string; icon?: JSX.Element }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
        <p className={`text-xl font-bold whitespace-nowrap ${accent || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function FunnelView({ funnel }: { funnel: { label: string; count: number }[] }) {
  const max = Math.max(...funnel.map((f) => f.count), 1);
  const colors = ["#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#f97316", "#ef4444"];
  const first = funnel[0]?.count || 0;
  return (
    <div className="space-y-1.5">
      {funnel.map((f, i) => {
        const pct = (f.count / max) * 100;
        const conv = first ? (f.count / first) * 100 : 0;
        return (
          <div key={f.label} className="flex items-center gap-2 text-xs">
            <span className="w-24 text-muted-foreground">{f.label}</span>
            <div className="flex-1 h-7 bg-muted rounded relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${pct}%`, background: colors[i % colors.length], opacity: 0.85 }} />
              <span className="absolute inset-0 flex items-center justify-end pr-2 text-[11px] font-medium text-foreground">{f.count.toLocaleString("en-IN")}</span>
            </div>
            <span className="w-12 text-right text-muted-foreground">{conv.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function Heatmap({ data }: { data: number[][] }) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const max = Math.max(...data.flat(), 1);
  return (
    <div className="overflow-x-auto">
      <table className="text-[10px]">
        <thead>
          <tr>
            <th></th>
            {Array.from({ length: 24 }, (_, h) => <th key={h} className="px-0.5 text-muted-foreground font-normal">{h % 4 === 0 ? `${h}h` : ""}</th>)}
          </tr>
        </thead>
        <tbody>
          {days.map((d, di) => (
            <tr key={d}>
              <td className="pr-1 text-muted-foreground">{d}</td>
              {data[di].map((v, hi) => {
                const op = v / max;
                return <td key={hi} className="p-0"><div className="w-3 h-3 rounded-sm" style={{ background: `hsl(217 91% 60% / ${0.08 + op * 0.92})` }} title={`${d} ${hi}:00 — ${v} reads`} /></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SegRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg p-3 ${color}`}>
      <p className="text-[11px] uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold">{value.toLocaleString("en-IN")}</p>
    </div>
  );
}
