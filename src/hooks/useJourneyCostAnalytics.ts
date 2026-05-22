import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PricingRow,
  PricingTable,
  computeActual,
  computeProjected,
  MessageRow,
  Category,
  ProjectedStep,
} from "@/lib/journeyCost";
import { useMemo } from "react";

function normPhone(p: string | null | undefined) {
  return String(p || "").replace(/\D/g, "");
}

export function usePricingTable() {
  return useQuery({
    queryKey: ["wa-pricing-table"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<PricingTable> => {
      const [{ data: pricing }, { data: fx }] = await Promise.all([
        supabase
          .from("whatsapp_pricing_config")
          .select("category, service_window, meta_fee_usd, twilio_fee_usd")
          .eq("is_active", true),
        supabase
          .from("fx_rates")
          .select("rate")
          .eq("is_active", true)
          .eq("from_currency", "USD")
          .eq("to_currency", "INR")
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        rows: (pricing || []).map((r: any) => ({
          ...r,
          meta_fee_usd: Number(r.meta_fee_usd),
          twilio_fee_usd: Number(r.twilio_fee_usd),
        })) as PricingRow[],
        fxRate: fx?.rate ? Number(fx.rate) : 95,
      };
    },
  });
}

export function useJourneyCostSettings(journeyId: string) {
  return useQuery({
    queryKey: ["journey-cost-settings", journeyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("journey_cost_settings")
        .select("*")
        .eq("journey_id", journeyId)
        .maybeSingle();
      return data || { journey_id: journeyId, estimated_in_window_pct: 0, entry_point_type: "normal" };
    },
    enabled: !!journeyId,
  });
}

export interface JourneyCostData {
  pricing: PricingTable;
  inWindowPct: number;
  entryPointType: string;
  actual: ReturnType<typeof computeActual>;
  projected: ReturnType<typeof computeProjected>;
  stepLabels: Record<string, { label: string; category: Category | null }>;
  recipientCount: number;
  trend: { day: string; usd: number }[];
}

export function useJourneyCostAnalytics(journeyId: string) {
  const pricingQ = usePricingTable();
  const settingsQ = useJourneyCostSettings(journeyId);

  const journeyQ = useQuery({
    queryKey: ["journey-cost-journey", journeyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journeys")
        .select("id, canvas_data")
        .eq("id", journeyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!journeyId,
  });

  const enrollmentQ = useQuery({
    queryKey: ["journey-cost-enroll", journeyId],
    queryFn: async () => {
      const { count } = await supabase
        .from("journey_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("journey_id", journeyId);
      return count || 0;
    },
    enabled: !!journeyId,
  });

  const messagesQ = useQuery({
    queryKey: ["journey-cost-msgs", journeyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journey_message_log")
        .select(
          "id, status, delivery_status, node_id, sent_at, template_id, journey_contacts(phone), whatsapp_templates:template_id(category)",
        )
        .eq("journey_id", journeyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!journeyId,
  });

  // Phones we need to check service-window for.
  const phones = useMemo(() => {
    const set = new Set<string>();
    (messagesQ.data || []).forEach((m: any) => {
      const p = normPhone(m.journey_contacts?.phone);
      if (p) set.add(p);
    });
    return Array.from(set);
  }, [messagesQ.data]);

  // Inbound message lookup — fetch any inbound rows from these phones; we'll evaluate 24h vs message sent_at client-side.
  const inboundQ = useQuery({
    queryKey: ["journey-cost-inbound", journeyId, phones.length],
    enabled: phones.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("phone, created_at")
        .eq("direction", "inbound")
        .limit(5000);
      return data || [];
    },
  });

  const data: JourneyCostData | null = useMemo(() => {
    if (!pricingQ.data || !journeyQ.data || !messagesQ.data) return null;

    const canvas = (journeyQ.data.canvas_data || {}) as any;
    const nodes: any[] = canvas.nodes || [];

    const stepLabels: Record<string, { label: string; category: Category | null }> = {};
    const projectedSteps: ProjectedStep[] = [];

    for (const n of nodes) {
      if (n.type !== "message") continue;
      const id = String(n.id);
      const label = n.data?.label || n.data?.title || "Message";
      // Best-effort category sniff from canvas; will be overridden by template join when present.
      const cat = (n.data?.template_category || n.data?.category || null) as Category | null;
      stepLabels[id] = { label, category: cat };
    }

    // Build inbound-by-phone map for service-window lookups.
    const inboundByPhone = new Map<string, number[]>();
    (inboundQ.data || []).forEach((r: any) => {
      const p = normPhone(r.phone);
      if (!p) return;
      const arr = inboundByPhone.get(p) || [];
      arr.push(new Date(r.created_at).getTime());
      inboundByPhone.set(p, arr);
    });

    const msgRows: MessageRow[] = (messagesQ.data as any[]).map((m) => {
      const cat = (m.whatsapp_templates?.category as Category | null) ||
        stepLabels[m.node_id || ""]?.category ||
        null;
      const sentAt = new Date(m.sent_at).getTime();
      const phone = normPhone(m.journey_contacts?.phone);
      const inbounds = inboundByPhone.get(phone) || [];
      const inWindow = inbounds.some((t) => t <= sentAt && t >= sentAt - 24 * 3600 * 1000);
      // Backfill category in stepLabels when template join gave one.
      if (m.node_id && cat && stepLabels[m.node_id] && !stepLabels[m.node_id].category) {
        stepLabels[m.node_id].category = cat;
      }
      return {
        status: m.status,
        delivery_status: m.delivery_status,
        category: cat,
        in_window: inWindow,
        node_id: m.node_id,
      };
    });

    const actual = computeActual(msgRows, pricingQ.data);

    // Apply step labels onto actual.byStep
    Object.values(actual.byStep).forEach((s) => {
      const label = stepLabels[s.node_id]?.label;
      if (label) s.label = label;
      if (!s.category) s.category = stepLabels[s.node_id]?.category || null;
    });

    // Projected: per message-node, recipients = enrollment count (best estimate).
    const recipients = enrollmentQ.data || 0;
    for (const id of Object.keys(stepLabels)) {
      const cat = stepLabels[id].category;
      if (!cat) continue;
      projectedSteps.push({ node_id: id, label: stepLabels[id].label, category: cat, recipients });
    }

    const inWindowPct = settingsQ.data?.estimated_in_window_pct ?? 0;
    const projected = computeProjected(projectedSteps, pricingQ.data, inWindowPct);

    // Daily trend (by sent_at, in USD)
    const trendMap = new Map<string, number>();
    (messagesQ.data as any[]).forEach((m, i) => {
      const row = msgRows[i];
      if (!row.category) return;
      const day = new Date(m.sent_at).toISOString().slice(0, 10);
      let usd = 0;
      const delivered =
        m.delivery_status === "delivered" || m.status === "delivered";
      const failed =
        ["failed", "undelivered"].includes(m.status) ||
        m.delivery_status === "failed";
      if (delivered) {
        const win = row.category === "MARKETING" ? "n_a" : row.in_window ? "inside" : "outside";
        const r = pricingQ.data.rows.find(
          (x) => x.category === row.category && x.service_window === win,
        );
        usd = r ? Number(r.meta_fee_usd) + Number(r.twilio_fee_usd) : 0;
      } else if (failed) {
        const r = pricingQ.data.rows.find((x) => x.category === "FAILED_FEE");
        usd = r ? Number(r.meta_fee_usd) + Number(r.twilio_fee_usd) : 0;
      }
      trendMap.set(day, (trendMap.get(day) || 0) + usd);
    });
    const trend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, usd]) => ({ day, usd }));

    return {
      pricing: pricingQ.data,
      inWindowPct,
      entryPointType: settingsQ.data?.entry_point_type || "normal",
      actual,
      projected,
      stepLabels,
      recipientCount: recipients,
      trend,
    };
  }, [pricingQ.data, journeyQ.data, messagesQ.data, inboundQ.data, enrollmentQ.data, settingsQ.data]);

  return {
    data,
    isLoading: pricingQ.isLoading || journeyQ.isLoading || messagesQ.isLoading,
    refetch: () => {
      settingsQ.refetch();
      pricingQ.refetch();
    },
  };
}