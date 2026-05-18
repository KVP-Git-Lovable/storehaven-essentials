import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ENTITY_LIST, ENTITY_SCHEMAS, type EntityKey } from "@/lib/listViewSchema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lockedEntity?: EntityKey | null;
  onCreated?: (id: string, entity: EntityKey) => void;
}

export function NewListViewDialog({ open, onOpenChange, lockedEntity, onCreated }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entityType, setEntityType] = useState<EntityKey>(lockedEntity || "customers");
  const [visibility, setVisibility] = useState<"private" | "shared">("private");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setEntityType(lockedEntity || "customers");
      setVisibility("private");
      setTags("");
    }
  }, [open, lockedEntity]);

  const createMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        entity_type: entityType,
        selected_fields: [],
        column_order: [],
        filters: [],
        visibility,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        created_by: user?.id,
      };
      const { data, error } = await supabase
        .from("list_views" as any)
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["list-views"] });
      qc.invalidateQueries({ queryKey: ["list-views-by-entity"] });
      toast.success("List view created");
      onOpenChange(false);
      onCreated?.(data.id, data.entity_type as EntityKey);
    },
    onError: (e: any) => toast.error(e.message || "Failed to create"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New List View</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., High Value Customers"
              autoFocus
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              rows={2}
            />
          </div>
          <div>
            <Label>Entity</Label>
            <Select
              value={entityType}
              onValueChange={(v) => setEntityType(v as EntityKey)}
              disabled={!!lockedEntity}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENTITY_LIST.map((e) => (
                  <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lockedEntity && (
              <p className="text-xs text-muted-foreground mt-1">
                Entity locked to {ENTITY_SCHEMAS[lockedEntity].label}.
              </p>
            )}
          </div>
          <div>
            <Label className="mb-2 block">Visibility</Label>
            <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as any)}>
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/40">
                <RadioGroupItem value="private" id="v-private" className="mt-1" />
                <div>
                  <div className="text-sm font-medium">Private</div>
                  <div className="text-xs text-muted-foreground">Only you can see this list view.</div>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/40">
                <RadioGroupItem value="shared" id="v-shared" className="mt-1" />
                <div>
                  <div className="text-sm font-medium">Shared</div>
                  <div className="text-xs text-muted-foreground">Visible to everyone.</div>
                </div>
              </label>
            </RadioGroup>
          </div>
          <div>
            <Label>Tags</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="marketing, retention"
            />
            <p className="text-xs text-muted-foreground mt-1">Comma-separated.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMut.mutate()} disabled={!name.trim() || createMut.isPending}>
            {createMut.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}