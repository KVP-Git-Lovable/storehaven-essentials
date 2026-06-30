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

function reachedStatus(row: LogRow, target: string): boolean {
  const s = String(row.status || "").toLowerCase();
  const d = String(row.delivery_status || "").toLowerCase();
  if (target === "delivered") return ["delivered", "read"].includes(s) || ["delivered", "read"].includes(d);
  if (target === "read") return s === "read" || d === "read";
  if (target === "failed") return s === "failed" || d === "failed";
  if (target === "undelivered") return s === "undelivered" || d === "undelivered";
  return false;
}

export function MessageResponseAudiencePreviewDialog({
  open, onOpenChange, journeyId, targetNodeId, targetLabel, condition, waitValue, waitUnit,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [replyPhones, setReplyPhones] = useState<Array<{ phone: string; created_at: string }>>([]);
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

        // 2) Inbound replies if needed
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
    const perRow: Array<{ row: LogRow; windowEnd: Date; matched: boolean; windowClosed: boolean }> = [];
    for (const row of rows) {
      const sent = new Date(row.sent_at).getTime();
      const winEnd = sent + windowMs;
      const windowClosed = now >= winEnd;
      let conditionMet = false;
      if (isReplyCond) {
        const k = last10(row.journey_contacts?.phone || "");
        const arr = repliesByPhone.get(k) || [];
        conditionMet = arr.some((ts) => {
          const t = new Date(ts).getTime();
          return t > sent && t <= winEnd;
        });
      } else if (POSITIVE.has(baseCond)) {
        conditionMet = reachedStatus(row, baseCond);
      }
      const matched = isNegative
        ? windowClosed && !conditionMet
        : conditionMet;
      perRow.push({ row, windowEnd: new Date(winEnd), matched, windowClosed });
    }
    // Dedupe by contact_id: prefer a matched row; otherwise keep the most recent (rows already desc sorted).
    const byContact = new Map<string, { row: LogRow; windowEnd: Date; matched: boolean; windowClosed: boolean }>();
    for (const entry of perRow) {
      const cid = entry.row.contact_id;
      if (!cid) continue;
      const existing = byContact.get(cid);
      if (!existing) { byContact.set(cid, entry); continue; }
      if (!existing.matched && entry.matched) byContact.set(cid, entry);
    }
    return Array.from(byContact.values());
  }, [rows, replyPhones, isReplyCond, isNegative, baseCond, windowMs]);

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
                      <TableHead>Current Status</TableHead>
                      <TableHead>Window Ends</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matched.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        No contacts match yet. The upstream template may not have been sent, or no recipient satisfies the condition within the window.
                      </TableCell></TableRow>
                    ) : (
                      matched.map(({ row, windowEnd }) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.journey_contacts?.name || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{row.journey_contacts?.phone || "—"}</TableCell>
                          <TableCell className="text-xs">{format(new Date(row.sent_at), "dd MMM yyyy HH:mm")}</TableCell>
                          <TableCell className="text-xs capitalize">{row.delivery_status || row.status || "—"}</TableCell>
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