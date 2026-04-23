import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Mail, MessageSquare, Phone, Users, Clock, ExternalLink } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/communication/WhatsAppIcon";

const IST_OFFSET_MIN = 330;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function istParts(d: Date) {
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return {
    year: ist.getUTCFullYear(),
    month0: ist.getUTCMonth(),
    day: ist.getUTCDate(),
    hour: ist.getUTCHours(),
    minute: ist.getUTCMinutes(),
  };
}
function pad(n: number) { return String(n).padStart(2, "0"); }
function format12hIst(d: Date) {
  const p = istParts(d);
  const period = p.hour >= 12 ? "PM" : "AM";
  const hh = ((p.hour + 11) % 12) + 1;
  return `${hh}:${pad(p.minute)} ${period}`;
}
function formatFullIst(d: Date) {
  const p = istParts(d);
  return `${p.day} ${MONTH_NAMES[p.month0].slice(0, 3)} ${p.year}, ${format12hIst(d)} IST`;
}

const CHANNEL_STYLES: Record<string, { chip: string; icon: any; label: string }> = {
  whatsapp: { chip: "bg-green-100 text-green-800", icon: MessageSquare, label: "WhatsApp" },
  email: { chip: "bg-blue-100 text-blue-800", icon: Mail, label: "Email" },
  sms: { chip: "bg-amber-100 text-amber-800", icon: Phone, label: "SMS" },
  voice: { chip: "bg-purple-100 text-purple-800", icon: Phone, label: "Voice" },
};

function getJourneyMediaUrl(canvas_data: any): string | null {
  const nodes: any[] = Array.isArray(canvas_data?.nodes) ? canvas_data.nodes : [];
  for (const n of nodes) {
    if (n.type !== "message" && n.data?.type !== "message") continue;
    const d = n.data || {};
    const url = d.media_url || d.mediaUrl || d.twilio_media_url || d.image_url || d.imageUrl;
    if (url && typeof url === "string") return url;
  }
  return null;
}

export interface DayEvent {
  id: string;
  journey_id: string;
  journey_name: string;
  channel: string;
  start: Date;
  canvas_data?: any;
  is_ready: boolean;
}

const READINESS_STYLE = {
  ready: { bg: "#DCFCE7", border: "#22C55E" },
  attention: { bg: "#FEF9C3", border: "#EAB308" },
} as const;

interface Props {
  dayKey: string;
  events: DayEvent[];
}

type StatusBucket = "completed" | "pending" | "failed" | "none";

function deriveStatus(status?: string | null, delivery?: string | null): StatusBucket {
  const v = (delivery || status || "").toLowerCase();
  if (!v) return "none";
  if (["delivered", "read"].includes(v)) return "completed";
  if (["queued", "pending_delivery", "sent", "pending", "accepted"].includes(v)) return "pending";
  if (["failed", "undelivered"].includes(v)) return "failed";
  return "pending";
}

const STATUS_STYLE: Record<StatusBucket, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-green-100 text-green-800 border-green-200" },
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  failed: { label: "Failed", cls: "bg-red-100 text-red-800 border-red-200" },
  none: { label: "Not yet run", cls: "bg-muted text-muted-foreground border-border" },
};

export function CalendarDayDetails({ dayKey, events }: Props) {
  const navigate = useNavigate();

  // Unique journeys for the day (one card per journey, even if multiple events)
  const journeys = useMemo(() => {
    const map = new Map<string, { id: string; name: string; canvas_data: any; channels: Set<string>; times: Date[] }>();
    events.forEach((e) => {
      const existing = map.get(e.journey_id);
      if (existing) {
        existing.channels.add(e.channel);
        existing.times.push(e.start);
      } else {
        map.set(e.journey_id, {
          id: e.journey_id,
          name: e.journey_name,
          canvas_data: e.canvas_data,
          channels: new Set([e.channel]),
          times: [e.start],
        });
      }
    });
    return Array.from(map.values()).map((j) => ({
      ...j,
      times: j.times.sort((a, b) => a.getTime() - b.getTime()),
    }));
  }, [events]);

  const journeyIds = useMemo(() => journeys.map((j) => j.id).sort(), [journeys]);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar-day-details", dayKey, journeyIds],
    enabled: journeyIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [logsRes, enrollRes] = await Promise.all([
        supabase
          .from("journey_message_log")
          .select("journey_id, sent_at, status, delivery_status")
          .in("journey_id", journeyIds)
          .order("sent_at", { ascending: false }),
        supabase
          .from("journey_enrollments")
          .select("journey_id")
          .in("journey_id", journeyIds),
      ]);
      if (logsRes.error) throw logsRes.error;
      if (enrollRes.error) throw enrollRes.error;

      const latestByJourney = new Map<string, { sent_at: string | null; status: string | null; delivery_status: string | null }>();
      (logsRes.data || []).forEach((row: any) => {
        if (!latestByJourney.has(row.journey_id)) {
          latestByJourney.set(row.journey_id, {
            sent_at: row.sent_at,
            status: row.status,
            delivery_status: row.delivery_status,
          });
        }
      });
      const counts = new Map<string, number>();
      (enrollRes.data || []).forEach((row: any) => {
        counts.set(row.journey_id, (counts.get(row.journey_id) || 0) + 1);
      });
      return { latestByJourney, counts };
    },
  });

  if (journeys.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground text-center">
        No journeys scheduled for this date.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">
          <span className="tabular-nums">{journeys.length}</span>
          <span className="mx-1.5" />
          {journeys.length === 1 ? "Journey" : "Journeys"} Scheduled
        </h3>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {journeys.map((j) => {
          const log = data?.latestByJourney.get(j.id);
          const audienceCount = data?.counts.get(j.id) ?? 0;
          const statusBucket = deriveStatus(log?.status, log?.delivery_status);
          const statusStyle = STATUS_STYLE[statusBucket];
          const mediaUrl = getJourneyMediaUrl(j.canvas_data);
          const channels = Array.from(j.channels);

          return (
            <Card key={j.id} className="overflow-hidden">
              <CardContent className="p-3 sm:p-4">
                <div className="flex gap-3">
                  {mediaUrl && (
                    <img
                      src={mediaUrl}
                      alt={j.name}
                      className="h-16 w-16 sm:h-24 sm:w-24 rounded-md object-cover border shrink-0 bg-muted"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => navigate(`/communication/journeys/${j.id}`)}
                        className="text-sm font-semibold text-left hover:underline flex items-center gap-1 min-w-0"
                      >
                        <span className="truncate">{j.name}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {channels.map((ch) => {
                        const lc = (ch || "").toLowerCase();
                        const isWhatsApp = lc === "whatsapp" || lc === "whatsapp_template";
                        const styleKey = isWhatsApp ? "whatsapp" : lc;
                        const cs = CHANNEL_STYLES[styleKey] || CHANNEL_STYLES.whatsapp;
                        const Icon = cs.icon;
                        return (
                          <Badge key={ch} variant="outline" className={cn("gap-1 font-medium border-transparent", cs.chip)}>
                            {isWhatsApp ? (
                              <WhatsAppIcon className="h-3.5 w-3.5" />
                            ) : (
                              <Icon className="h-3 w-3" />
                            )}
                            {cs.label}
                          </Badge>
                        );
                      })}
                      <Badge variant="outline" className={cn("font-medium", statusStyle.cls)}>
                        {statusStyle.label}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          Scheduled: {j.times.map((t) => format12hIst(t)).join(", ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        {isLoading ? (
                          <Skeleton className="h-3 w-16" />
                        ) : (
                          <span>{audienceCount} {audienceCount === 1 ? "contact" : "contacts"}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 sm:col-span-2">
                        <span className="font-medium text-foreground/70">Last run:</span>
                        {isLoading ? (
                          <Skeleton className="h-3 w-32" />
                        ) : log?.sent_at ? (
                          <span>{formatFullIst(new Date(log.sent_at))}</span>
                        ) : (
                          <span className="italic">Never</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
