import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, Copy, Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { useJourneyMessageLogs, JourneyLogRow } from "@/hooks/useJourneyMessageLogs";
import { describeTwilioError } from "@/lib/twilioErrors";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-slate-100 text-slate-700",
  queued: "bg-slate-100 text-slate-700",
  sending: "bg-slate-100 text-slate-700",
  delivered: "bg-emerald-100 text-emerald-700",
  read: "bg-blue-100 text-blue-700",
  clicked: "bg-violet-100 text-violet-700",
  failed: "bg-red-100 text-red-700",
  undelivered: "bg-amber-100 text-amber-800",
};

const STATUS_FILTERS = ["all", "sent", "delivered", "read", "clicked", "failed", "undelivered", "sending"];

function csvEscape(v: any): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function JourneyLogsDialog({
  open,
  onOpenChange,
  journeyId,
  journeyName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  journeyId: string;
  journeyName?: string;
}) {
  const { data: rows = [], isLoading } = useJourneyMessageLogs(journeyId, open);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        (r.sid || "").toLowerCase().includes(q) ||
        r.body.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [rows]);

  const downloadCsv = () => {
    const header = ["Username", "Phone", "Message", "Status", "Reason", "Sent At", "SID"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push(
        [
          r.name,
          r.phone,
          r.body.replace(/\s+/g, " ").trim(),
          r.status,
          describeTwilioError(r.error_code, r.error_message),
          format(new Date(r.sent_at), "yyyy-MM-dd HH:mm:ss"),
          r.sid || "",
        ]
          .map(csvEscape)
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `journey-${journeyId}-logs.csv`;
    a.click();
  };

  const copySid = (sid: string) => {
    navigator.clipboard.writeText(sid);
    toast.success("SID copied");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-7xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex flex-wrap items-center gap-3">
            <span>Message Logs</span>
            {journeyName && <span className="text-sm font-normal text-muted-foreground">· {journeyName}</span>}
            <Badge variant="secondary" className="ml-auto">{filtered.length.toLocaleString("en-IN")} of {rows.length.toLocaleString("en-IN")}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-3 flex flex-col sm:flex-row gap-2 border-b bg-muted/30">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, SID, body…"
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? `All (${rows.length})` : `${s[0].toUpperCase()}${s.slice(1)} (${counts[s] || 0})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-60 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading logs…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-60 text-muted-foreground text-sm">
              No log entries match the current filters.
            </div>
          ) : (
            <TooltipProvider delayDuration={200}>
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="min-w-[160px]">Username</TableHead>
                    <TableHead className="min-w-[140px]">Phone</TableHead>
                    <TableHead className="min-w-[260px]">Message</TableHead>
                    <TableHead className="min-w-[120px]">Status</TableHead>
                    <TableHead className="min-w-[220px]">Reason</TableHead>
                    <TableHead className="min-w-[150px]">Sent At</TableHead>
                    <TableHead className="min-w-[160px]">SID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r: JourneyLogRow) => {
                    const reason = describeTwilioError(r.error_code, r.error_message);
                    const short = r.body.length > 90 ? r.body.slice(0, 90) + "…" : r.body;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="font-mono text-xs">{r.phone}</TableCell>
                        <TableCell className="text-xs">
                          {r.body ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help whitespace-pre-line">{short}</span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md whitespace-pre-line text-xs">
                                {r.body}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={`capitalize ${STATUS_STYLES[r.status] || "bg-slate-100 text-slate-700"} hover:opacity-90`}>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {reason || <span className="text-muted-foreground/60">—</span>}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(r.sent_at), "dd MMM yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="font-mono text-[11px]">
                          {r.sid ? (
                            <button
                              onClick={() => copySid(r.sid!)}
                              className="inline-flex items-center gap-1 hover:text-primary"
                              title="Copy SID"
                            >
                              {r.sid.slice(0, 10)}…<Copy className="h-3 w-3" />
                            </button>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}