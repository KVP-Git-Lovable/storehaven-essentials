import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle } from "lucide-react";

interface Props {
  journeyId: string;
  canvas: any;
}

const CONDITION_LABELS: Record<string, string> = {
  delivered: "Delivered",
  not_delivered: "Not Delivered",
  read: "Read",
  not_read: "Not Read",
  replied: "Replied",
  not_replied: "Not Replied",
  failed: "Failed",
  undelivered: "Undelivered",
};

export function MessageResponseAnalytics({ journeyId, canvas }: Props) {
  const responseNodes = (canvas?.nodes || []).filter((n: any) => n.type === "message_response");

  const { data: rows = [] } = useQuery({
    queryKey: ["message-response-analytics", journeyId],
    enabled: !!journeyId && responseNodes.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journey_message_log")
        .select("node_id, status")
        .eq("journey_id", journeyId)
        .eq("channel", "message_response");
      if (error) throw error;
      return data || [];
    },
  });

  if (responseNodes.length === 0) return null;

  const stats: Record<string, { yes: number; no: number }> = {};
  for (const r of rows as any[]) {
    const s = (stats[r.node_id] ||= { yes: 0, no: 0 });
    if (r.status === "yes") s.yes++;
    else s.no++;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-teal-600" />
          Message Response Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {responseNodes.map((n: any) => {
          const d: any = n.data || {};
          const s = stats[n.id] || { yes: 0, no: 0 };
          const total = s.yes + s.no;
          const pct = total ? ((s.yes / total) * 100).toFixed(1) : "0.0";
          return (
            <div key={n.id} className="border rounded-md p-3">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="text-sm font-medium">
                  {d.target_node_label || "Untitled template"}{" "}
                  <Badge variant="outline" className="ml-1">{CONDITION_LABELS[d.condition] || d.condition || "—"}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Wait: {Number(d.wait_value ?? 0)} {String(d.wait_unit ?? "hours")}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div><div className="text-lg font-semibold">{total}</div><div className="text-[11px] text-muted-foreground">Evaluated</div></div>
                <div><div className="text-lg font-semibold text-green-600">{s.yes}</div><div className="text-[11px] text-muted-foreground">Matched</div></div>
                <div><div className="text-lg font-semibold text-red-600">{s.no}</div><div className="text-[11px] text-muted-foreground">Unmatched</div></div>
                <div><div className="text-lg font-semibold">{pct}%</div><div className="text-[11px] text-muted-foreground">Match Rate</div></div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default MessageResponseAnalytics;