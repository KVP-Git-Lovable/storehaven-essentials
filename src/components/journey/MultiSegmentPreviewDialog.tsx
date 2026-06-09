function normalizePhone(p: any): string | null {
  if (!p) return null;
  const digits = String(p).replace(/\D/g, "");
  if (!digits) return null;
  // Match backend normalizeE164 loosely: keep last 10-15 digits
  return digits.length > 10 ? digits.slice(-10) : digits;
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

type Segment = { key: string; label?: string; list_view_id: string };
type AudienceConfig = {
  segments?: Segment[];
  combinator?: string;
  primary?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  audienceConfig: AudienceConfig | null | undefined;
}

function combine(perSegment: Record<string, string[]>, cfg: AudienceConfig): string[] {
  const segs = cfg.segments || [];
  if (segs.length === 0) return [];
  if (segs.length === 1) return Array.from(new Set(perSegment[segs[0].key] || []));
  const a = new Set(perSegment[segs[0].key] || []);
  const b = new Set(perSegment[segs[1].key] || []);
  const combinator = cfg.combinator || "union";
  const primary = cfg.primary || segs[0].key;
  switch (combinator) {
    case "intersection": return Array.from(a).filter((x) => b.has(x));
    case "difference": {
      const p = primary === segs[1].key ? b : a;
      const o = primary === segs[1].key ? a : b;
      return Array.from(p).filter((x) => !o.has(x));
    }
    case "only_a": return Array.from(a);
    case "only_b": return Array.from(b);
    case "union":
    default: return Array.from(new Set([...a, ...b]));
  }
}

export function MultiSegmentPreviewDialog({ open, onOpenChange, audienceConfig }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !audienceConfig?.segments?.length) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const perSegmentIds: Record<string, string[]> = {};
        const rowsById: Record<string, any> = {};
        for (const seg of audienceConfig.segments!) {
          // Resolve via edge function (service-role) so RLS on list_views doesn't
          // block users who didn't create the saved view. Pass list_view_id directly.
          const { data, error } = await supabase.functions.invoke("list-view-resolve", {
            body: { list_view_id: seg.list_view_id, mode: "rows" },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          const segRows: any[] = data?.rows || [];
          const keys: string[] = [];
          for (const r of segRows) {
            // Prefer phone as the combine key (matches backend audience-preview counts).
            // Fallback to id if phone is missing (e.g., orders list views).
            const key = normalizePhone(r?.phone) || (r?.id ? `id:${r.id}` : null);
            if (!key) continue;
            keys.push(key);
            if (!rowsById[key]) rowsById[key] = r;
          }
          perSegmentIds[seg.key] = keys;
        }
        const finalIds = combine(perSegmentIds, audienceConfig);
        const finalRows = finalIds.map((id) => rowsById[id]).filter(Boolean);
        if (!cancelled) {
          setTotal(finalRows.length);
          setRows(finalRows.slice(0, 50));
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, JSON.stringify(audienceConfig || {})]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Audience Preview
            <Badge variant="outline">Multi-segment</Badge>
            <Badge variant="secondary">{total} total</Badge>
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Resolving audience...
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-4">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No matching records.</p>
        ) : (
          <div className="max-h-[400px] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>City</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.id || i}>
                    <TableCell className="text-xs">{r.name || r.full_name || "—"}</TableCell>
                    <TableCell className="text-xs">{r.phone || "—"}</TableCell>
                    <TableCell className="text-xs">{r.email || "—"}</TableCell>
                    <TableCell className="text-xs">{r.city || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Showing first {Math.min(50, total)} of {total} combined records.</p>
      </DialogContent>
    </Dialog>
  );
}
