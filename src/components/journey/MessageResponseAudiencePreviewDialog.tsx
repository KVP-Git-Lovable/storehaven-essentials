import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  journeyId: string;
  targetNodeId: string;
  targetLabel: string;
  condition: string;
  waitValue: number;
  waitUnit: string;
}

const PAGE = 1000;

function waitMs(v: number, u: string) {
  const n = Number(v) || 0;
  if (u === "minutes") return n * 60_000;
  if (u === "hours") return n * 3_600_000;
  if (u === "days") return n * 86_400_000;
  return n * 3_600_000;
}

function last10(p: string | null | undefined) {
  if (!p) return "";
  const d = String(p).replace(/\D/g, "");
  return d.slice(-10);
}

type LogRow = {
  id: string;
  contact_id: string;
  status: string | null;
  delivery_status: string | null;
  sent_at: string;
  twilio_message_sid: string | null;
  journey_contacts: { name: string | null; phone: string | null } | null;
};

const POSITIVE = new Set(["delivered", "read", "replied", "failed", "undelivered"]);

type EventMap = Record<string, Partial<Record<string, string>>>; // sid -> { event_type -> earliest ts }

function statusReached(row: LogRow, target: string): boolean {
  // Fallback when no event row exists (older logs). Honors window only via timestamp-based path; here just confirms current state.
  const s = String(row.status || "").toLowerCase();
  const d = String(row.delivery_status || "").toLowerCase();
  if (target === "delivered") return ["delivered", "read"].includes(s) || ["delivered", "read"].includes(d);
  if (target === "read") return s === "read" || d === "read";
  if (target === "failed") return s === "failed" || d === "failed";
  if (target === "undelivered") return s === "undelivered" || d === "undelivered";
  return false;
}

/**
 * Returns the timestamp at which the target status was reached for this SID, or null.
 * For 'delivered', accepts either the delivered or the read event (read implies delivered).
 */
function eventTsFor(events: EventMap, sid: string | null, target: string): string | null {
  if (!sid) return null;
  const e = events[sid];
  if (!e) return null;
  if (target === "delivered") return e.delivered || e.read || null;
  if (target === "read") return e.read || null;
  if (target === "failed") return e.failed || null;
  if (target === "undelivered") return e.undelivered || null;
  return null;
}

export function MessageResponseAudiencePreviewDialog({
  open, onOpenChange, journeyId, targetNodeId, targetLabel, condition, waitValue, waitUnit,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [replyPhones, setReplyPhones] = useState<Array<{ phone: string; created_at: string }>>([]);
  const [events, setEvents] = useState<EventMap>({});
  const [error, setError] = useState<string | null>(null);

  const windowMs = useMemo(() => waitMs(waitValue, waitUnit), [waitValue, waitUnit]);
  const isReplyCond = condition === "replied" || condition === "not_replied";
  const isNegative = condition.startsWith("not_");
  const baseCond = isNegative ? condition.replace(/^not_/, "") : condition;

  useEffect(() => {
    if (!open || !journeyId || !targetNodeId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 1) Logs for this node
        const all: LogRow[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("journey_message_log")
            .select("id, contact_id, status, delivery_status, sent_at, twilio_message_sid, journey_contacts(name, phone)")
            .eq("journey_id", journeyId)
            .eq("node_id", targetNodeId)
            .not("sent_at", "is", null)
            .order("sent_at", { ascending: false })
            .range(from, from + PAGE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...(data as any[]));
          if (data.length < PAGE) break;
          from += PAGE;
        }
        if (cancel) return;
        setRows(all);

        // 2) Per-SID engagement event timestamps (delivered/read/failed/undelivered)
        const sids = Array.from(new Set(all.map((r) => r.twilio_message_sid).filter(Boolean))) as string[];
        const evMap: EventMap = {};
        if (sids.length) {
          const CHUNK = 200;
          for (let i = 0; i < sids.length; i += CHUNK) {
            const slice = sids.slice(i, i + CHUNK);
            const { data, error } = await supabase
              .from("journey_message_events")
              .select("whatsapp_message_sid, event_type, event_timestamp")
              .eq("journey_id", journeyId)
              .in("whatsapp_message_sid", slice);
            if (error) throw error;
            for (const e of (data || []) as any[]) {
              const sid = e.whatsapp_message_sid as string;
              const etype = String(e.event_type || "").toLowerCase();
              const ts = e.event_timestamp as string;
              if (!sid || !etype || !ts) continue;
              const bucket = evMap[sid] || (evMap[sid] = {});
              const cur = bucket[etype];
              if (!cur || new Date(ts) < new Date(cur)) bucket[etype] = ts;
            }
          }
        }
        if (cancel) return;
        setEvents(evMap);

        // 3) Inbound replies if needed
        if (isReplyCond && all.length) {
          const earliest = all.reduce((m, r) => (r.sent_at < m ? r.sent_at : m), all[0].sent_at);
          const replies: Array<{ phone: string; created_at: string }> = [];
          let rf = 0;
          while (true) {
            const { data, error } = await supabase
              .from("whatsapp_messages")
              .select("phone, created_at")
              .eq("direction", "inbound")
              .gte("created_at", earliest)
              .order("created_at", { ascending: true })
              .range(rf, rf + PAGE - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            replies.push(...(data as any[]));
            if (data.length < PAGE) break;
            rf += PAGE;
          }
          if (cancel) return;
          setReplyPhones(replies);
        } else {
          setReplyPhones([]);
        }
      } catch (e: any) {
        if (!cancel) setError(e.message || "Failed to load preview");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, journeyId, targetNodeId, isReplyCond]);

  const evaluation = useMemo(() => {
    const now = Date.now();
    // Precompute reply set by last-10 digits with timestamps
    const repliesByPhone = new Map<string, string[]>();
    if (isReplyCond) {
      for (const r of replyPhones) {
        const k = last10(r.phone);
        if (!k) continue;
        const arr = repliesByPhone.get(k) || [];
        arr.push(r.created_at);
        repliesByPhone.set(k, arr);
      }
    }
    // Evaluate every row first, then dedupe by contact_id keeping the best (matched) result.
    // This avoids dropping contacts whose latest send is queued/sending while an earlier send was Read.
    const perRow: Array<{ row: LogRow; windowEnd: Date; matched: boolean; windowClosed: boolean; matchedAt?: Date }> = [];
    for (const row of rows) {
      const sent = new Date(row.sent_at).getTime();
      const winEnd = sent + windowMs;
      const windowClosed = now >= winEnd;
      let conditionMet = false;
      let matchedAt: Date | undefined;
      if (isReplyCond) {
        const k = last10(row.journey_contacts?.phone || "");
        const arr = repliesByPhone.get(k) || [];
        for (const ts of arr) {
          const t = new Date(ts).getTime();
          if (t > sent && t <= winEnd) { conditionMet = true; matchedAt = new Date(t); break; }
        }
      } else if (POSITIVE.has(baseCond)) {
        // Prefer per-event timestamp so the window is honored.
        const evTs = eventTsFor(events, row.twilio_message_sid, baseCond);
        if (evTs) {
          const t = new Date(evTs).getTime();
          if (t >= sent && t <= winEnd) { conditionMet = true; matchedAt = new Date(t); }
        } else if (baseCond !== "read") {
          // Legacy fallback for non-read targets when event row is missing.
          // We cannot know the actual delivered/failed time, so we conservatively
          // accept only if window is already closed (current status is durable).
          conditionMet = windowClosed && statusReached(row, baseCond);
        }
      }
      const matched = isNegative
        ? windowClosed && !conditionMet
        : conditionMet;
      perRow.push({ row, windowEnd: new Date(winEnd), matched, windowClosed, matchedAt });
    }
    // Dedupe by contact_id: prefer a matched row; otherwise keep the most recent (rows already desc sorted).
    const byContact = new Map<string, { row: LogRow; windowEnd: Date; matched: boolean; windowClosed: boolean; matchedAt?: Date }>();
    for (const entry of perRow) {
      const cid = entry.row.contact_id;
      if (!cid) continue;
      const existing = byContact.get(cid);
      if (!existing) { byContact.set(cid, entry); continue; }
      if (!existing.matched && entry.matched) byContact.set(cid, entry);
    }
    return Array.from(byContact.values());
  }, [rows, replyPhones, events, isReplyCond, isNegative, baseCond, windowMs]);

  const matched = evaluation.filter((e) => e.matched);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Audience Preview</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{targetLabel}</span>{" "}
            <Badge variant="outline" className="ml-1">{condition}</Badge>
            <span className="ml-2">within {waitValue} {waitUnit}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Evaluating…
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-destructive">{error}</div>
          ) : (
            <>
              <div className="mb-3">
                <span className="text-lg font-semibold text-green-600">{matched.length}</span>{" "}
                <span className="text-muted-foreground">of {evaluation.length} sent recipients would route to <b>Yes</b> right now.</span>
              </div>
              <div className="overflow-auto border rounded-md max-h-[55vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead>Matched At</TableHead>
                      <TableHead>Window Ends</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matched.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        No contacts match yet. The upstream template may not have been sent, or no recipient satisfies the condition within the window.
                      </TableCell></TableRow>
                    ) : (
                      matched.map(({ row, windowEnd, matchedAt }) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.journey_contacts?.name || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{row.journey_contacts?.phone || "—"}</TableCell>
                          <TableCell className="text-xs">{format(new Date(row.sent_at), "dd MMM yyyy HH:mm")}</TableCell>
                          <TableCell className="text-xs">{matchedAt ? format(matchedAt, "dd MMM yyyy HH:mm") : "—"}</TableCell>
                          <TableCell className="text-xs">{format(windowEnd, "dd MMM yyyy HH:mm")}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MessageResponseAudiencePreviewDialog;