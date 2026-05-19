import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Copy, Check, Save } from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface WhatsAppConfigData {
  phone_number: string;
  status: string;
  sender_sid: string;
  business_name: string;
  webhook_url: string;
  throughput: string;
  last_synced_at: string;
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b last:border-b-0">
    <span className="text-sm font-medium text-muted-foreground">{label}</span>
    <div className="text-sm">{children}</div>
  </div>
);

const WhatsAppConfig = () => {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [senderInput, setSenderInput] = useState("");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["whatsapp-config"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-config", {
        method: "GET",
      });
      if (error) throw error;
      return data as WhatsAppConfigData;
    },
  });

  // Keep input in sync with whatever the backend reports
  useEffect(() => {
    if (data?.phone_number) setSenderInput(data.phone_number);
  }, [data?.phone_number]);

  const saveSenderMutation = useMutation({
    mutationFn: async (sender: string) => {
      const trimmed = sender.trim();
      if (!/^\+[1-9]\d{1,14}$/.test(trimmed)) {
        throw new Error("Sender number must be in E.164 format (e.g. +14155238886)");
      }
      const { data: cfg, error: selErr } = await supabase
        .from("whatsapp_config")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (selErr) throw selErr;
      if (!cfg?.id) throw new Error("WhatsApp config row not found");
      const { error: updErr } = await supabase
        .from("whatsapp_config")
        .update({ sender_number: trimmed })
        .eq("id", cfg.id);
      if (updErr) throw updErr;
      return trimmed;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-config"] });
      toast({ title: "Sender number saved", description: `Outbound messages will use ${saved}.` });
    },
    onError: (e: Error) => {
      toast({ title: "Could not save sender number", description: e.message, variant: "destructive" });
    },
  });

  const isOnline =
    data?.status === "ONLINE" ||
    data?.status === "IN-USE" ||
    (!!data?.throughput && data.status !== "OFFLINE");
  const displayStatus = isOnline ? "Active" : data?.status || "UNKNOWN";

  const handleCopy = async () => {
    if (!data?.webhook_url) return;
    await navigator.clipboard.writeText(data.webhook_url);
    setCopied(true);
    toast({ title: "Copied", description: "Webhook URL copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">WhatsApp Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Live view of your API WhatsApp sender setup.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sender Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-destructive text-sm">Failed to load configuration.</p>
              <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : data ? (
            <div className="space-y-0">
              <Row label="WhatsApp Sender Number">
                <div className="flex items-center gap-2 w-full sm:w-[28rem]">
                  <Input
                    placeholder="+14155238886"
                    value={senderInput}
                    onChange={(e) => setSenderInput(e.target.value)}
                    className="font-mono text-sm h-9"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={() => saveSenderMutation.mutate(senderInput)}
                    disabled={saveSenderMutation.isPending || !senderInput || senderInput === data.phone_number}
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    Save
                  </Button>
                </div>
              </Row>
              <Row label="Status">
                {isOnline ? (
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-transparent gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    {displayStatus}
                  </Badge>
                ) : (
                  <Badge variant="secondary">{displayStatus}</Badge>
                )}
              </Row>
              <Row label="Business Display Name">{data.business_name}</Row>
              <Row label="Throughput">{data.throughput}</Row>
              <Row label="Webhook URL">
                <div className="flex items-center gap-2 w-full sm:w-[28rem]">
                  <Input
                    readOnly
                    value={data.webhook_url}
                    className="font-mono text-xs h-9"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={handleCopy}
                    aria-label="Copy webhook URL"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </Row>
              <Row label="Last Synced">
                <span className="text-muted-foreground">
                  {data.last_synced_at
                    ? formatDistanceToNow(new Date(data.last_synced_at), { addSuffix: true })
                    : "—"}
                </span>
              </Row>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppConfig;
