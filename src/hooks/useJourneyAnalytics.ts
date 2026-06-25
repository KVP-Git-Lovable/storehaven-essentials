import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

const SUCCESS = new Set(["sent", "delivered", "queued", "accepted", "scheduled", "sending", "read"]);
const FAIL = new Set(["failed", "undelivered"]);
const NEG_RE = /\b(stop|unsubscribe|not interested|don'?t send|no thanks|cancel)\b/i;
const POS_RE = /\b(yes|interested|sure|ok|okay|please|book|buy)\b/i;

function last10(p: any) {
  return String(p || "").replace(/\D/g, "").slice(-10);
}

export interface RangeFilter {
  from?: Date;
  to?: Date;
}

export function useJourneyAnalytics(journeyId: string, range?: RangeFilter) {
  async function fetchAllPaged<T = any>(
    build: (from: number, to: number) => any,
    pageSize = 1000,
  ): Promise<T[]> {
    const out: T[] = [];
    let from = 0;
    // Hard safety cap to avoid runaway loops
    for (let i = 0; i < 200; i++) {
      const to = from + pageSize - 1;
      const { data, error } = await build(from, to);
      if (error) throw error;
      const rows = (data || []) as T[];
      out.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    return out;
  }

  const messagesQ = useQuery({
    queryKey: ["ja-messages", journeyId],
    enabled: !!journeyId,
    queryFn: async () => {
      return await fetchAllPaged((from, to) =>
        supabase
          .from("journey_message_log")
          .select("id, status, delivery_status, channel, node_id, sent_at, error_message, error_code, contact_id, journey_contacts(id, name, phone, email, opted_out)")
          .eq("journey_id", journeyId)
          .range(from, to),
      );
    },
    staleTime: 60_000,
  });

  const enrollmentsQ = useQuery({
    queryKey: ["ja-enroll", journeyId],
    enabled: !!journeyId,
    queryFn: async () => {
      return await fetchAllPaged((from, to) =>
        supabase
          .from("journey_enrollments")
          .select("id, status, contact_id, enrolled_at")
          .eq("journey_id", journeyId)
          .range(from, to),
      );
    },
    staleTime: 60_000,
  });

  const eventsQ = useQuery({
    queryKey: ["ja-events", journeyId],
    enabled: !!journeyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("journey_message_events")
        .select("event_type, event_timestamp, journey_step_id, person_id")
        .eq("journey_id", journeyId);
      return data || [];
    },
    staleTime: 60_000,
  });

  const clicksQ = useQuery({
    queryKey: ["ja-clicks", journeyId],
    enabled: !!journeyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_link_clicks")
        .select("phone_number, clicked_at")
        .eq("journey_id", journeyId);
      return data || [];
    },
    staleTime: 60_000,
  });

  const inboundPhones = useMemo(() => {
    const set = new Set<string>();
    (messagesQ.data || []).forEach((m: any) => {
      const p = last10(m.journey_contacts?.phone);
      if (p) set.add(p);
    });
    return Array.from(set);
  }, [messagesQ.data]);

  const inboundQ = useQuery({
    queryKey: ["ja-inbound", journeyId, inboundPhones.length],
    enabled: inboundPhones.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("phone, body, created_at")
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(2000);
      return (data || []).filter((m: any) => inboundPhones.includes(last10(m.phone)));
    },
    staleTime: 60_000,
  });

  const ordersQ = useQuery({
    queryKey: ["ja-orders", journeyId, inboundPhones.length],
    enabled: inboundPhones.length > 0,
    queryFn: async () => {
      const { data: custs } = await supabase
        .from("customers")
        .select("id, phone")
        .limit(5000);
      const map = new Map<string, string>();
      (custs || []).forEach((c: any) => {
        const p = last10(c.phone);
        if (p && inboundPhones.includes(p)) map.set(c.id, p);
      });
      if (map.size === 0) return [] as any[];
      const ids = Array.from(map.keys());
      const { data: orders } = await supabase
        .from("orders")
        .select("id, customer_id, total_amount, created_at, status")
        .in("customer_id", ids)
        .eq("status", "completed");
      return (orders || []).map((o: any) => ({ ...o, phone: map.get(o.customer_id) }));
    },
    staleTime: 60_000,
  });

  const journeyQ = useQuery({
    queryKey: ["ja-journey", journeyId],
    enabled: !!journeyId,
    queryFn: async () => {
      const { data } = await supabase.from("journeys").select("canvas_data, audience_config").eq("id", journeyId).maybeSingle();
      return data;
    },
    staleTime: 5 * 60_000,
  });

  // Live audience preview — same source used by the Journey Builder's
  // "Live preview" so "Entered Journey" matches the configured list view.
  const audiencePreviewQ = useQuery({
    queryKey: ["ja-audience-preview", journeyId, JSON.stringify((journeyQ.data as any)?.audience_config || null)],
    enabled: !!journeyId && !!(journeyQ.data as any)?.audience_config?.segments?.length,
    queryFn: async () => {
      const cfg = (journeyQ.data as any)?.audience_config;
      const validSegments = (cfg?.segments || []).filter((s: any) => s?.list_view_id);
      if (!validSegments.length) return null;
      const { data, error } = await supabase.functions.invoke("journey-actions", {
        body: {
          action: "audience-preview",
          audience_config: { segments: validSegments, combinator: cfg?.combinator || "union", primary: cfg?.primary },
        },
      });
      if (error) return null;
      if (data?.error) return null;
      return { final: Number(data?.final || 0) };
    },
    staleTime: 60_000,
  });

  return useMemo(() => {
    const messages = messagesQ.data || [];
    const enrollments = enrollmentsQ.data || [];
    const inbound = inboundQ.data || [];
    const orders = ordersQ.data || [];
    const clicks = clicksQ.data || [];
    const nodes = ((journeyQ.data?.canvas_data as any)?.nodes || []).filter((n: any) => n?.type === "message");

    const within = (d: any) => {
      if (!range?.from && !range?.to) return true;
      const t = new Date(d).getTime();
      if (range?.from && t < range.from.getTime()) return false;
      if (range?.to && t > range.to.getTime()) return false;
      return true;
    };

    const filteredMsgs = messages.filter((m: any) => within(m.sent_at));

    const sent = filteredMsgs.length;
    const delivered = filteredMsgs.filter((m: any) => m.status === "delivered" || m.delivery_status === "delivered" || m.status === "read").length;
    const read = filteredMsgs.filter((m: any) => m.status === "read").length;
    const failed = filteredMsgs.filter((m: any) => FAIL.has(m.status) || m.delivery_status === "failed").length;
    const optedOut = new Set(filteredMsgs.filter((m: any) => m.journey_contacts?.opted_out).map((m: any) => m.contact_id)).size;

    const clickedPhones = new Set(clicks.map((c: any) => last10(c.phone_number)));
    const clickedMsgContacts = new Set(
      filteredMsgs.filter((m: any) => clickedPhones.has(last10(m.journey_contacts?.phone))).map((m: any) => m.contact_id),
    );
    const clicked = clickedMsgContacts.size;

    // Replies: count contacts who sent inbound after first sent_at
    const firstSentByPhone = new Map<string, number>();
    filteredMsgs.forEach((m: any) => {
      const p = last10(m.journey_contacts?.phone);
      const t = new Date(m.sent_at).getTime();
      if (!p) return;
      if (!firstSentByPhone.has(p) || (firstSentByPhone.get(p) as number) > t) firstSentByPhone.set(p, t);
    });
    const replyPhones = new Set<string>();
    let negative = 0;
    let positive = 0;
    inbound.forEach((i: any) => {
      const p = last10(i.phone);
      const first = firstSentByPhone.get(p);
      if (!first) return;
      if (new Date(i.created_at).getTime() < first) return;
      replyPhones.add(p);
      const body = String(i.body || "");
      if (NEG_RE.test(body)) negative++;
      else if (POS_RE.test(body)) positive++;
    });
    const replies = replyPhones.size;

    // Orders attribution
    const ordersAttributed = orders.filter((o: any) => {
      const first = firstSentByPhone.get(o.phone);
      return first && new Date(o.created_at).getTime() >= first;
    });
    const revenue = ordersAttributed.reduce((s, o) => s + Number(o.total_amount || 0), 0);

    // Audience metrics — dedupe by contact_id since re-activations create
    // multiple enrollment rows per contact. Use the most recent row's status.
    const latestByContact = new Map<string, any>();
    enrollments.forEach((e: any) => {
      if (!e?.contact_id) return;
      const prev = latestByContact.get(e.contact_id);
      if (!prev || new Date(e.enrolled_at).getTime() > new Date(prev.enrolled_at).getTime()) {
        latestByContact.set(e.contact_id, e);
      }
    });
    const uniqueEnrollments = Array.from(latestByContact.values());
    // "Entered Journey" reflects the journey's current configured audience
    // (matching the Live preview in the Journey Builder). Falls back to the
    // historical unique-enrollment count if the preview isn't available.
    const previewFinal = (audiencePreviewQ.data as any)?.final;
    const entered = (typeof previewFinal === "number" && previewFinal > 0)
      ? previewFinal
      : uniqueEnrollments.length;
    const completed = uniqueEnrollments.filter((e: any) => e.status === "completed").length;
    const active = uniqueEnrollments.filter((e: any) => e.status === "active" || e.status === "in_progress").length;
    const dropped = uniqueEnrollments.filter((e: any) => e.status === "exited" || e.status === "dropped").length;

    // Funnel — cumulative unique-contact counts over the ENTIRE journey,
    // independent of the date-range filter. A contact who has ever reached
    // a stage remains counted even if later messages fail.
    const deliveredContacts = new Set<string>();
    const readContacts = new Set<string>();
    const firstSentByPhoneAll = new Map<string, number>();
    messages.forEach((m: any) => {
      if (m.contact_id) {
        if (m.status === "delivered" || m.delivery_status === "delivered" || m.status === "read") {
          deliveredContacts.add(m.contact_id);
        }
        if (m.status === "read") readContacts.add(m.contact_id);
      }
      const p = last10(m.journey_contacts?.phone);
      if (p && m.sent_at) {
        const t = new Date(m.sent_at).getTime();
        const prev = firstSentByPhoneAll.get(p);
        if (prev === undefined || t < prev) firstSentByPhoneAll.set(p, t);
      }
    });
    const phoneToContactId = new Map<string, string>();
    messages.forEach((m: any) => {
      const p = last10(m.journey_contacts?.phone);
      if (p && m.contact_id && !phoneToContactId.has(p)) phoneToContactId.set(p, m.contact_id);
    });
    const clickedContacts = new Set<string>();
    clicks.forEach((c: any) => {
      const id = phoneToContactId.get(last10(c.phone_number));
      if (id) clickedContacts.add(id);
    });
    const repliedContacts = new Set<string>();
    inbound.forEach((i: any) => {
      const p = last10(i.phone);
      const first = firstSentByPhoneAll.get(p);
      if (!first) return;
      if (new Date(i.created_at).getTime() < first) return;
      const id = phoneToContactId.get(p);
      if (id) repliedContacts.add(id);
    });
    const orderContacts = new Set<string>();
    orders.forEach((o: any) => {
      const first = firstSentByPhoneAll.get(o.phone);
      if (first && new Date(o.created_at).getTime() >= first) {
        const id = phoneToContactId.get(o.phone);
        if (id) orderContacts.add(id);
      }
    });

    const funnel = [
      { label: "Entered Journey", count: entered },
      { label: "Delivered", count: deliveredContacts.size },
      { label: "Read", count: readContacts.size },
      { label: "Clicked", count: clickedContacts.size },
      { label: "Replied", count: repliedContacts.size },
      { label: "Order Placed", count: orderContacts.size },
    ];

    // Trend by day
    const dayMap = new Map<string, { delivered: number; read: number; clicked: number; replied: number }>();
    filteredMsgs.forEach((m: any) => {
      const d = new Date(m.sent_at).toISOString().slice(0, 10);
      if (!dayMap.has(d)) dayMap.set(d, { delivered: 0, read: 0, clicked: 0, replied: 0 });
      const e = dayMap.get(d)!;
      if (m.status === "delivered" || m.delivery_status === "delivered" || m.status === "read") e.delivered++;
      if (m.status === "read") e.read++;
    });
    clicks.forEach((c: any) => {
      const d = new Date(c.clicked_at).toISOString().slice(0, 10);
      if (!dayMap.has(d)) dayMap.set(d, { delivered: 0, read: 0, clicked: 0, replied: 0 });
      dayMap.get(d)!.clicked++;
    });
    inbound.forEach((i: any) => {
      const p = last10(i.phone);
      const first = firstSentByPhone.get(p);
      if (!first || new Date(i.created_at).getTime() < first) return;
      const d = new Date(i.created_at).toISOString().slice(0, 10);
      if (!dayMap.has(d)) dayMap.set(d, { delivered: 0, read: 0, clicked: 0, replied: 0 });
      dayMap.get(d)!.replied++;
    });
    const trend = Array.from(dayMap.entries()).sort().map(([day, v]) => ({ day, ...v }));

    // Heatmap day-of-week x hour
    const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    filteredMsgs.forEach((m: any) => {
      if (m.status !== "read") return;
      const d = new Date(m.sent_at);
      heat[d.getDay()][d.getHours()]++;
    });

    // Node performance — unique-contact counts per node, full journey
    // (no date filter), so values stay consistent with the Journey Funnel.
    type NodeAgg = {
      nodeId: string; label: string;
      sentSet: Set<string>; deliveredSet: Set<string>; readSet: Set<string>;
      clickedSet: Set<string>; repliedSet: Set<string>; failedSet: Set<string>; orderSet: Set<string>;
    };
    const nodeAgg = new Map<string, NodeAgg>();
    const mkAgg = (id: string, label: string): NodeAgg => ({
      nodeId: id, label,
      sentSet: new Set(), deliveredSet: new Set(), readSet: new Set(),
      clickedSet: new Set(), repliedSet: new Set(), failedSet: new Set(), orderSet: new Set(),
    });
    nodes.forEach((n: any) => {
      nodeAgg.set(n.id, mkAgg(n.id, n.data?.label || n.data?.name || "Message"));
    });
    messages.forEach((m: any) => {
      if (!m.node_id || !m.contact_id) return;
      if (!nodeAgg.has(m.node_id)) nodeAgg.set(m.node_id, mkAgg(m.node_id, "Message"));
      const n = nodeAgg.get(m.node_id)!;
      n.sentSet.add(m.contact_id);
      if (m.status === "delivered" || m.delivery_status === "delivered" || m.status === "read") n.deliveredSet.add(m.contact_id);
      if (m.status === "read") n.readSet.add(m.contact_id);
      if (FAIL.has(m.status) || m.delivery_status === "failed") n.failedSet.add(m.contact_id);
      const p = last10(m.journey_contacts?.phone);
      if (p && clickedPhones.has(p)) n.clickedSet.add(m.contact_id);
      if (p && replyPhones.has(p)) n.repliedSet.add(m.contact_id);
    });
    const nodePerformance = Array.from(nodeAgg.values()).map((n) => ({
      nodeId: n.nodeId,
      label: n.label,
      sent: n.sentSet.size,
      delivered: n.deliveredSet.size,
      read: n.readSet.size,
      clicked: n.clickedSet.size,
      replied: n.repliedSet.size,
      failed: n.failedSet.size,
      orders: n.orderSet.size,
    }));

    // Engagement scoring per contact
    const scoreByContact = new Map<string, number>();
    filteredMsgs.forEach((m: any) => {
      const id = m.contact_id;
      if (!id) return;
      let delta = 0;
      if (m.status === "delivered" || m.delivery_status === "delivered") delta += 1;
      if (m.status === "read") delta += 3;
      if (FAIL.has(m.status) || m.delivery_status === "failed") delta -= 2;
      if (m.journey_contacts?.opted_out) delta -= 50;
      scoreByContact.set(id, (scoreByContact.get(id) || 0) + delta);
    });
    filteredMsgs.forEach((m: any) => {
      const p = last10(m.journey_contacts?.phone);
      if (clickedPhones.has(p)) scoreByContact.set(m.contact_id, (scoreByContact.get(m.contact_id) || 0) + 5);
    });
    inbound.forEach((i: any) => {
      const p = last10(i.phone);
      const first = firstSentByPhone.get(p);
      if (!first || new Date(i.created_at).getTime() < first) return;
      const body = String(i.body || "");
      const msg = filteredMsgs.find((m: any) => last10(m.journey_contacts?.phone) === p);
      if (!msg) return;
      let delta = 0;
      if (NEG_RE.test(body)) delta = -10;
      else if (POS_RE.test(body)) delta = 7;
      scoreByContact.set(msg.contact_id, (scoreByContact.get(msg.contact_id) || 0) + delta);
    });
    const orderCountByPhone = new Map<string, number>();
    ordersAttributed.forEach((o: any) => orderCountByPhone.set(o.phone, (orderCountByPhone.get(o.phone) || 0) + 1));
    filteredMsgs.forEach((m: any) => {
      const p = last10(m.journey_contacts?.phone);
      const n = orderCountByPhone.get(p) || 0;
      if (n > 0) scoreByContact.set(m.contact_id, (scoreByContact.get(m.contact_id) || 0) + 20 + Math.max(0, n - 1) * 40);
    });

    // Audience Segments — use full journey messages and unique-contact funnel
    // sets so segment buckets reconcile with the Journey Funnel.
    const segments = {
      highIntent: 0, medium: 0, low: 0, dormant: 0,
      highlyEngaged: 0, warm: 0, cold: 0, lost: 0, highValue: 0,
    };
    const contactsSeen = new Set<string>();
    const failedContacts = new Set<string>();
    messages.forEach((m: any) => {
      if (m.contact_id && (FAIL.has(m.status) || m.delivery_status === "failed")) failedContacts.add(m.contact_id);
    });
    const optedOutContacts = new Set<string>();
    messages.forEach((m: any) => {
      if (m.contact_id && m.journey_contacts?.opted_out) optedOutContacts.add(m.contact_id);
    });
    messages.forEach((m: any) => {
      if (!m.contact_id || contactsSeen.has(m.contact_id)) return;
      contactsSeen.add(m.contact_id);
      const score = scoreByContact.get(m.contact_id) || 0;
      if (score > 50) segments.highIntent++;
      else if (score > 20) segments.medium++;
      else if (score > 0) segments.low++;
      else segments.dormant++;
      const wasRead = readContacts.has(m.contact_id);
      const wasClicked = clickedContacts.has(m.contact_id);
      const wasReplied = repliedContacts.has(m.contact_id);
      const wasFailed = failedContacts.has(m.contact_id);
      const wasDelivered = deliveredContacts.has(m.contact_id);
      const purchased = orderContacts.has(m.contact_id);
      if (purchased) segments.highValue++;
      if (wasRead && wasClicked && wasReplied) segments.highlyEngaged++;
      else if (wasRead) segments.warm++;
      else if (wasDelivered) segments.cold++;
      else if (wasFailed || optedOutContacts.has(m.contact_id)) segments.lost++;
    });

    // Cohorts by week of enrollment — use full journey messages so weekly
    // rates remain stable and consistent with the funnel.
    const cohortMap = new Map<string, { entered: number; phones: Set<string>; d1Read: number; d7Read: number; d30Conv: number }>();
    uniqueEnrollments.forEach((e: any) => {
      const week = new Date(e.enrolled_at);
      const monday = new Date(week);
      monday.setDate(monday.getDate() - monday.getDay() + 1);
      const key = monday.toISOString().slice(0, 10);
      if (!cohortMap.has(key)) cohortMap.set(key, { entered: 0, phones: new Set(), d1Read: 0, d7Read: 0, d30Conv: 0 });
      const c = cohortMap.get(key)!;
      c.entered++;
      const msg = messages.find((m: any) => m.contact_id === e.contact_id);
      const p = last10(msg?.journey_contacts?.phone);
      if (p) c.phones.add(p);
      const enrolledAt = new Date(e.enrolled_at).getTime();
      const wasRead = readContacts.has(e.contact_id);
      if (wasRead) {
        const readMsg = messages.find((m: any) => m.contact_id === e.contact_id && m.status === "read");
        const days = readMsg ? (new Date(readMsg.sent_at).getTime() - enrolledAt) / 86400000 : 999;
        if (days <= 1) c.d1Read++;
        if (days <= 7) c.d7Read++;
      }
      const conv = ordersAttributed.some((o: any) => o.phone === p && (new Date(o.created_at).getTime() - enrolledAt) / 86400000 <= 30);
      if (conv) c.d30Conv++;
    });
    const cohorts = Array.from(cohortMap.entries()).sort().map(([week, v]) => ({
      week,
      entered: v.entered,
      d1ReadPct: v.entered ? (v.d1Read / v.entered) * 100 : 0,
      d7ReadPct: v.entered ? (v.d7Read / v.entered) * 100 : 0,
      d30ConvPct: v.entered ? (v.d30Conv / v.entered) * 100 : 0,
    }));

    // Attribution by window
    const attribution = { d1: 0, d7: 0, d15: 0, d30: 0, d1Count: 0, d7Count: 0, d15Count: 0, d30Count: 0 };
    ordersAttributed.forEach((o: any) => {
      const first = firstSentByPhone.get(o.phone) || 0;
      const days = (new Date(o.created_at).getTime() - first) / 86400000;
      const amt = Number(o.total_amount || 0);
      if (days <= 1) { attribution.d1 += amt; attribution.d1Count++; }
      if (days <= 7) { attribution.d7 += amt; attribution.d7Count++; }
      if (days <= 15) { attribution.d15 += amt; attribution.d15Count++; }
      if (days <= 30) { attribution.d30 += amt; attribution.d30Count++; }
    });

    // Rule-based insights — use the unique-contact funnel rates so
    // headlines reconcile with the funnel and KPI cards.
    const insights: { kind: "info" | "warn" | "success"; text: string }[] = [];
    const sortedNodes = [...nodePerformance].sort((a, b) => (b.read / Math.max(b.sent, 1)) - (a.read / Math.max(a.sent, 1)));
    if (sortedNodes.length >= 2) {
      const a = sortedNodes[0]; const b = sortedNodes[sortedNodes.length - 1];
      const ratio = (a.read / Math.max(a.sent, 1)) / Math.max(b.read / Math.max(b.sent, 1), 0.001);
      if (ratio > 1.5) insights.push({ kind: "info", text: `${a.label} reads ${ratio.toFixed(1)}× better than ${b.label}` });
    }
    if (ordersAttributed.length > 0) {
      insights.push({ kind: "success", text: `${ordersAttributed.length} orders attributed (₹${revenue.toLocaleString("en-IN")})` });
    }
    // Health score (0-100)
    // All rates use unique-contact funnel counts over Entered so the score,
    // KPI cards, Journey Funnel and AI Insights stay aligned.
    const deliveryRate = entered ? (deliveredContacts.size / entered) * 100 : 0;
    const readRate = entered ? (readContacts.size / entered) * 100 : 0;
    const failRate = entered ? (failedContacts.size / entered) * 100 : 0;
    const optOutRate = entered ? (optedOutContacts.size / entered) * 100 : 0;
    const replyRate = entered ? (repliedContacts.size / entered) * 100 : 0;

    // AI Insights using unified rates
    if (entered > 0) {
      if (readRate > 60) insights.push({ kind: "success", text: `Strong read rate at ${readRate.toFixed(1)}%` });
      else if (readRate < 30 && entered > 20) insights.push({ kind: "warn", text: `Read rate is low at ${readRate.toFixed(1)}%` });
      if (failRate > 10) insights.push({ kind: "warn", text: `Failed delivery rate is high (${failRate.toFixed(1)}%)` });
      if (optOutRate > 5) insights.push({ kind: "warn", text: `Opt-out rate increasing (${optOutRate.toFixed(1)}%)` });
    }
    if (ordersAttributed.length > 0) {
      insights.push({ kind: "success", text: `${ordersAttributed.length} orders attributed (₹${revenue.toLocaleString("en-IN")})` });
    }
    let bestHour2 = -1, bestVal2 = 0;
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) if (heat[d][h] > bestVal2) { bestVal2 = heat[d][h]; bestHour2 = h; }
    if (bestHour2 >= 0 && bestVal2 > 3) insights.push({ kind: "info", text: `Best engagement around ${bestHour2}:00–${bestHour2 + 1}:00` });
    let health = 0;
    health += Math.min(30, deliveryRate * 0.3);
    health += Math.min(30, readRate * 0.4);
    health += Math.min(20, replyRate * 2);
    health -= Math.min(20, failRate);
    health -= Math.min(20, optOutRate * 4);
    health = Math.max(0, Math.min(100, Math.round(health + 40)));

    const strengths: string[] = [];
    const areas: string[] = [];
    if (deliveryRate >= 90) strengths.push("High delivery rate"); else areas.push("Delivery rate below 90%");
    if (readRate >= 60) strengths.push("Good read rate"); else areas.push("Read rate below 60%");
    if (replyRate >= 5) strengths.push("Engagement improving"); else areas.push("Reply rate is low");
    if (failRate >= 5) areas.push("Failed deliveries elevated");
    if (optOutRate >= 3) areas.push("Opt-out rate increasing");

    return {
      loading: messagesQ.isLoading || enrollmentsQ.isLoading,
      kpis: {
        entered, active, completed, dropped, optedOut,
        sent, delivered, read, failed, clicked, replies,
        ordersCount: ordersAttributed.length, revenue,
        deliveryRate, readRate, clickRate: entered ? (clickedContacts.size / entered) * 100 : 0,
        replyRate, conversionRate: entered ? (ordersAttributed.length / entered) * 100 : 0,
        avgOrderValue: ordersAttributed.length ? revenue / ordersAttributed.length : 0,
        revenuePerCustomer: entered ? revenue / entered : 0,
        // Unique-contact funnel counts (shared with Live Send Progress).
        uniqueDelivered: deliveredContacts.size,
        uniqueRead: readContacts.size,
        uniqueClicked: clickedContacts.size,
        uniqueReplied: repliedContacts.size,
        uniqueFailed: failedContacts.size,
        uniqueOrders: orderContacts.size,
      },
      funnel, trend, heat, nodePerformance, segments, cohorts, attribution, insights,
      health: { score: health, strengths, areas },
      sentimentBreakdown: { positive, negative, neutral: replies - positive - negative },
    };
  }, [messagesQ.data, enrollmentsQ.data, eventsQ.data, clicksQ.data, inboundQ.data, ordersQ.data, journeyQ.data, audiencePreviewQ.data, range?.from, range?.to]);
}
