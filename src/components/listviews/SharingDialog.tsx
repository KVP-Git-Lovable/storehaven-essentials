import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialVisibility: "private" | "shared";
  onSave: (visibility: "private" | "shared") => void;
}

export function SharingDialog({ open, onOpenChange, initialVisibility, onSave }: Props) {
  const [visibility, setVisibility] = useState<"private" | "shared">(initialVisibility);

  useEffect(() => {
    if (open) setVisibility(initialVisibility);
  }, [open, initialVisibility]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sharing</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Label className="mb-2 block">Visibility</Label>
          <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as any)}>
            <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/40">
              <RadioGroupItem value="private" id="sv-private" className="mt-1" />
              <div>
                <div className="text-sm font-medium">Private</div>
                <div className="text-xs text-muted-foreground">Only you can see this list view.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/40">
              <RadioGroupItem value="shared" id="sv-shared" className="mt-1" />
              <div>
                <div className="text-sm font-medium">Shared</div>
                <div className="text-xs text-muted-foreground">Visible to everyone.</div>
              </div>
            </label>
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onSave(visibility); onOpenChange(false); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}