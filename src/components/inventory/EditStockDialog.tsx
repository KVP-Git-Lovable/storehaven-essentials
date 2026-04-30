import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getInventoryStockMap, recordManualAdjustment } from "@/lib/inventoryStock";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: { id: string; name: string; unit?: string; unit_cost?: number } | null;
}

type Mode = "adjust" | "set";

export function EditStockDialog({ open, onOpenChange, item }: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("adjust");
  const [value, setValue] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const { data: currentStock = 0, isLoading } = useQuery({
    queryKey: ["edit-stock-current", item?.id],
    enabled: open && !!item?.id,
    queryFn: async () => {
      const map = await getInventoryStockMap([item!.id]);
      return map[item!.id] ?? 0;
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (open) {
      setMode("adjust");
      setValue("");
      setNotes("");
    }
  }, [open, item?.id]);

  const numericValue = Number(value);
  const isValidNumber = value !== "" && !Number.isNaN(numericValue);
  const delta = useMemo(() => {
    if (!isValidNumber) return 0;
    if (mode === "adjust") return Math.trunc(numericValue);
    return Math.trunc(numericValue) - currentStock;
  }, [mode, numericValue, isValidNumber, currentStock]);

  const projected = currentStock + delta;
  const wouldGoNegative = projected < 0;

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error("No item");
      if (!isValidNumber) throw new Error("Enter a valid number");
      if (delta === 0) throw new Error("No change to save");
      if (wouldGoNegative) throw new Error("Stock cannot go negative");
      await recordManualAdjustment({
        itemId: item.id,
        delta,
        unitCost: item.unit_cost ?? 0,
        notes: notes.trim() || undefined,
        transactionType: mode === "set" && currentStock === 0 ? "opening_balance" : "manual_adjustment",
      });
    },
    onSuccess: () => {
      toast.success("Stock updated");
      qc.invalidateQueries({ queryKey: ["inventory-stock-map"] });
      qc.invalidateQueries({ queryKey: ["inventory-items-stock"] });
      qc.invalidateQueries({ queryKey: ["edit-stock-current", item?.id] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to update stock"),
  });

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Stock — {item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Current Stock:&nbsp;</span>
            <span className="font-semibold">{isLoading ? "…" : currentStock}</span>
            {item.unit ? <span className="text-muted-foreground"> {item.unit}</span> : null}
          </div>

          <div>
            <Label className="mb-2 block">Update Mode</Label>
            <div className="inline-flex rounded-md border p-1">
              <Button
                type="button"
                size="sm"
                variant={mode === "adjust" ? "default" : "ghost"}
                onClick={() => { setMode("adjust"); setValue(""); }}
              >
                Adjust by ±
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "set" ? "default" : "ghost"}
                onClick={() => { setMode("set"); setValue(""); }}
              >
                Set exact value
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="stock-value">
              {mode === "adjust" ? "Change (use negative to decrease)" : "New stock value"}
            </Label>
            <Input
              id="stock-value"
              type="number"
              step="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === "adjust" ? "e.g. 10 or -3" : "e.g. 50"}
            />
          </div>

          <div>
            <Label htmlFor="stock-notes">Reason / Notes (optional)</Label>
            <Textarea
              id="stock-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Stock count correction, damage write-off…"
            />
          </div>

          {isValidNumber && (
            <div className={`rounded-md border px-3 py-2 text-sm ${wouldGoNegative ? "border-destructive/50 bg-destructive/10 text-destructive" : "bg-muted/40"}`}>
              {wouldGoNegative ? (
                <>Stock cannot go negative (would be {projected}).</>
              ) : (
                <>
                  <span className="text-muted-foreground">New stock will be:&nbsp;</span>
                  <span className="font-semibold">{projected}</span>
                  <span className="text-muted-foreground"> ({delta > 0 ? "+" : ""}{delta})</span>
                </>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={!isValidNumber || delta === 0 || wouldGoNegative || saveMut.isPending}
          >
            {saveMut.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}