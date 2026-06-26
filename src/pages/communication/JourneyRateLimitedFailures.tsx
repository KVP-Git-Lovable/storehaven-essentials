import { lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const RateLimitedRetrySection = lazy(() => import("@/components/journey/RateLimitedRetrySection"));

export default function JourneyRateLimitedFailures() {
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
          <h1 className="text-2xl font-bold">Rate-limited Failures</h1>
          <p className="text-sm text-muted-foreground">{journey?.name || "Journey"}</p>
        </div>
      </div>
      {id && (
        <Suspense fallback={<div className="text-center text-sm text-muted-foreground py-8">Loading…</div>}>
          <RateLimitedRetrySection journeyId={id} />
        </Suspense>
      )}
    </div>
  );
}