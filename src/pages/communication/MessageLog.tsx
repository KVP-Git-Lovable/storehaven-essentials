import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";

export default function MessageLog() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["whatsapp-message-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_message_log")
        .select("*, whatsapp_templates(name)")
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "delivered": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "sent": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "failed": return "bg-destructive/10 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Message Log</h1>
        <p className="text-muted-foreground">History of WhatsApp messages sent via templates</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>To Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message SID</TableHead>
                <TableHead>Sent At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-muted-foreground">No messages sent yet</p>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {log.whatsapp_templates?.name || "Unknown"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{log.to_number}</TableCell>
                    <TableCell>
                      <Badge className={statusColor(log.status)}>{log.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {log.twilio_message_sid || "—"}
                      </code>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(log.sent_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
