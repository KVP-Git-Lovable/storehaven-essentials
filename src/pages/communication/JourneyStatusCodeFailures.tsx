import { lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const StatusCodeFailuresTable = lazy(() => import("@/components/journey/StatusCodeFailuresTable"));

export default function JourneyStatusCodeFailures() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: journey } = useQuery({
    queryKey: ["journey", id],
    queryFn: async () => {
      const { data } = await supabase.from("journeys").select("id, name").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/communication/journeys/${id}/analytics`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Status code failures</h1>
          <p className="text-sm text-muted-foreground">
            {journey?.name || "Journey"} — messages that did not send due to Twilio error codes. Auto-retries are disabled; resend manually below.
          </p>
        </div>
      </div>

      {id && (
        <Tabs defaultValue="63049" className="space-y-4">
          <TabsList>
            <TabsTrigger value="63049">63049 — Blocked by Meta</TabsTrigger>
            <TabsTrigger value="63024">63024 — Template paused</TabsTrigger>
            <TabsTrigger value="63032">63032 — Account banned by Meta</TabsTrigger>
          </TabsList>
          <TabsContent value="63049">
            <Suspense fallback={<div className="text-center text-sm text-muted-foreground py-8">Loading…</div>}>
              <StatusCodeFailuresTable journeyId={id} errorCode="63049" />
            </Suspense>
          </TabsContent>
          <TabsContent value="63024">
            <Suspense fallback={<div className="text-center text-sm text-muted-foreground py-8">Loading…</div>}>
              <StatusCodeFailuresTable journeyId={id} errorCode="63024" />
            </Suspense>
          </TabsContent>
          <TabsContent value="63032">
            <Suspense fallback={<div className="text-center text-sm text-muted-foreground py-8">Loading…</div>}>
              <StatusCodeFailuresTable journeyId={id} errorCode="63032" />
            </Suspense>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}