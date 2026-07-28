import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export type ManualPriceRow = {
  index: number;
  productName: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  diaPrice: number;
  csPrice: number;
  makingCharges: number;
};

type Draft = { index: number; unitPrice: string; diaPrice: string; csPrice: string; makingCharges: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ManualPriceRow[];
  onConfirm: (values: Draft[]) => void;
}

export function ManualPriceOverrideDialog({ open, onOpenChange, rows, onConfirm }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    if (!open) {
      setConfirmed(false);
      return;
    }
    setDrafts(
      rows.map((r) => ({
        index: r.index,
        unitPrice: String(Math.round(r.unitPrice * 100) / 100),
        diaPrice: String(r.diaPrice),
        csPrice: String(r.csPrice),
        makingCharges: String(r.makingCharges),
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const update = (index: number, patch: Partial<Draft>) =>
    setDrafts((cur) => cur.map((d) => (d.index === index ? { ...d, ...patch } : d)));

  if (!open) return null;

  if (!confirmed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manual price edit</DialogTitle>
            <DialogDescription>
              Are you sure you want to proceed to manually edit the set prices?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>No</Button>
            <Button onClick={() => setConfirmed(true)}>Yes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manual Price Override</DialogTitle>
          <DialogDescription>
            Edit the auto-calculated prices for each product. These values will be used for this sale.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {drafts.map((d) => {
            const row = rows.find((r) => r.index === d.index);
            const lineTotal =
              (row?.quantity || 1) *
              ((Number(d.unitPrice) || 0) + (Number(d.diaPrice) || 0) + (Number(d.csPrice) || 0) + (Number(d.makingCharges) || 0));
            return (
              <Card key={d.index} className="p-4 space-y-3">
                <div className="text-sm font-medium">
                  {row?.sku && <span className="font-mono mr-2">{row.sku}</span>}
                  {row?.productName}
                  <span className="text-muted-foreground font-normal"> × {row?.quantity}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <Label>Unit Price</Label>
                    <Input type="number" min="0" step="0.01" value={d.unitPrice} onChange={(e) => update(d.index, { unitPrice: e.target.value })} />
                  </div>
                  <div>
                    <Label>Dia Price</Label>
                    <Input type="number" min="0" step="0.01" value={d.diaPrice} onChange={(e) => update(d.index, { diaPrice: e.target.value })} />
                  </div>
                  <div>
                    <Label>CS Price</Label>
                    <Input type="number" min="0" step="0.01" value={d.csPrice} onChange={(e) => update(d.index, { csPrice: e.target.value })} />
                  </div>
                  <div>
                    <Label>Making</Label>
                    <Input type="number" min="0" step="0.01" value={d.makingCharges} onChange={(e) => update(d.index, { makingCharges: e.target.value })} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Line Total: <span className="font-medium text-foreground">₹{Math.round(lineTotal).toLocaleString("en-IN")}</span>
                </div>
              </Card>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              onConfirm(drafts);
              onOpenChange(false);
            }}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}