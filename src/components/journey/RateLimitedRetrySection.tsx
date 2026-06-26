import { useState, useMemo, useSyncExternalStore, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, RotateCw, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import {
  getRetryJob,
  subscribeRetryJob,
  startRetryJob,
  resetRetryJob,
} from "@/lib/retryRunner";

interface FailedRow {
  id: string;
  node_id: string | null;
  contact_id: string | null;
  person_key: string;
  error_message: string | null;
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

export default function RateLimitedRetrySection({ journeyId }: { journeyId: string }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Subscribe to the module-level retry runner so an in-flight batch keeps
  // running (and its progress remains visible) across navigation/unmounts.
  const jobKey = `rate-limited:${journeyId}`;
  const job = useSyncExternalStore(
    useCallback((cb) => subscribeRetryJob(jobKey, cb), [jobKey]),
    useCallback(() => getRetryJob(jobKey), [jobKey]),
    useCallback(() => getRetryJob(jobKey), [jobKey]),
  );
  const isRetrying = job.isRunning;
  const countdown = job.countdown;
  const statuses = job.statuses;

  const { data: rows = [], isLoading, refetch } = useQuery<FailedRow[]>({
    queryKey: ["journey-rate-limited-failures", journeyId],
    queryFn: async () => {
      // 1. Paginate ALL rate-limited failure rows (bypasses PostgREST 1000-row cap).
      //    Join contact phone up-front so duplicate journey_contact rows for the
      //    same mobile number collapse into one actual user.
      const list: any[] = [];
      const PAGE = 1000;
      for (let from = 0; from < 200_000; from += PAGE) {
        const { data, error } = await supabase
          .from("journey_message_log")
          .select("id, node_id, contact_id, error_message, sent_at, journey_contacts(id, name, phone)")
          .eq("journey_id", journeyId)
          .eq("status", "failed")
          .ilike("error_message", "%Rate limit%")
          .order("sent_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = data || [];
        list.push(...batch);
        if (batch.length < PAGE) break;
      }

      // 2. Dedupe to ONE row per actual person/mobile number. A contact who
      //    failed several times or was re-enrolled under a new contact_id only
      //    needs one retry entry.
      const latestByPerson = new Map<string, any>();
      for (const l of list) {
        const key = personKey(l);
        const prev = latestByPerson.get(key);
        if (!prev || new Date(l.sent_at).getTime() > new Date(prev.sent_at).getTime()) {
          latestByPerson.set(key, l);
        }
      }
      if (latestByPerson.size === 0) return [];

      // 3. Fetch all successful journey sends and exclude any person who has
      //    already received/accepted at least one message in this journey.
      //    This section is specifically for users for whom no WhatsApp message
      //    was sent because of a rate-limit failure.
      const successByPerson = new Set<string>();
      for (let from = 0; from < 200_000; from += PAGE) {
        const { data, error } = await supabase
          .from("journey_message_log")
          .select("id, contact_id, status, delivery_status, journey_contacts(id, phone)")
          .eq("journey_id", journeyId)
          .or("status.in.(accepted,queued,sending,scheduled,sent,delivered,read),delivery_status.in.(accepted,queued,sending,scheduled,sent,delivered,read)")
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) {
          console.error("[RateLimitedRetry] success fetch error", error);
          break;
        }
        const batch = data || [];
        for (const s of batch) if (isSuccessfulLog(s)) successByPerson.add(personKey(s));
        if (batch.length < PAGE) break;
      }
      const stillFailing = Array.from(latestByPerson.entries())
        .filter(([key]) => !successByPerson.has(key))
        .map(([key, row]) => ({ ...row, person_key: key }));

      // 4. Hydrate names/phones in batches only for rows where the join did
      //    not return contact details.
      const finalIds = stillFailing.filter((l) => !l.journey_contacts).map((l) => l.contact_id).filter(Boolean);
      let contactMap: Record<string, { name: string | null; phone: string | null }> = {};
      const CHUNK = 200;
      for (let i = 0; i < finalIds.length; i += CHUNK) {
        const slice = finalIds.slice(i, i + CHUNK);
        const { data: contacts, error: cErr } = await supabase
          .from("journey_contacts")
          .select("id, name, phone")
          .in("id", slice);
        if (cErr) {
          console.error("[RateLimitedRetry] contacts fetch error", cErr);
          continue;
        }
        for (const c of contacts || []) contactMap[c.id] = { name: c.name, phone: c.phone };
      }
      return stillFailing.map((l: any) => ({
        id: l.id,
        node_id: l.node_id,
        contact_id: l.contact_id,
        person_key: l.person_key,
        error_message: l.error_message,
        sent_at: l.sent_at,
        contact_name: l.journey_contacts?.name ?? contactMap[l.contact_id]?.name ?? null,
        contact_phone: l.journey_contacts?.phone ?? contactMap[l.contact_id]?.phone ?? null,
      }));
    },
    enabled: !!journeyId,
  });

  // Merge: while a batch is running (or just finished), include snapshot rows
  // so they remain visible even if the underlying query has been refetched /
  // the user navigated away and back before completion.
  const displayRows = useMemo<FailedRow[]>(() => {
    const byId = new Map<string, FailedRow>();
    for (const r of rows) byId.set(r.id, r);
    for (const id of job.queueIds) {
      if (!byId.has(id) && job.rowSnapshots[id]) {
        byId.set(id, job.rowSnapshots[id] as FailedRow);
      }
    }
    // Keep queued rows first (in original order) so the running batch stays
    // pinned to the top during navigation returns.
    const queuedOrdered = job.queueIds.map((id) => byId.get(id)).filter(Boolean) as FailedRow[];
    const queuedSet = new Set(job.queueIds);
    const rest = rows.filter((r) => !queuedSet.has(r.id));
    return [...queuedOrdered, ...rest];
  }, [rows, job.queueIds, job.rowSnapshots]);

  const allSelected = displayRows.length > 0 && displayRows.every((r) => selected.has(r.id));
  const someSelected = displayRows.some((r) => selected.has(r.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(displayRows.map((r) => r.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const queue = useMemo(() => displayRows.filter((r) => selected.has(r.id)), [displayRows, selected]);

  async function runRetries() {
    if (queue.length === 0) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      toast({ title: "Not signed in", variant: "destructive" });
      return;
    }
    const snapshot = queue.map((q) => ({ ...q }));
    setSelected(new Set());
    void startRetryJob(jobKey, {
      rows: snapshot,
      spacingMs: SPACING_MS,
      send: async (row) => {
        const { data, error } = await supabase.functions.invoke("retry-journey-message", {
          body: { message_log_id: row.id },
        });
        if (error) throw new Error(error.message);
        return { success: !!data?.success, error: data?.error };
      },
      onComplete: (totals) => {
        toast({
          title: "Retry batch complete",
          description: `${totals.sent} sent, ${totals.failed} failed.`,
        });
        queryClient.invalidateQueries({ queryKey: ["journey-rate-limited-failures", journeyId] });
        queryClient.invalidateQueries({ queryKey: ["ja-messages", journeyId] });
        queryClient.invalidateQueries({ queryKey: ["ja-enroll", journeyId] });
        queryClient.invalidateQueries({ queryKey: ["ja-events", journeyId] });
      },
    });
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Rate-limited Failures</CardTitle></CardHeader>
        <CardContent className="py-6 text-sm text-muted-foreground text-center">Loading…</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Rate-limited Failures
            <Badge variant="secondary">{displayRows.length}</Badge>
            {isRetrying && (
              <Badge variant="outline" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Retrying {Object.values(statuses).filter((s) => s.state === "success" || s.state === "failed").length}/{job.queueIds.length}
              </Badge>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Contacts whose message failed with "Rate limit exceeded". Retry sends one message every 12 seconds.
            {" "}You can leave this page — the batch keeps running and progress is restored when you return.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRetrying && countdown !== null && (
            <span className="text-xs text-muted-foreground">Next in {countdown}s…</span>
          )}
          {!isRetrying && job.queueIds.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => resetRetryJob(jobKey)}>
              Clear results
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRetrying}>
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={runRetries}
            disabled={isRetrying || queue.length === 0}
            className="gap-1.5"
          >
            {isRetrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
            Retry selected ({queue.length})
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {displayRows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No rate-limited failures for this journey. 🎉
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                    disabled={isRetrying}
                    className={!allSelected && someSelected ? "data-[state=unchecked]:bg-primary/30" : ""}
                  />
                </TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Failed at</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Retry status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((r) => {
                const st = statuses[r.id]?.state || "idle";
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleOne(r.id)}
                        disabled={isRetrying}
                        aria-label="Select row"
                      />
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
                      {st === "sending" && (
                        <Badge variant="outline" className="gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Sending
                        </Badge>
                      )}
                      {st === "success" && (
                        <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100">
                          <CheckCircle2 className="h-3 w-3" /> Sent
                        </Badge>
                      )}
                      {st === "failed" && (
                        <Badge variant="destructive" className="gap-1" title={statuses[r.id]?.error}>
                          <XCircle className="h-3 w-3" /> Failed
                        </Badge>
                      )}
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