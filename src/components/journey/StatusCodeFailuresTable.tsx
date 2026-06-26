import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RotateCw, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

type RetryStatus = "idle" | "queued" | "sending" | "success" | "failed";

interface FailedRow {
  id: string;
  contact_id: string | null;
  person_key: string;
  error_message: string | null;
  error_code: string | null;
  sent_at: string | null;
  contact_name: string | null;
  contact_phone: string | null;
}

const SPACING_MS = 12_000;
const SUCCESS_STATUSES = new Set(["accepted", "queued", "sending", "scheduled", "sent", "delivered", "read"]);

function last10(phone: unknown) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}
function personKey(row: any) {
  const p = last10(row?.journey_contacts?.phone);
  if (p) return `p:${p}`;
  if (row?.contact_id) return `c:${row.contact_id}`;
  return `l:${row?.id}`;
}
function isSuccessfulLog(row: any) {
  const status = String(row?.status || "").toLowerCase();
  const delivery = String(row?.delivery_status || "").toLowerCase();
  return SUCCESS_STATUSES.has(status) || SUCCESS_STATUSES.has(delivery);
}

export default function StatusCodeFailuresTable({
  journeyId,
  errorCode,
}: {
  journeyId: string;
  errorCode: string;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, { state: RetryStatus; error?: string }>>({});
  const [isRetrying, setIsRetrying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const { data: rows = [], isLoading, refetch } = useQuery<FailedRow[]>({
    queryKey: ["journey-status-code-failures", journeyId, errorCode],
    queryFn: async () => {
      const list: any[] = [];
      const PAGE = 1000;
      for (let from = 0; from < 200_000; from += PAGE) {
        const { data, error } = await supabase
          .from("journey_message_log")
          .select("id, contact_id, status, delivery_status, error_message, error_code, sent_at, journey_contacts(id, name, phone)")
          .eq("journey_id", journeyId)
          .eq("error_code", errorCode)
          .order("sent_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = data || [];
        // Twilio stores 63049/63024 as status='undelivered' (delivery_status='failed').
        // Some rows with this error_code later resolve to status='sent'/'delivered' —
        // exclude those here; the per-person success exclusion below also catches them.
        for (const r of batch) if (!isSuccessfulLog(r)) list.push(r);
        if (batch.length < PAGE) break;
      }

      const latestByPerson = new Map<string, any>();
      for (const l of list) {
        const key = personKey(l);
        const prev = latestByPerson.get(key);
        if (!prev || new Date(l.sent_at).getTime() > new Date(prev.sent_at).getTime()) {
          latestByPerson.set(key, l);
        }
      }
      if (latestByPerson.size === 0) return [];

      // Exclude contacts who later received a successful message in this journey.
      const successByPerson = new Set<string>();
      for (let from = 0; from < 200_000; from += PAGE) {
        const { data, error } = await supabase
          .from("journey_message_log")
          .select("id, contact_id, status, delivery_status, journey_contacts(id, phone)")
          .eq("journey_id", journeyId)
          .or("status.in.(accepted,queued,sending,scheduled,sent,delivered,read),delivery_status.in.(accepted,queued,sending,scheduled,sent,delivered,read)")
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) break;
        const batch = data || [];
        for (const s of batch) if (isSuccessfulLog(s)) successByPerson.add(personKey(s));
        if (batch.length < PAGE) break;
      }

      const stillFailing = Array.from(latestByPerson.entries())
        .filter(([key]) => !successByPerson.has(key))
        .map(([key, row]) => ({ ...row, person_key: key }));

      const finalIds = stillFailing.filter((l) => !l.journey_contacts).map((l) => l.contact_id).filter(Boolean);
      const contactMap: Record<string, { name: string | null; phone: string | null }> = {};
      const CHUNK = 200;
      for (let i = 0; i < finalIds.length; i += CHUNK) {
        const slice = finalIds.slice(i, i + CHUNK);
        const { data: contacts } = await supabase
          .from("journey_contacts")
          .select("id, name, phone")
          .in("id", slice);
        for (const c of contacts || []) contactMap[c.id] = { name: c.name, phone: c.phone };
      }
      return stillFailing.map((l: any) => ({
        id: l.id,
        contact_id: l.contact_id,
        person_key: l.person_key,
        error_message: l.error_message,
        error_code: l.error_code,
        sent_at: l.sent_at,
        contact_name: l.journey_contacts?.name ?? contactMap[l.contact_id]?.name ?? null,
        contact_phone: l.journey_contacts?.phone ?? contactMap[l.contact_id]?.phone ?? null,
      }));
    },
    enabled: !!journeyId,
  });

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = rows.some((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const queue = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);

  async function runRetries() {
    if (queue.length === 0) return;
    setIsRetrying(true);
    const initial: Record<string, { state: RetryStatus }> = {};
    queue.forEach((q) => (initial[q.id] = { state: "queued" }));
    setStatuses((s) => ({ ...s, ...initial }));

    let sent = 0, failed = 0;
    for (let i = 0; i < queue.length; i++) {
      const row = queue[i];
      setStatuses((s) => ({ ...s, [row.id]: { state: "sending" } }));
      try {
        const { data, error } = await supabase.functions.invoke("retry-journey-message", {
          body: { message_log_id: row.id },
        });
        if (error) throw new Error(error.message);
        if (data?.success) {
          setStatuses((s) => ({ ...s, [row.id]: { state: "success" } }));
          sent++;
        } else {
          setStatuses((s) => ({ ...s, [row.id]: { state: "failed", error: data?.error || "Send not accepted" } }));
          failed++;
        }
      } catch (e: any) {
        setStatuses((s) => ({ ...s, [row.id]: { state: "failed", error: e.message } }));
        failed++;
      }
      if (i < queue.length - 1) {
        const target = Date.now() + SPACING_MS;
        while (Date.now() < target) {
          setCountdown(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
          await new Promise((r) => setTimeout(r, 1000));
        }
        setCountdown(null);
      }
    }
    setIsRetrying(false);
    setCountdown(null);
    toast({ title: "Retry batch complete", description: `${sent} sent, ${failed} failed.` });
    queryClient.invalidateQueries({ queryKey: ["journey-status-code-failures", journeyId, errorCode] });
    queryClient.invalidateQueries({ queryKey: ["ja-messages", journeyId] });
    setSelected(new Set());
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{rows.length}</span> unresolved contact{rows.length === 1 ? "" : "s"} with error code <span className="font-mono">{errorCode}</span>
        </div>
        <div className="flex items-center gap-2">
          {isRetrying && countdown !== null && <span className="text-xs text-muted-foreground">Next in {countdown}s…</span>}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRetrying}>Refresh</Button>
          <Button size="sm" onClick={runRetries} disabled={isRetrying || queue.length === 0} className="gap-1.5">
            {isRetrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
            Retry selected ({queue.length})
          </Button>
        </div>
      </div>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No unresolved failures with code {errorCode}. 🎉</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" disabled={isRetrying}
                    className={!allSelected && someSelected ? "data-[state=unchecked]:bg-primary/30" : ""} />
                </TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Failed at</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Retry status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const st = statuses[r.id]?.state || "idle";
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} disabled={isRetrying} aria-label="Select row" />
                    </TableCell>
                    <TableCell className="font-medium">{r.contact_name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.contact_phone || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.sent_at ? format(new Date(r.sent_at), "MMM d, HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md truncate" title={r.error_message || ""}>
                      {r.error_message}
                    </TableCell>
                    <TableCell>
                      {st === "idle" && <span className="text-xs text-muted-foreground">—</span>}
                      {st === "queued" && <Badge variant="outline">Queued</Badge>}
                      {st === "sending" && (<Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Sending</Badge>)}
                      {st === "success" && (<Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="h-3 w-3" /> Sent</Badge>)}
                      {st === "failed" && (<Badge variant="destructive" className="gap-1" title={statuses[r.id]?.error}><XCircle className="h-3 w-3" /> Failed</Badge>)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}