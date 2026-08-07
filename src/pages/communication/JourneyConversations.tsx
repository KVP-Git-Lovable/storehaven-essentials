import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { BackButton } from "@/components/shared/BackButton";
import { ArrowLeft, Search, BarChart3 } from "lucide-react";

type WAMessage = {
  id: string;
  phone: string;
  direction: "inbound" | "outbound";
  message: string | null;
  message_type: string;
  status: string;
  is_read: boolean;
  profile_name: string | null;
  created_at: string;
};

type Enrollment = {
  id: string;
  contact_id: string;
  current_node_id: string | null;
  status: string;
  enrolled_at: string;
};

type Contact = {
  id: string;
  name: string | null;
  phone: string | null;
  opted_out: boolean | null;
};

type Participant = {
  enrollment: Enrollment;
  contact: Contact;
  phoneL10: string;
  lastMessage: string;
  lastAt: string | null;
  unreadCount: number;
  hasReply: boolean;
  hasRead: boolean;
};

const last10 = (raw: string | null | undefined) =>
  String(raw || "").replace(/\D/g, "").slice(-10);

const initials = (s: string) =>
  s.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

const formatBubbleTime = (iso: string) => format(new Date(iso), "h:mm a");
const formatDayLabel = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d, yyyy");
};

type FilterKey =
  | "all"
  | "replied"
  | "not_replied"
  | "active"
  | "completed"
  | "opted_out"
  | "read"
  | "unread";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "replied", label: "Replied" },
  { key: "not_replied", label: "Not Replied" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "opted_out", label: "Opted Out" },
  { key: "read", label: "Read" },
  { key: "unread", label: "Unread" },
];

export default function JourneyConversations() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [showListMobile, setShowListMobile] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Journey meta
  const { data: journey } = useQuery({
    queryKey: ["journey", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journeys")
        .select("id, name, status")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Enrollments for this journey
  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: ["journey-conv-enrollments", id],
    enabled: !!id,
    queryFn: async () => {
      const PAGE = 1000;
      const out: Enrollment[] = [];
      for (let i = 0; i < 200; i++) {
        const from = i * PAGE;
        const to = from + PAGE - 1;
        const { data, error } = await supabase
          .from("journey_enrollments")
          .select("id, contact_id, current_node_id, status, enrolled_at")
          .eq("journey_id", id!)
          .order("enrolled_at", { ascending: false })
          .range(from, to);
        if (error) throw error;
        const rows = (data || []) as Enrollment[];
        out.push(...rows);
        if (rows.length < PAGE) break;
      }
      return out;
    },
  });

  const contactIds = useMemo(
    () => Array.from(new Set(enrollments.map((e) => e.contact_id).filter(Boolean))),
    [enrollments]
  );

  // Dedupe enrollments by contact_id (keep most recent — list is already ordered desc by enrolled_at)
  const uniqueEnrollments = useMemo(() => {
    const seen = new Set<string>();
    const out: Enrollment[] = [];
    for (const e of enrollments) {
      if (!e.contact_id || seen.has(e.contact_id)) continue;
      seen.add(e.contact_id);
      out.push(e);
    }
    return out;
  }, [enrollments]);

  const { data: contacts = [] } = useQuery({
    queryKey: ["journey-conv-contacts", contactIds.sort().join(",")],
    enabled: contactIds.length > 0,
    queryFn: async () => {
      // Batch the .in() to avoid URL-length issues and PostgREST row caps
      const CHUNK = 200;
      const out: Contact[] = [];
      for (let i = 0; i < contactIds.length; i += CHUNK) {
        const slice = contactIds.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("journey_contacts")
          .select("id, name, phone, opted_out")
          .in("id", slice);
        if (error) throw error;
        out.push(...((data || []) as Contact[]));
      }
      return out;
    },
  });

  const contactMap = useMemo(() => {
    const m = new Map<string, Contact>();
    contacts.forEach((c) => m.set(c.id, c));
    return m;
  }, [contacts]);

  // Earliest journey send per contact — used to scope conversations to THIS journey.
  const { data: firstSendByContact = new Map<string, string>() } = useQuery({
    queryKey: ["journey-conv-first-sends", id],
    enabled: !!id,
    queryFn: async () => {
      const PAGE = 1000;
      const map = new Map<string, string>();
      for (let i = 0; i < 200; i++) {
        const from = i * PAGE;
        const to = from + PAGE - 1;
        const { data, error } = await supabase
          .from("journey_message_log")
          .select("contact_id, sent_at")
          .eq("journey_id", id!)
          .order("sent_at", { ascending: true })
          .range(from, to);
        if (error) throw error;
        const rows = (data || []) as { contact_id: string; sent_at: string }[];
        rows.forEach((r) => {
          if (!r.contact_id || !r.sent_at) return;
          const prev = map.get(r.contact_id);
          if (!prev || new Date(r.sent_at).getTime() < new Date(prev).getTime()) {
            map.set(r.contact_id, r.sent_at);
          }
        });
        if (rows.length < PAGE) break;
      }
      return map;
    },
  });

  // phoneL10 -> ISO cutoff. Messages before this belong to earlier journeys.
  const cutoffByPhone = useMemo(() => {
    const m = new Map<string, string>();
    uniqueEnrollments.forEach((e) => {
      const c = contactMap.get(e.contact_id);
      const p = last10(c?.phone);
      if (!p) return;
      const cutoff = firstSendByContact.get(e.contact_id) || e.enrolled_at;
      if (!cutoff) return;
      const prev = m.get(p);
      if (!prev || new Date(cutoff).getTime() < new Date(prev).getTime()) m.set(p, cutoff);
    });
    return m;
  }, [uniqueEnrollments, contactMap, firstSendByContact]);

  // Phones for this journey, last-10
  const phoneL10List = useMemo(() => {
    const set = new Set<string>();
    uniqueEnrollments.forEach((e) => {
      const c = contactMap.get(e.contact_id);
      const p = last10(c?.phone);
      if (p) set.add(p);
    });
    return Array.from(set);
  }, [uniqueEnrollments, contactMap]);

  // Build all known phone format variants for these participants so we can match
  // whatsapp_messages.phone regardless of how it was stored (+91xxxx, 91xxxx, xxxx).
  const phoneVariants = useMemo(() => {
    const set = new Set<string>();
    phoneL10List.forEach((p) => {
      set.add(p);
      set.add(`91${p}`);
      set.add(`+91${p}`);
    });
    return Array.from(set);
  }, [phoneL10List]);

  // Pull all whatsapp messages whose phone matches any participant.
  // Batch the `.in()` over phone variants and paginate per batch to bypass the
  // 1000-row cap so older inbound replies are still detected.
  const { data: recentMessages = [] } = useQuery({
    queryKey: ["journey-conv-recent-msgs", id, phoneVariants.sort().join(",")],
    enabled: phoneVariants.length > 0,
    queryFn: async () => {
      const out: WAMessage[] = [];
      const PHONE_CHUNK = 150;
      const PAGE = 1000;
      for (let i = 0; i < phoneVariants.length; i += PHONE_CHUNK) {
        const slice = phoneVariants.slice(i, i + PHONE_CHUNK);
        for (let p = 0; p < 200; p++) {
          const from = p * PAGE;
          const to = from + PAGE - 1;
          const { data, error } = await supabase
            .from("whatsapp_messages")
            .select("id, phone, direction, message, message_type, status, is_read, profile_name, created_at")
            .in("phone", slice)
            .order("created_at", { ascending: false })
            .range(from, to);
          if (error) throw error;
          const rows = (data || []) as WAMessage[];
          out.push(...rows);
          if (rows.length < PAGE) break;
        }
      }
      return out;
    },
  });

  // Build per-phone aggregates from recent messages
  const phoneStats = useMemo(() => {
    const map = new Map<
      string,
      { lastMessage: string; lastAt: string | null; unreadCount: number; hasReply: boolean; hasRead: boolean; canonicalPhone: string }
    >();
    recentMessages.forEach((m) => {
      const p = last10(m.phone);
      if (!p) return;
      // Ignore messages exchanged before this journey started for this participant.
      const cutoff = cutoffByPhone.get(p);
      if (cutoff && new Date(m.created_at).getTime() < new Date(cutoff).getTime()) return;
      let s = map.get(p);
      if (!s) {
        s = {
          lastMessage: m.message ?? "",
          lastAt: m.created_at,
          unreadCount: !m.is_read && m.direction === "inbound" ? 1 : 0,
          hasReply: m.direction === "inbound",
          hasRead: m.status === "read",
          canonicalPhone: m.phone,
        };
        map.set(p, s);
      } else {
        if (m.direction === "inbound") s.hasReply = true;
        if (m.status === "read") s.hasRead = true;
        if (!m.is_read && m.direction === "inbound") s.unreadCount += 1;
      }
    });
    return map;
  }, [recentMessages, cutoffByPhone]);

  const participants: Participant[] = useMemo(() => {
    const list: Participant[] = uniqueEnrollments
      .map((e) => {
        const contact = contactMap.get(e.contact_id);
        if (!contact) return null;
        const phoneL10 = last10(contact.phone);
        const stats = phoneStats.get(phoneL10);
        return {
          enrollment: e,
          contact,
          phoneL10,
          lastMessage: stats?.lastMessage ?? "",
          lastAt: stats?.lastAt ?? null,
          unreadCount: stats?.unreadCount ?? 0,
          hasReply: stats?.hasReply ?? false,
          hasRead: stats?.hasRead ?? false,
        } as Participant;
      })
      .filter(Boolean) as Participant[];
    // sort by last activity, then enrollment date
    list.sort((a, b) => {
      const at = a.lastAt ? new Date(a.lastAt).getTime() : 0;
      const bt = b.lastAt ? new Date(b.lastAt).getTime() : 0;
      if (at !== bt) return bt - at;
      return new Date(b.enrollment.enrolled_at).getTime() - new Date(a.enrollment.enrolled_at).getTime();
    });
    return list;
  }, [uniqueEnrollments, contactMap, phoneStats]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return participants.filter((p) => {
      if (q) {
        const hay = `${p.contact.name ?? ""} ${p.contact.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      switch (filter) {
        case "replied": return p.hasReply;
        case "not_replied": return !p.hasReply;
        case "active": return p.enrollment.status === "active";
        case "completed": return p.enrollment.status === "completed";
        case "opted_out": return !!p.contact.opted_out;
        case "read": return p.hasRead;
        case "unread": return p.unreadCount > 0;
        default: return true;
      }
    });
  }, [participants, debouncedSearch, filter]);

  // Auto-select first
  useEffect(() => {
    if (!selectedPhone && filtered.length > 0) {
      setSelectedPhone(filtered[0].phoneL10);
    }
  }, [filtered, selectedPhone]);

  const selected = useMemo(
    () => participants.find((p) => p.phoneL10 === selectedPhone) || null,
    [participants, selectedPhone]
  );

  // Thread for selected participant (match by last-10 suffix)
  const selectedCutoff = selectedPhone ? cutoffByPhone.get(selectedPhone) ?? null : null;
  const { data: thread = [], isLoading: loadingThread } = useQuery({
    queryKey: ["journey-conv-thread", selectedPhone, selectedCutoff],
    enabled: !!selectedPhone,
    queryFn: async () => {
      if (!selectedPhone) return [] as WAMessage[];
      const variants = [selectedPhone, `91${selectedPhone}`, `+91${selectedPhone}`];
      const out: WAMessage[] = [];
      const PAGE = 1000;
      for (let p = 0; p < 50; p++) {
        const from = p * PAGE;
        const to = from + PAGE - 1;
        let q = supabase
          .from("whatsapp_messages")
          .select("id, phone, direction, message, message_type, status, is_read, profile_name, created_at")
          .in("phone", variants);
        if (selectedCutoff) q = q.gte("created_at", selectedCutoff);
        const { data, error } = await q
          .order("created_at", { ascending: true })
          .range(from, to);
        if (error) throw error;
        const rows = (data || []) as WAMessage[];
        out.push(...rows);
        if (rows.length < PAGE) break;
      }
      return out;
    },
  });

  // Realtime invalidation on new inbound for this phone
  useEffect(() => {
    if (!selectedPhone) return;
    const channel = supabase
      .channel(`journey-conv-${selectedPhone}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        (payload: any) => {
          if (last10(payload.new?.phone) === selectedPhone) {
            qc.invalidateQueries({ queryKey: ["journey-conv-thread", selectedPhone] });
            qc.invalidateQueries({ queryKey: ["journey-conv-recent-msgs", id] });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedPhone, id, qc]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread]);

  const groupedThread = useMemo(() => {
    const groups: { day: string; items: WAMessage[] }[] = [];
    thread.forEach((m) => {
      const day = formatDayLabel(m.created_at);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(m);
      else groups.push({ day, items: [m] });
    });
    return groups;
  }, [thread]);

  const selectedName =
    selected?.contact.name || selected?.contact.phone || "Unknown participant";

  return (
    <div className="space-y-4">
      <BackButton />
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">
            Journey Conversations
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {journey?.name ? `${journey.name} · ` : ""}
            WhatsApp conversations for participants of this journey.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/communication/journeys/${id}/analytics`)}
        >
          <BarChart3 className="h-4 w-4 mr-1" /> Back to Analytics
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name or phone..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                variant={filter === f.key ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Three-pane layout */}
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_300px] gap-4 h-[calc(100vh-22rem)] min-h-[500px]">
        {/* LEFT: participants */}
        <Card className={`overflow-hidden flex flex-col ${!showListMobile && selectedPhone ? "hidden md:flex" : "flex"}`}>
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-sm font-medium">
              Participants {filtered.length > 0 && `(${filtered.length})`}
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            {loadingEnrollments ? (
              <div className="p-3 space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No participants match this filter.
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((p) => {
                  const name = p.contact.name || p.contact.phone || "Unknown";
                  const isActive = p.phoneL10 === selectedPhone;
                  return (
                    <button
                      key={p.enrollment.id}
                      onClick={() => {
                        setSelectedPhone(p.phoneL10);
                        setShowListMobile(false);
                      }}
                      className={`w-full text-left p-3 hover:bg-muted/60 transition-colors flex gap-3 items-start ${
                        isActive ? "bg-muted" : ""
                      }`}
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback>{initials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm truncate">{name}</div>
                          <div className="text-xs text-muted-foreground shrink-0">
                            {p.lastAt
                              ? formatDistanceToNow(new Date(p.lastAt), { addSuffix: false })
                              : "—"}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{p.contact.phone}</div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <div className="text-xs text-muted-foreground truncate">
                            {p.lastMessage || "No messages yet"}
                          </div>
                          {p.unreadCount > 0 && (
                            <Badge className="shrink-0 h-5 px-1.5">{p.unreadCount}</Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* CENTER: thread */}
        <Card className={`overflow-hidden flex flex-col ${showListMobile && selectedPhone ? "hidden md:flex" : "flex"}`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a participant to view conversation
            </div>
          ) : (
            <>
              <CardHeader className="py-3 border-b flex flex-row items-center gap-3 space-y-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8"
                  onClick={() => setShowListMobile(true)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{initials(selectedName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{selectedName}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {selected.contact.phone}
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {selected.enrollment.status}
                </Badge>
              </CardHeader>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
                {loadingThread ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-2/3" />)}
                  </div>
                ) : thread.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No WhatsApp messages found for this participant.
                  </div>
                ) : (
                  groupedThread.map((g) => (
                    <div key={g.day} className="space-y-2">
                      <div className="flex justify-center">
                        <Badge variant="secondary" className="text-xs">{g.day}</Badge>
                      </div>
                      {g.items.map((m) => {
                        const isOut = m.direction === "outbound";
                        return (
                          <div key={m.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                                isOut ? "bg-primary text-primary-foreground" : "bg-card border"
                              }`}
                            >
                              <div className="whitespace-pre-wrap break-words">{m.message}</div>
                              <div className={`flex items-center gap-2 mt-1 text-[10px] ${
                                isOut ? "text-primary-foreground/70" : "text-muted-foreground"
                              }`}>
                                <span>{formatBubbleTime(m.created_at)}</span>
                                {m.message_type && m.message_type !== "text" && (
                                  <Badge
                                    variant={isOut ? "secondary" : "outline"}
                                    className="text-[9px] py-0 px-1 h-4 capitalize"
                                  >
                                    {m.message_type}
                                  </Badge>
                                )}
                                {isOut && m.status && (
                                  <span className="capitalize">{m.status}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </Card>

        {/* RIGHT: journey context */}
        <Card className="hidden xl:flex flex-col overflow-hidden">
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-sm font-medium">Journey Context</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-sm">
            {!selected ? (
              <div className="text-muted-foreground">No participant selected.</div>
            ) : (
              <>
                <ContextRow label="Journey" value={journey?.name || "—"} />
                <ContextRow
                  label="Journey Status"
                  value={<Badge variant="outline" className="capitalize">{journey?.status || "—"}</Badge>}
                />
                <ContextRow
                  label="Participant"
                  value={selected.contact.name || selected.contact.phone || "—"}
                />
                <ContextRow
                  label="Date Entered"
                  value={format(new Date(selected.enrollment.enrolled_at), "MMM d, yyyy h:mm a")}
                />
                <ContextRow
                  label="Current Node"
                  value={selected.enrollment.current_node_id || "—"}
                />
                <ContextRow
                  label="Enrollment Status"
                  value={<Badge variant="outline" className="capitalize">{selected.enrollment.status}</Badge>}
                />
                <ContextRow
                  label="Opted Out"
                  value={selected.contact.opted_out ? "Yes" : "No"}
                />
                <ContextRow
                  label="Replied"
                  value={selected.hasReply ? "Yes" : "No"}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ContextRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-right">{value}</div>
    </div>
  );
}