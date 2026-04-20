import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  listViewId: string | null;
  listViewName?: string;
}

export function AudiencePreviewDialog({ open, onOpenChange, listViewId, listViewName }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !listViewId) return;
    setLoading(true);
    setError(null);
    supabase.functions
      .invoke("list-view-resolve", { body: { list_view_id: listViewId, mode: "rows" } })
      .then(({ data, error }) => {
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setRows((data?.rows || []).slice(0, 10));
        setCount(data?.count ?? 0);
      })
      .catch((e) => setError(e.message || "Failed to load preview"))
      .finally(() => setLoading(false));
  }, [open, listViewId]);

  const columns = rows.length > 0 ? Object.keys(rows[0]).filter((k) => !["id", "created_at", "updated_at"].includes(k)).slice(0, 5) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Audience Preview
            {listViewName && <Badge variant="outline">{listViewName}</Badge>}
            {count !== null && <Badge variant="secondary">{count} total</Badge>}
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
                  {columns.map((c) => <TableHead key={c} className="capitalize">{c.replace(/_/g, " ")}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    {columns.map((c) => <TableCell key={c} className="text-xs">{r[c] == null ? "—" : String(r[c])}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Showing first 10 of {count ?? 0} records evaluated at runtime.</p>
      </DialogContent>
    </Dialog>
  );
}
