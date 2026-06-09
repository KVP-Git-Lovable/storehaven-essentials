import { MessageSquare, Phone, Mail } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { DashboardMetrics } from "@/hooks/useDashboardMetrics";

export function CommunicationHealth({ comm }: { comm: DashboardMetrics["comm"] }) {
  const rows = [
    { icon: MessageSquare, label: "WhatsApp", color: "text-success", primary: `${comm.whatsapp.delivered.toFixed(1)}%`, primaryLabel: "delivered", secondary: `${comm.whatsapp.read.toFixed(1)}% read`, value: comm.whatsapp.delivered },
    { icon: Phone, label: "Voice", color: "text-info", primary: `${comm.voice.connected.toFixed(0)}%`, primaryLabel: "connected", secondary: `${comm.voice.orders} orders`, value: comm.voice.connected },
    { icon: Mail, label: "Email", color: "text-warning", primary: `${comm.email.open.toFixed(0)}%`, primaryLabel: "open", secondary: `${comm.email.click.toFixed(0)}% click`, value: comm.email.open },
  ];
  return (
    <div className="stat-card h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm md:text-base">Communication Health</h3>
        <Badge variant="secondary" className="text-[10px]">{comm.today} today</Badge>
      </div>
      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <r.icon className={`h-3.5 w-3.5 ${r.color}`} />
                <span className="text-xs font-medium">{r.label}</span>
              </div>
              <div className="text-xs">
                <span className="font-semibold">{r.primary}</span>
                <span className="text-muted-foreground ml-1">{r.primaryLabel}</span>
              </div>
            </div>
            <Progress value={Math.min(r.value, 100)} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground mt-1">{r.secondary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}