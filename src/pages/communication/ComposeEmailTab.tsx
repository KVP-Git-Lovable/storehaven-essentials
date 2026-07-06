import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const FROM_EMAIL = "info@quickapp.ai";

interface EmailLogRow {
  id: string;
  to_email: string;
  subject: string;
  status: string;
  sent_at: string;
}

export function ComposeEmailTab() {
  const queryClient = useQueryClient();
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["email-message-log"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("email_message_log")
        .select("id, to_email, subject, status, sent_at")
        .order("sent_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as EmailLogRow[];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const trimmedTo = toEmail.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedTo)) {
        throw new Error("Enter a valid recipient email address");
      }
      if (!subject.trim()) throw new Error("Subject is required");
      if (!body.trim()) throw new Error("Body is required");

      const { data, error } = await supabase.functions.invoke("email-send", {
        body: { to_email: trimmedTo, subject: subject.trim(), body: body.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Email sent", description: `Your message was sent to ${toEmail.trim()}.` });
      setToEmail("");
      setSubject("");
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["email-message-log"] });
    },
    onError: (e: Error) => {
      toast({ title: "Could not send email", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-blue-600">
        Note: Confirm from the back-end whether the Email quota is present before attempting to send any e-mail.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" /> Compose Email
          </CardTitle>
          <CardDescription>Sent from {FROM_EMAIL} via Twilio Email API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email-to">To</Label>
            <Input id="email-to" type="email" placeholder="recipient@example.com" value={toEmail} onChange={(e) => setToEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-subject">Subject</Label>
            <Input id="email-subject" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-body">Body</Label>
            <Textarea id="email-body" placeholder="Write your message..." rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
              <Send className="h-4 w-4 mr-2" />
              {sendMutation.isPending ? "Sending..." : "Send Email"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Emails</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => (<Skeleton key={i} className="h-10 w-full" />))}</div>
          ) : logs && logs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>To</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.to_email}</TableCell>
                    <TableCell>{log.subject}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === "sent" ? "default" : "destructive"}>{log.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(log.sent_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">No emails sent yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ComposeEmailTab;
