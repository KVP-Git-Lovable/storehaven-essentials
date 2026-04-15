import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Node } from "@xyflow/react";

interface Props {
  node: Node;
  onUpdate: (id: string, data: Record<string, any>) => void;
  onClose: () => void;
}

export function NodePropertyPanel({ node, onUpdate, onClose }: Props) {
  const update = (key: string, value: any) => {
    onUpdate(node.id, { ...node.data, [key]: value });
  };

  return (
    <div className="w-72 border-l bg-background p-4 space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm capitalize">{String(node.type)} Properties</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      {node.type === "entry" && (
        <>
          <div><Label>Segment</Label>
            <Select value={String(node.data.segment_type || "customer")} onValueChange={(v) => update("segment_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customers</SelectItem>
                <SelectItem value="prospect">Prospects</SelectItem>
                <SelectItem value="esdb">ESDB</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>City Filter</Label>
            <Input value={String(node.data.city || "")} onChange={(e) => update("city", e.target.value)} placeholder="e.g., Mumbai" />
          </div>
        </>
      )}

      {node.type === "message" && (
        <>
          <div><Label>Channel</Label>
            <Select value={String(node.data.channel || "email")} onValueChange={(v) => update("channel", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="push">Push Notification</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Message Body</Label>
            <Textarea value={String(node.data.template_body || "")} onChange={(e) => update("template_body", e.target.value)} placeholder="Use {name}, {last_purchase_date}..." rows={4} />
          </div>
        </>
      )}

      {node.type === "delay" && (
        <>
          <div><Label>Duration</Label>
            <Input type="number" min={1} value={String(node.data.duration || 1)} onChange={(e) => update("duration", parseInt(e.target.value) || 1)} />
          </div>
          <div><Label>Unit</Label>
            <Select value={String(node.data.unit || "days")} onValueChange={(v) => update("unit", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {node.type === "decision" && (
        <div><Label>Condition</Label>
          <Select value={String(node.data.condition || "opened")} onValueChange={(v) => update("condition", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="opened">Email Opened</SelectItem>
              <SelectItem value="clicked">Link Clicked</SelectItem>
              <SelectItem value="purchased">Purchased</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
