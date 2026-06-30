import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type JourneyLogRow = {
  id: string;
  contact_id: string | null;
  name: string;
  phone: string;
  body: string;
  status: string; // normalized: sent | delivered | read | clicked | failed | undelivered | sending | queued
  raw_status: string | null;
  error_code: string | null;
  error_message: string | null;
  sent_at: string;
  sid: string | null;
  channel: string;
};

const PAGE = 1000;

async function fetchAllLogs(journeyId: string) {
  const all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("journey_message_log")
      .select(
        "id, contact_id, channel, template_body, status, delivery_status, error_code, error_message, sent_at, twilio_message_sid, journey_contacts(name, phone, email)"
      )
      .eq("journey_id", journeyId)
      .order("sent_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function fetchClickedSids(journeyId: string): Promise<Set<string>> {
  const set = new Set<string>();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("journey_message_events")
      .select("whatsapp_message_sid")
      .eq("journey_id", journeyId)
      .eq("event_type", "clicked")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) if (r.whatsapp_message_sid) set.add(r.whatsapp_message_sid);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return set;
}

function normalizeStatus(row: any, clickedSids: Set<string>): string {
  if (row.twilio_message_sid && clickedSids.has(row.twilio_message_sid)) return "clicked";
  const s = String(row.status || "").toLowerCase();
  const d = String(row.delivery_status || "").toLowerCase();
  if (s === "read" || d === "read") return "read";
  if (s === "clicked") return "clicked";
  if (s === "delivered" || d === "delivered") return "delivered";
  if (s === "undelivered") return "undelivered";
  if (s === "failed" || d === "failed") return "failed";
  if (s === "sent") return "sent";
  if (s === "queued" || s === "accepted" || s === "scheduled") return "queued";
  if (s === "sending") return "sending";
  return s || "unknown";
}

// Higher = "better" outcome. Used to dedupe multiple sends per contact so the
// View Logs counts match the cumulative unique-contact Journey Funnel.
const STATUS_RANK: Record<string, number> = {
  clicked: 7,
  read: 6,
  delivered: 5,
  sent: 4,
  sending: 3,
  queued: 2,
  undelivered: 1,
  failed: 0,
  unknown: -1,
};

function last10(p: string | null | undefined) {
  const d = String(p || "").replace(/\D/g, "");
  return d.slice(-10);
}

export function useJourneyMessageLogs(journeyId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["journey-message-logs-full", journeyId],
    enabled: !!journeyId && enabled,
    queryFn: async (): Promise<JourneyLogRow[]> => {
      const [logs, clicked] = await Promise.all([
        fetchAllLogs(journeyId!),
        fetchClickedSids(journeyId!),
      ]);
      const mapped: JourneyLogRow[] = logs.map((r) => ({
        id: r.id,
        contact_id: r.contact_id,
        name: r.journey_contacts?.name || "—",
        phone: r.journey_contacts?.phone || "—",
        body: r.template_body || "",
        status: normalizeStatus(r, clicked),
        raw_status: r.status,
        error_code: r.error_code,
        error_message: r.error_message,
        sent_at: r.sent_at,
        sid: r.twilio_message_sid,
        channel: r.channel,
      }));

      // Dedupe per contact (phone last-10, fallback contact_id) keeping the
      // best-outcome row so totals align with the unique-contact Journey Funnel.
      const byContact = new Map<string, JourneyLogRow>();
      for (const row of mapped) {
        const key = last10(row.phone) || row.contact_id || row.id;
        const existing = byContact.get(key);
        if (!existing) { byContact.set(key, row); continue; }
        const a = STATUS_RANK[row.status] ?? -1;
        const b = STATUS_RANK[existing.status] ?? -1;
        if (a > b || (a === b && new Date(row.sent_at) > new Date(existing.sent_at))) {
          byContact.set(key, row);
        }
      }
      return Array.from(byContact.values()).sort(
        (x, y) => new Date(y.sent_at).getTime() - new Date(x.sent_at).getTime()
      );
    },
  });
}