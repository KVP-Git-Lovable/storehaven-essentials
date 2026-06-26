import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ALLOWED_ENTITIES,
  resolveAudience,
  resolveAudienceConfig,
  resolveListViewContactIdsReadOnly,
  combineSegmentSets,
  type AudienceConfig,
} from "../_shared/journey-schedule.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory cache (per edge-function instance) for live audience-preview counts.
// Key: list_view_id → { ids, expiresAt }. 60s TTL keeps combinator toggles snappy.
const PREVIEW_CACHE = new Map<string, { ids: string[]; expiresAt: number }>();
const PREVIEW_TTL_MS = 60_000;

function getInitialJourneyNodeId(canvas: any): string | null {
  const entryNode = canvas?.nodes?.find((n: any) => n.type === "entry");
  if (entryNode) {
    const firstEdge = canvas?.edges?.find((e: any) => e.source === entryNode.id);
    if (firstEdge?.target) return firstEdge.target;
    return entryNode.id;
  }
  return canvas?.nodes?.[0]?.id || null;
}

async function getSegmentIdsCached(supabase: any, listViewId: string): Promise<string[]> {
  const now = Date.now();
  const cached = PREVIEW_CACHE.get(listViewId);
  if (cached && cached.expiresAt > now) return cached.ids;
  const res = await resolveListViewContactIdsReadOnly(supabase, listViewId);
  PREVIEW_CACHE.set(listViewId, { ids: res.contactIds, expiresAt: now + PREVIEW_TTL_MS });
  return res.contactIds;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action, journey_id, contact_id, event_type, event_data, audience_config } = await req.json();

    if (action === "audience-preview") {
      const cfg = audience_config as AudienceConfig | undefined;
      if (!cfg || !Array.isArray(cfg.segments) || cfg.segments.length === 0) {
        return new Response(JSON.stringify({ error: "audience_config with at least one segment required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const perSegment: Record<string, string[]> = {};
      const counts: Record<string, number> = {};
      for (const seg of cfg.segments) {
        try {
          const ids = await getSegmentIdsCached(supabase, seg.list_view_id);
          perSegment[seg.key] = ids;
          counts[seg.key] = ids.length;
        } catch (e: any) {
          perSegment[seg.key] = [];
          counts[seg.key] = 0;
          // Surface the first error in `error` but keep computing.
          counts[`${seg.key}_error`] = 0;
          (counts as any)[`${seg.key}_errorMsg`] = e?.message || String(e);
        }
      }

      let intersection = 0;
      let union = 0;
      if (cfg.segments.length >= 2) {
        const a = new Set(perSegment[cfg.segments[0].key] || []);
        const b = new Set(perSegment[cfg.segments[1].key] || []);
        intersection = Array.from(a).filter((x) => b.has(x)).length;
        union = new Set([...a, ...b]).size;
      } else {
        union = (perSegment[cfg.segments[0].key] || []).length;
      }

      const finalIds = combineSegmentSets(perSegment, cfg);

      return new Response(JSON.stringify({
        success: true,
        perSegment: counts,
        intersection,
        union,
        final: finalIds.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "activate") {
      const { data: journey, error: jErr } = await supabase
        .from("journeys").select("*").eq("id", journey_id).single();
      if (jErr) throw jErr;

      // Validate list view entity early for a clearer error message (legacy single-LV path)
      if (journey.list_view_id && !journey.audience_config) {
        const { data: lv, error: lvErr } = await supabase
          .from("list_views").select("entity_type, name").eq("id", journey.list_view_id).maybeSingle();
        if (lvErr) throw lvErr;
        if (!lv) throw new Error("Linked list view not found");
        const cfg = ALLOWED_ENTITIES[lv.entity_type];
        if (!cfg || !cfg.isAudienceSource) {
          throw new Error(`List view "${lv.name}" uses entity "${lv.entity_type}" which is not an audience source. Use a Customers or Orders list view.`);
        }
      }

      // Clear stale enrollments so dynamic filters re-evaluate fresh.
      await supabase
        .from("journey_enrollments")
        .delete()
        .eq("journey_id", journey_id)
        .in("status", ["active", "paused", "failed"]);

      // Branch: multi-segment audience_config wins when present; else legacy resolveAudience.
      const ac = journey.audience_config as AudienceConfig | null;
      const useMultiSegment = !!(ac && Array.isArray(ac.segments) && ac.segments.length > 0);
      const result = useMultiSegment
        ? await resolveAudienceConfig(supabase, ac as AudienceConfig)
        : await resolveAudience(supabase, journey);

      const contactIds = result.contactIds;
      const matched = result.matched;
      const skipped = result.skipped;
      const firstError = result.firstError;

      const canvas = journey.canvas_data as any;
      const firstNodeId = getInitialJourneyNodeId(canvas);

      if (contactIds.length > 0 && firstNodeId) {
        const enrollments = contactIds.map((cid) => ({
          journey_id,
          contact_id: cid,
          current_node_id: firstNodeId,
          status: "active",
          next_action_at: new Date().toISOString(),
        }));
        const { error: enrErr } = await supabase
          .from("journey_enrollments")
          .upsert(enrollments, { onConflict: "journey_id,contact_id", ignoreDuplicates: true });
        if (enrErr) {
          console.error("[journey-actions] insert journey_enrollments failed:", enrErr);
          throw new Error(`Failed to enroll contacts: ${enrErr.message}`);
        }
      }

      await supabase.from("journeys").update({ status: "active" }).eq("id", journey_id);

      // Fire-and-forget: kick off the processor immediately so messages flow in seconds,
      // not minutes (the cron sweep is the safety net). We do NOT await this.
      if (contactIds.length > 0) {
        supabase.functions
          .invoke("process-journeys", {
            body: { journey_id, trigger: "activation" },
          })
          .then((r: any) => {
            if (r?.error) console.error("[activate] kickoff error:", r.error);
            else console.log(`[activate] kickoff invoked for journey ${journey_id}`);
          })
          .catch((e: any) => console.error("[activate] kickoff failed:", e?.message || e));
      }

      return new Response(JSON.stringify({
        success: true,
        enrolled: contactIds.length,
        matched,
        skipped,
        reason: firstError,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "pause") {
      await supabase.from("journeys").update({ status: "paused" }).eq("id", journey_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "resume") {
      // Flip status back to active WITHOUT touching enrollments — picks up exactly where it left off.
      await supabase.from("journeys").update({ status: "active" }).eq("id", journey_id);
      // Kick processor immediately so queued enrollments resume in seconds, not minutes.
      supabase.functions
        .invoke("process-journeys", { body: { journey_id, trigger: "resume" } })
        .catch((e: any) => console.error("[resume] kickoff failed:", e?.message || e));
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "record-event") {
      if (!contact_id || !event_type) {
        return new Response(JSON.stringify({ error: "contact_id and event_type required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("journey_contact_events").insert({
        contact_id, event_type, event_data: event_data || {},
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
