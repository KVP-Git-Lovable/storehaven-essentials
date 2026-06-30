import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowDown, Loader2, Play } from "lucide-react";

interface TransitionPreview {
  from_node_id: string;
  to_node_id: string;
  from_label: string;
  to_label: string;
  count: number;
}

interface PreviewData {
  eligible: number;
  remaining_completed: number;
  active: number;
  failed: number;
  pending_delivery?: number;
  transitions: TransitionPreview[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journeyId: string;
  onConfirmed: () => void;
}

export function ResumeJourneyDialog({ open, onOpenChange, journeyId, onConfirmed }: Props) {
  const [loading, setLoading] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.functions.invoke("journey-actions", {
          body: { action: "resume-preview", journey_id: journeyId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (!cancelled) setPreview(data as PreviewData);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load resume preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, journeyId]);

  const handleConfirm = async () => {
    setResuming(true);
    try {
      onConfirmed();
      onOpenChange(false);
    } finally {
      setResuming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Resume Existing Journey Participants</DialogTitle>
          <DialogDescription>
            Review which participants will continue before resuming this journey.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing journey graph...
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm p-3">
            {error}
          </div>
        )}

        {preview && !loading && (
          <div className="space-y-4">
            <p className="text-sm">
              <span className="font-semibold">{preview.eligible.toLocaleString()}</span>{" "}
              previously completed participant{preview.eligible === 1 ? "" : "s"} can now continue
              because new steps were added after the previous end of the Journey.
            </p>

            {preview.transitions.length > 0 ? (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Resume them from
                </div>
                {preview.transitions.map((t, idx) => (
                  <div key={idx} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.from_label}</span>
                      <span className="text-xs text-muted-foreground">
                        ({t.count.toLocaleString()} participant{t.count === 1 ? "" : "s"})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 my-1 text-muted-foreground">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </div>
                    <div className="font-medium">{t.to_label}</div>
                    {idx < preview.transitions.length - 1 && (
                      <div className="border-t my-2" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                No completed enrollments are eligible to resume. The journey will simply be reactivated.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-sm">
              <Stat label="Will resume" value={preview.eligible} highlight />
              <Stat label="Remain completed" value={preview.remaining_completed} />
              <Stat label="Currently active" value={preview.active} />
              <Stat label="Failed" value={preview.failed} />
            </div>

            <div className="text-xs text-muted-foreground leading-relaxed border-t pt-3">
              These participants will continue from the newly added node.
              <br />Previously executed Message nodes will NOT be re-sent.
              <br />Audience evaluation will NOT be run again.
              <br />No duplicate enrollments will be created.
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={resuming}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !!error || resuming}>
            {resuming ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            Resume Journey
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-2 ${highlight ? "bg-primary/5 border-primary/30" : "bg-background"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}