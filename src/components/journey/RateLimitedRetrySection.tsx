import { useState, useMemo } from "react";
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

type RetryStatus = "idle" | "queued" | "sending" | "success" | "failed";

interface FailedRow {
  id: string;
  node_id: string | null;
  contact_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  contact_name: string | null;
  contact_phone: string | null;
}

const SPACING_MS = 45_000;

export default function RateLimitedRetrySection({ journeyId }: { journeyId: string }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, { state: RetryStatus; error?: string }>>({});
  const [isRetrying, setIsRetrying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const { data: rows = [], isLoading, refetch } = useQuery<FailedRow[]>({
    queryKey: ["journey-rate-limited-failures", journeyId],
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from("journey_message_log")
        .select("id, node_id, contact_id, error_message, sent_at")
        .eq("journey_id", journeyId)
        .eq("status", "failed")
        .ilike("error_message", "%Rate limit%")
        .order("sent_at", { ascending: false });
      if (error) throw error;
      const list = logs || [];
      const contactIds = Array.from(new Set(list.map((l: any) => l.contact_id).filter(Boolean)));
      let contactMap: Record<string, { name: string | null; phone: string | null }> = {};
      if (contactIds.length) {
        const { data: contacts } = await supabase
          .from("journey_contacts")
          .select("id, name, phone")
          .in("id", contactIds);
        for (const c of contacts || []) contactMap[c.id] = { name: c.name, phone: c.phone };
      }
      return list.map((l: any) => ({
        id: l.id,
        node_id: l.node_id,
        contact_id: l.contact_id,
        error_message: l.error_message,
        sent_at: l.sent_at,
        contact_name: contactMap[l.contact_id]?.name ?? null,
        contact_phone: contactMap[l.contact_id]?.phone ?? null,
      }));
    },
    enabled: !!journeyId,
  });

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = rows.some((r) => selected.has(r.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const queue = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);

  async function runRetries() {
    if (queue.length === 0) return;
    setIsRetrying(true);
    const initial: Record<string, { state: RetryStatus }> = {};
    queue.forEach((q) => (initial[q.id] = { state: "queued" }));
    setStatuses((s) => ({ ...s, ...initial }));

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      toast({ title: "Not signed in", variant: "destructive" });
      setIsRetrying(false);
      return;
    }

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

      // Space sends by SPACING_MS, except after the last one
      if (i < queue.length - 1) {
        const startedAt = Date.now();
        const target = startedAt + SPACING_MS;
        while (Date.now() < target) {
          const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
          setCountdown(remaining);
          await new Promise((r) => setTimeout(r, 1000));
        }
        setCountdown(null);
      }
    }
    setIsRetrying(false);
    setCountdown(null);
    toast({
      title: "Retry batch complete",
      description: `${sent} sent, ${failed} failed.`,
    });
    queryClient.invalidateQueries({ queryKey: ["journey-rate-limited-failures", journeyId] });
    setSelected(new Set());
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
            <Badge variant="secondary">{rows.length}</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Contacts whose message failed with "Rate limit exceeded". Retry sends one message every 45 seconds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRetrying && countdown !== null && (
            <span className="text-xs text-muted-foreground">Next in {countdown}s…</span>
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
        {rows.length === 0 ? (
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
              {rows.map((r) => {
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