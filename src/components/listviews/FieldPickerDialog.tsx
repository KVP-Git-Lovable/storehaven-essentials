import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, ChevronDown } from "lucide-react";
import type { FieldDef } from "@/lib/listViewSchema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allFields: FieldDef[];
  initialSelected: string[];
  initialOrder: string[];
  onSave: (selectedFields: string[], columnOrder: string[]) => void;
}

export function FieldPickerDialog({ open, onOpenChange, allFields, initialSelected, initialOrder, onSave }: Props) {
  const [visible, setVisible] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>([]);
  const [selVisible, setSelVisible] = useState<string | null>(null);
  const [selAvailable, setSelAvailable] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const orderValid = initialOrder.filter((k) => initialSelected.includes(k));
    const missing = initialSelected.filter((k) => !orderValid.includes(k));
    const orderedVisible = [...orderValid, ...missing];
    setVisible(orderedVisible);
    setAvailable(allFields.map((f) => f.key).filter((k) => !orderedVisible.includes(k)));
    setSelVisible(null);
    setSelAvailable(null);
  }, [open, initialSelected, initialOrder, allFields]);

  const labelOf = (key: string) => allFields.find((f) => f.key === key)?.label || key;

  function moveRight() {
    if (!selAvailable) return;
    setVisible([...visible, selAvailable]);
    setAvailable(available.filter((k) => k !== selAvailable));
    setSelAvailable(null);
  }
  function moveLeft() {
    if (!selVisible) return;
    setAvailable([...available, selVisible]);
    setVisible(visible.filter((k) => k !== selVisible));
    setSelVisible(null);
  }
  function moveAllRight() {
    setVisible([...visible, ...available]);
    setAvailable([]);
  }
  function moveAllLeft() {
    setAvailable([...available, ...visible]);
    setVisible([]);
  }
  function moveUp() {
    if (!selVisible) return;
    const i = visible.indexOf(selVisible);
    if (i <= 0) return;
    const next = [...visible];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setVisible(next);
  }
  function moveDown() {
    if (!selVisible) return;
    const i = visible.indexOf(selVisible);
    if (i < 0 || i >= visible.length - 1) return;
    const next = [...visible];
    [next[i + 1], next[i]] = [next[i], next[i + 1]];
    setVisible(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Fields to Display</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-stretch py-2">
          <div className="flex flex-col">
            <div className="text-xs font-medium text-muted-foreground mb-2">Available Fields</div>
            <div className="border rounded-md h-72 overflow-y-auto bg-background">
              {available.length === 0 && (
                <div className="p-3 text-xs text-muted-foreground">All fields selected</div>
              )}
              {available.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelAvailable(k)}
                  onDoubleClick={() => { setSelAvailable(k); setTimeout(moveRight, 0); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent ${selAvailable === k ? "bg-accent" : ""}`}
                >
                  {labelOf(k)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 justify-center">
            <Button size="icon" variant="outline" onClick={moveRight} disabled={!selAvailable}><ChevronRight className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" onClick={moveLeft} disabled={!selVisible}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" onClick={moveAllRight} disabled={available.length === 0}><ChevronsRight className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" onClick={moveAllLeft} disabled={visible.length === 0}><ChevronsLeft className="h-4 w-4" /></Button>
          </div>

          <div className="flex flex-col">
            <div className="text-xs font-medium text-muted-foreground mb-2">Visible Fields</div>
            <div className="border rounded-md h-72 overflow-y-auto bg-background">
              {visible.length === 0 && (
                <div className="p-3 text-xs text-muted-foreground">No fields selected</div>
              )}
              {visible.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelVisible(k)}
                  onDoubleClick={() => { setSelVisible(k); setTimeout(moveLeft, 0); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent ${selVisible === k ? "bg-accent" : ""}`}
                >
                  {labelOf(k)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 justify-center">
            <Button size="icon" variant="outline" onClick={moveUp} disabled={!selVisible}><ChevronUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" onClick={moveDown} disabled={!selVisible}><ChevronDown className="h-4 w-4" /></Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onSave(visible, visible); onOpenChange(false); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}