import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BackButton } from "@/components/shared/BackButton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import WhatsAppRequestsTab from "@/components/communication/WhatsAppRequestsTab";
import { Search, ArrowLeft, ExternalLink, MessageSquare, ShoppingBag, IndianRupee, Clock } from "lucide-react";

type WAMessage = {
  id: string;
  phone: string;
  customer_id: string | null;
  direction: "inbound" | "outbound";
  message: string | null;
  message_type: string;
  order_id: string | null;
  status: string;
  profile_name: string | null;
  is_read: boolean;
  created_at: string;
};

type Customer = { id: string; name: string | null; phone: string; tier: string | null };

type Conversation = {
  phone: string;
  last_message: string;
  last_at: string;
  unread_count: number;
  customer?: Customer;
  profile_name?: string | null;
};

const initials = (s: string) =>
  s.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

const formatBubbleTime = (iso: string) => format(new Date(iso), "h:mm a");
const formatDayLabel = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d, yyyy");
};

export default function WhatsAppConversations() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [showListMobile, setShowListMobile] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "requests">("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const openConversationFromRequest = (phone: string) => {
    setSelectedPhone(phone);
    setShowListMobile(false);
    setActiveTab("all");
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Recent messages (limit 500) for list grouping
  const { data: recent, isLoading: loadingList } = useQuery({
    queryKey: ["wa-conversations-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as WAMessage[];
    },
  });

  // Customers for joined name/tier
  const customerIds = useMemo(
    () => Array.from(new Set((recent ?? []).map((m) => m.customer_id).filter(Boolean) as string[])),
    [recent]
  );
  const { data: customers } = useQuery({
    queryKey: ["wa-customers", customerIds.sort().join(",")],
    enabled: customerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, tier")
        .in("id", customerIds);
      if (error) throw error;
      return data as Customer[];
    },
  });
  const customerMap = useMemo(() => {
    const m = new Map<string, Customer>();
    (customers ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [customers]);

  // Group into conversations
  const conversations: Conversation[] = useMemo(() => {
    const map = new Map<string, Conversation>();
    (recent ?? []).forEach((msg) => {
      const existing = map.get(msg.phone);
      if (!existing) {
        map.set(msg.phone, {
          phone: msg.phone,
          last_message: msg.message ?? "",
          last_at: msg.created_at,
          unread_count: !msg.is_read && msg.direction === "inbound" ? 1 : 0,
          customer: msg.customer_id ? customerMap.get(msg.customer_id) : undefined,
          profile_name: msg.profile_name,
        });
      } else {
        if (!msg.is_read && msg.direction === "inbound") existing.unread_count += 1;
        if (!existing.customer && msg.customer_id) existing.customer = customerMap.get(msg.customer_id);
        if (!existing.profile_name && msg.profile_name) existing.profile_name = msg.profile_name;
      }
    });
    const list = Array.from(map.values()).sort(
      (a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime()
    );
    if (!debouncedSearch.trim()) return list;
    const q = debouncedSearch.toLowerCase();
    return list.filter(
      (c) =>
        c.phone.toLowerCase().includes(q) ||
        (c.customer?.name ?? "").toLowerCase().includes(q) ||
        (c.profile_name ?? "").toLowerCase().includes(q)
    );
  }, [recent, customerMap, debouncedSearch]);

  // Auto-select first conversation
  useEffect(() => {
    if (!selectedPhone && conversations.length > 0) {
      setSelectedPhone(conversations[0].phone);
    }
  }, [conversations, selectedPhone]);

  // Thread for selected conversation
  const { data: thread, isLoading: loadingThread } = useQuery({
    queryKey: ["wa-thread", selectedPhone, dateFrom, dateTo, typeFilter],
    enabled: !!selectedPhone,
    queryFn: async () => {
      let q = supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("phone", selectedPhone!)
        .order("created_at", { ascending: true });
      if (dateFrom) q = q.gte("created_at", `${dateFrom}T00:00:00`);
      if (dateTo) q = q.lte("created_at", `${dateTo}T23:59:59`);
      if (typeFilter !== "all") q = q.eq("message_type", typeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as WAMessage[];
    },
  });

  // Realtime per-phone
  useEffect(() => {
    if (!selectedPhone) return;
    const channel = supabase
      .channel(`wa-thread-${selectedPhone}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `phone=eq.${selectedPhone}` },
        () => {
          qc.invalidateQueries({ queryKey: ["wa-thread", selectedPhone] });
          qc.invalidateQueries({ queryKey: ["wa-conversations-recent"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedPhone, qc]);

  // Mark conversation as read on select
  useEffect(() => {
    if (!selectedPhone) return;
    supabase
      .from("whatsapp_messages")
      .update({ is_read: true })
      .eq("phone", selectedPhone)
      .eq("is_read", false)
      .then(() => {
        qc.invalidateQueries({ queryKey: ["wa-conversations-recent"] });
      });
  }, [selectedPhone, qc]);

  // Auto-scroll thread to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread]);

  const selectedConv = conversations.find((c) => c.phone === selectedPhone);
  const linkedOrderIds = useMemo(
    () => Array.from(new Set((thread ?? []).map((m) => m.order_id).filter(Boolean) as string[])),
    [thread]
  );

  // Insights (totals across all messages for this phone, not filtered)
  const { data: insights } = useQuery({
    queryKey: ["wa-insights", selectedPhone, selectedConv?.customer?.id],
    enabled: !!selectedPhone,
    queryFn: async () => {
      const { count: totalMessages } = await supabase
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .eq("phone", selectedPhone!);

      const { data: orderRows } = await supabase
        .from("whatsapp_messages")
        .select("order_id")
        .eq("phone", selectedPhone!)
        .not("order_id", "is", null);
      const orderIds = Array.from(new Set((orderRows ?? []).map((r: any) => r.order_id)));

      let revenue = 0;
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from("orders")
          .select("total_amount, status")
          .in("id", orderIds)
          .eq("status", "completed");
        revenue = (orders ?? []).reduce((s: number, o: any) => s + Number(o.total_amount ?? 0), 0);
      }

      return {
        totalMessages: totalMessages ?? 0,
        ordersCount: orderIds.length,
        revenue,
      };
    },
  });

  // Group thread by day
  const groupedThread = useMemo(() => {
    const groups: { day: string; items: WAMessage[] }[] = [];
    (thread ?? []).forEach((m) => {
      const day = formatDayLabel(m.created_at);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(m);
      else groups.push({ day, items: [m] });
    });
    return groups;
  }, [thread]);

  return (
    <div className="space-y-4">
      <BackButton />
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold">WhatsApp Conversations</h1>
        <p className="text-muted-foreground mt-1">
          Read full chat history, track orders and customer engagement across WhatsApp.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name or phone..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="From" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="To" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Message type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="template">Template</SelectItem>
              <SelectItem value="button">Button</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Three-pane layout */}
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_280px] gap-4 h-[calc(100vh-20rem)] min-h-[500px]">
        {/* LEFT: conversation list */}
        <Card className={`overflow-hidden flex flex-col ${!showListMobile && selectedPhone ? "hidden md:flex" : "flex"}`}>
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-sm font-medium">
              Conversations {conversations.length > 0 && `(${conversations.length})`}
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            {loadingList ? (
              <div className="p-3 space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No conversations yet.</div>
            ) : (
              <div className="divide-y">
                {conversations.map((c) => {
                  const name = c.customer?.name || c.profile_name || c.phone;
                  const isActive = c.phone === selectedPhone;
                  return (
                    <button
                      key={c.phone}
                      onClick={() => {
                        setSelectedPhone(c.phone);
                        setShowListMobile(false);
                      }}
                      className={`w-full text-left p-3 hover:bg-accent transition-colors flex gap-3 items-start ${
                        isActive ? "bg-accent" : ""
                      }`}
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback>{initials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm truncate">{name}</div>
                          <div className="text-xs text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(c.last_at), { addSuffix: false })}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{c.phone}</div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <div className="text-xs text-muted-foreground truncate">{c.last_message || "—"}</div>
                          {c.unread_count > 0 && (
                            <Badge className="shrink-0 h-5 px-1.5">{c.unread_count}</Badge>
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

        {/* CENTER: chat thread */}
        <Card className={`overflow-hidden flex flex-col ${showListMobile && selectedPhone ? "hidden md:flex" : "flex"}`}>
          {!selectedPhone ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a conversation to view messages
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
                  <AvatarFallback>
                    {initials(selectedConv?.customer?.name || selectedConv?.profile_name || selectedPhone)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {selectedConv?.customer?.name || selectedConv?.profile_name || "Unknown contact"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{selectedPhone}</div>
                </div>
                {linkedOrderIds.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => navigate("/transactions/orders")}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> View Orders
                  </Button>
                )}
              </CardHeader>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
                {loadingThread ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-2/3" />)}
                  </div>
                ) : (thread ?? []).length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">No messages match the filters.</div>
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
                                {m.message_type !== "text" && (
                                  <Badge
                                    variant={isOut ? "secondary" : "outline"}
                                    className="text-[9px] py-0 px-1 h-4 capitalize"
                                  >
                                    {m.message_type}
                                  </Badge>
                                )}
                                {m.order_id && (
                                  <button
                                    className="underline hover:no-underline inline-flex items-center gap-0.5"
                                    onClick={() => navigate("/transactions/orders")}
                                  >
                                    <ExternalLink className="h-2.5 w-2.5" /> Order
                                  </button>
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

        {/* RIGHT: insights (xl+ only) */}
        <Card className="hidden xl:flex flex-col overflow-hidden">
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-sm font-medium">Customer Insights</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {!selectedPhone ? (
              <div className="text-sm text-muted-foreground">Select a conversation.</div>
            ) : !selectedConv?.customer ? (
              <div className="text-sm text-muted-foreground">
                Unknown contact — not linked to any customer.
                {selectedConv?.profile_name && (
                  <div className="mt-2 text-xs">WhatsApp profile: {selectedConv.profile_name}</div>
                )}
              </div>
            ) : (
              <>
                <div>
                  <div className="text-xs text-muted-foreground">Customer</div>
                  <div className="font-medium">{selectedConv.customer.name || "—"}</div>
                  {selectedConv.customer.tier && (
                    <Badge variant="outline" className="mt-1 capitalize">{selectedConv.customer.tier}</Badge>
                  )}
                </div>
                <Stat
                  icon={<MessageSquare className="h-4 w-4" />}
                  label="Total messages"
                  value={insights?.totalMessages ?? 0}
                />
                <Stat
                  icon={<ShoppingBag className="h-4 w-4" />}
                  label="Orders via WhatsApp"
                  value={insights?.ordersCount ?? 0}
                />
                <Stat
                  icon={<IndianRupee className="h-4 w-4" />}
                  label="Revenue"
                  value={new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  }).format(insights?.revenue ?? 0)}
                />
                <Stat
                  icon={<Clock className="h-4 w-4" />}
                  label="Last interaction"
                  value={selectedConv ? formatDistanceToNow(new Date(selectedConv.last_at), { addSuffix: true }) : "—"}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium text-sm break-words">{value}</div>
      </div>
    </div>
  );
}
