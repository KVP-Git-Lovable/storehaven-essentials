import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, MailX } from "lucide-react";

type State = "confirm" | "loading" | "done" | "invalid";

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const email = params.get("e") || "";
  const campaignId = params.get("c");
  const [state, setState] = useState<State>(email ? "confirm" : "invalid");
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setState("loading");
    const { data, error } = await supabase.functions.invoke("marketing-unsubscribe", {
      body: { email, campaign_id: campaignId },
    });
    if (error || (data as any)?.error) { setError((data as any)?.error || error?.message || "Failed"); setState("confirm"); return; }
    setState("done");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            {state === "done" ? <CheckCircle2 className="h-6 w-6 text-primary" /> : <MailX className="h-6 w-6 text-primary" />}
          </div>
          <CardTitle className="mt-3">
            {state === "done" ? "You're unsubscribed" : state === "invalid" ? "Invalid link" : "Unsubscribe"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {state === "invalid" ? (
            <p className="text-sm text-muted-foreground">This unsubscribe link is invalid or expired.</p>
          ) : state === "done" ? (
            <p className="text-sm text-muted-foreground">{email} has been removed from our marketing emails. You may still receive transactional messages related to your account.</p>
          ) : (
            <>
              <p className="text-sm">Unsubscribe <span className="font-medium">{email}</span> from all marketing emails?</p>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button className="w-full" onClick={confirm} disabled={state === "loading"}>
                {state === "loading" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Confirm unsubscribe
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
