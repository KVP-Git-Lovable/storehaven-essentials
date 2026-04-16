import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Sender {
  phone_number: string;
  friendly_name: string;
  status: string;
}

const WhatsAppSenders = () => {
  const { data: senders, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["whatsapp-senders"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-senders", {
        method: "GET",
      });
      if (error) throw error;
      return data as Sender[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">WhatsApp Senders</h1>
          <p className="text-muted-foreground mt-1">
            WhatsApp-enabled phone numbers from your Twilio account.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sender Numbers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <p>Failed to load senders. Please check your Twilio configuration.</p>
              <p className="text-sm mt-1 text-muted-foreground">{(error as Error).message}</p>
            </div>
          ) : !senders?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No WhatsApp senders found in your Twilio account.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {senders.map((sender) => (
                  <TableRow key={sender.phone_number}>
                    <TableCell className="font-mono">WhatsApp:{sender.phone_number}</TableCell>
                    <TableCell>{sender.friendly_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={sender.status === "in-use" ? "default" : "secondary"}>
                        {sender.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppSenders;
