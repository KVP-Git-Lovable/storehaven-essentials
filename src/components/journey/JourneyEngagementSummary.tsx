import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Send, CheckCircle2, Eye, MousePointer, AlertTriangle, TrendingUp } from "lucide-react";
import { useJourneyEngagement } from "@/hooks/useJourneyEngagement";

export default function JourneyEngagementSummary({
  journeyId,
  isActive,
}: {
  journeyId: string;
  isActive: boolean;
}) {
  const { data, isLoading } = useJourneyEngagement(journeyId, isActive);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Loading engagement…
        </CardContent>
      </Card>
    );
  }

  const c = data?.counts || { sent: 0, delivered: 0, read: 0, clicked: 0, failed: 0 };
  const tiles = [
    { label: "Sent", value: c.sent, Icon: Send, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Delivered", value: c.delivered, Icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
    { label: "Read", value: c.read, Icon: Eye, color: "text-purple-600", bg: "bg-purple-100" },
    { label: "Clicked", value: c.clicked, Icon: MousePointer, color: "text-orange-600", bg: "bg-orange-100" },
    { label: "Failed", value: c.failed, Icon: AlertTriangle, color: "text-destructive", bg: "bg-red-100" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            WhatsApp Engagement Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {tiles.map((t) => {
              const Icon = t.Icon;
              return (
                <div key={t.label} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded ${t.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${t.color}`} />
                    </div>
                    <span className="text-xs text-muted-foreground">{t.label}</span>
                  </div>
                  <p className="text-2xl font-bold">{t.value.toLocaleString("en-IN")}</p>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 p-3">
            <div>
              <p className="text-xs text-muted-foreground">Recipients with events</p>
              <p className="text-lg font-semibold">{(data?.recipientCount || 0).toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Average Engagement Score</p>
              <p className="text-lg font-semibold">{(data?.avgScore || 0).toFixed(1)}</p>
            </div>
            <div className="text-xs text-muted-foreground ml-auto">
              Sent +1 · Delivered +2 · Read +5 · Clicked +10 · Failed −2
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Top Engaged Recipients</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right">Delivered %</TableHead>
              <TableHead className="text-right">Read %</TableHead>
              <TableHead className="text-right">Click %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.topRecipients?.length || 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                  No engagement events yet
                </TableCell>
              </TableRow>
            ) : (
              data!.topRecipients.map((r) => (
                <TableRow key={`${r.person_id}-${r.entity_type}`}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{r.entity_type}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{r.score}</TableCell>
                  <TableCell className="text-right">{r.deliveredPct.toFixed(0)}%</TableCell>
                  <TableCell className="text-right">{r.readPct.toFixed(0)}%</TableCell>
                  <TableCell className="text-right">{r.clickPct.toFixed(0)}%</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
