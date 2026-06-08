import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AudienceBuilder, type AudienceConfig } from "@/components/journey/AudienceBuilder";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journey: any | null;
}

export function EditJourneyDetailsDialog({ open, onOpenChange, journey }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audienceConfig, setAudienceConfig] = useState<AudienceConfig>({ segments: [], combinator: "union" });

  useEffect(() => {
    if (!open || !journey) return;
    setName(journey.name || "");
    setDescription(journey.description || "");
    const ac = journey.audience_config as AudienceConfig | null | undefined;
    if (ac && Array.isArray(ac.segments) && ac.segments.length > 0) {
      setAudienceConfig({ segments: ac.segments, combinator: ac.combinator || "union", primary: ac.primary });
    } else if (journey.list_view) {
      setAudienceConfig({
        segments: [{ key: "A", label: journey.list_view.name, list_view_id: journey.list_view.id, entity_type: journey.list_view.entity_type }],
        combinator: "union",
      });
    } else {
      setAudienceConfig({ segments: [], combinator: "union" });
    }
  }, [open, journey]);

  const isLive = journey?.status === "active" || journey?.status === "paused";

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!journey) throw new Error("No journey");
      const validSegments = (audienceConfig.segments || []).filter((s) => s.list_view_id);
      const hasMulti = validSegments.length > 0;
      const acToSave = hasMulti
        ? { segments: validSegments, combinator: audienceConfig.combinator || "union", primary: audienceConfig.primary }
        : null;
      const firstLvId = validSegments[0]?.list_view_id || null;
      const { error } = await supabase
        .from("journeys")
        .update({
          name,
          description,
          list_view_id: firstLvId,
          audience_config: acToSave,
        } as any)
        .eq("id", journey.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Journey details updated");
      qc.invalidateQueries({ queryKey: ["journeys"] });
      qc.invalidateQueries({ queryKey: ["journey", journey?.id] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to update journey"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Journey</DialogTitle>
          <DialogDescription>
            Update name, description, and audience. Canvas, schedule, and execution are unaffected.
          </DialogDescription>
        </DialogHeader>
        {isLive && (
          <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-2 text-[12px] text-orange-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>You're editing a {journey?.status} journey. Changes apply to future executions only — already-processed contacts are not affected.</span>
          </div>
        )}
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Journey name" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the journey purpose..." />
          </div>
          <AudienceBuilder value={audienceConfig} onChange={setAudienceConfig} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
