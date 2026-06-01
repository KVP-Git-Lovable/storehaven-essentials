import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TopRecipient = {
  person_id: string;
  entity_type: string;
  name: string;
  score: number;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
  deliveredPct: number;
  readPct: number;
  clickPct: number;
};

export type JourneyEngagement = {
  counts: { sent: number; delivered: number; read: number; clicked: number; failed: number };
  recipientCount: number;
  avgScore: number;
  topRecipients: TopRecipient[];
};

export function useJourneyEngagement(journeyId: string | undefined, isActive: boolean) {
  return useQuery({
    queryKey: ["journey-engagement", journeyId],
    enabled: !!journeyId,
    refetchInterval: isActive ? 30000 : false,
    queryFn: async (): Promise<JourneyEngagement> => {
      const { data: events, error } = await supabase
        .from("journey_message_events" as any)
        .select("person_id, entity_type, event_type")
        .eq("journey_id", journeyId!)
        .limit(5000);
      if (error) throw error;

      const counts = { sent: 0, delivered: 0, read: 0, clicked: 0, failed: 0 };
      const perPerson: Record<string, {
        person_id: string;
        entity_type: string;
        sent: number; delivered: number; read: number; clicked: number; failed: number;
      }> = {};

      for (const e of (events || []) as any[]) {
        const t = e.event_type as keyof typeof counts;
        if (t in counts) counts[t]++;
        if (!e.person_id) continue;
        const key = `${e.person_id}|${e.entity_type}`;
        const p = perPerson[key] ||= {
          person_id: e.person_id,
          entity_type: e.entity_type || "customer",
          sent: 0, delivered: 0, read: 0, clicked: 0, failed: 0,
        };
        if (t in counts) (p as any)[t]++;
      }

      const personIds = Object.values(perPerson).map((p) => p.person_id);
      const scoreMap: Record<string, number> = {};
      const nameMap: Record<string, string> = {};

      if (personIds.length > 0) {
        const { data: scores } = await supabase
          .from("person_engagement_scores" as any)
          .select("person_id, entity_type, whatsapp_score")
          .in("person_id", personIds);
        for (const s of (scores || []) as any[]) {
          scoreMap[`${s.person_id}|${s.entity_type}`] = s.whatsapp_score || 0;
        }
        const { data: contacts } = await supabase
          .from("journey_contacts")
          .select("id, name")
          .in("id", personIds);
        for (const c of contacts || []) nameMap[c.id] = c.name || "—";
      }

      const recipients: TopRecipient[] = Object.values(perPerson).map((p) => {
        const score = scoreMap[`${p.person_id}|${p.entity_type}`] || 0;
        const sent = p.sent || 0;
        return {
          ...p,
          name: nameMap[p.person_id] || "—",
          score,
          deliveredPct: sent ? (p.delivered / sent) * 100 : 0,
          readPct: sent ? (p.read / sent) * 100 : 0,
          clickPct: sent ? (p.clicked / sent) * 100 : 0,
        };
      });

      const recipientCount = recipients.length;
      const avgScore = recipientCount
        ? recipients.reduce((a, b) => a + b.score, 0) / recipientCount
        : 0;

      const topRecipients = [...recipients].sort((a, b) => b.score - a.score).slice(0, 10);

      return { counts, recipientCount, avgScore, topRecipients };
    },
  });
}
