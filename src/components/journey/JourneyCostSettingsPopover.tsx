import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

export function JourneyCostSettingsPopover({
  journeyId,
  inWindowPct,
  entryPointType,
}: {
  journeyId: string;
  inWindowPct: number;
  entryPointType: string;
}) {
  const { isAdmin } = useAuth();
  const [pct, setPct] = useState(String(inWindowPct));
  const [entry, setEntry] = useState(entryPointType);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  if (!isAdmin) return null;

  const save = async () => {
    setSaving(true);
    const v = Math.max(0, Math.min(100, parseInt(pct || "0", 10) || 0));
    const { error } = await supabase.from("journey_cost_settings").upsert({
      journey_id: journeyId,
      estimated_in_window_pct: v,
      entry_point_type: entry,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cost settings saved" });
    qc.invalidateQueries({ queryKey: ["journey-cost-settings", journeyId] });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-1.5" />
          Cost settings
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div className="space-y-1.5">
          <Label htmlFor="pct">Estimated % already in 24h window</Label>
          <Input
            id="pct"
            type="number"
            min={0}
            max={100}
            value={pct}
            onChange={(e) => setPct(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Used only for projected Utility/Auth costs. Marketing is always charged.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="entry">Entry point type</Label>
          <select
            id="entry"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            className="w-full h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="normal">Normal</option>
            <option value="click_to_whatsapp">Click-to-WhatsApp ad</option>
            <option value="customer_initiated">Customer-initiated</option>
          </select>
          <p className="text-xs text-muted-foreground">Reserved for future free-entry pricing.</p>
        </div>
        <div className="flex justify-between gap-2 pt-2 border-t">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/whatsapp-pricing">Edit global pricing</Link>
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}