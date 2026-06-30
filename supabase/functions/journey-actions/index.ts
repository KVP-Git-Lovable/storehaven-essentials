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

    if (action === "resume-preview" || action === "resume") {
      // Shared eligibility computation: completed enrollments parked on a non-exit
      // node that now has outgoing edges (i.e. the graph was extended past a former terminal).
      const { data: journey, error: jErr } = await supabase
        .from("journeys")
        .select("id, canvas_data")
        .eq("id", journey_id)
        .single();
      if (jErr) throw jErr;

      const canvas = (journey?.canvas_data as any) || {};
      const nodes: any[] = Array.isArray(canvas.nodes) ? canvas.nodes : [];
      const edges: any[] = Array.isArray(canvas.edges) ? canvas.edges : [];
      const nodeById = new Map<string, any>(nodes.map((n) => [n.id, n]));
      const edgesFrom = new Map<string, any[]>();
      for (const e of edges) {
        if (!e?.source || !e?.target) continue;
        const arr = edgesFrom.get(e.source) || [];
        arr.push(e);
        edgesFrom.set(e.source, arr);
      }

      const eligibleNodeIds = new Set<string>();
      for (const n of nodes) {
        if (!n?.id) continue;
        if (n.type === "exit") continue;
        if ((edgesFrom.get(n.id) || []).length > 0) eligibleNodeIds.add(n.id);
      }

      // Page through enrollments (PostgREST default cap 1000).
      const enrollments: { id: string; status: string; current_node_id: string | null }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data: page, error } = await supabase
          .from("journey_enrollments")
          .select("id, status, current_node_id")
          .eq("journey_id", journey_id)
          .range(from, from + 999);
        if (error) throw error;
        if (!page || page.length === 0) break;
        enrollments.push(...(page as any));
        if (page.length < 1000) break;
      }

      const statusCounts = { active: 0, paused: 0, completed: 0, failed: 0, pending_delivery: 0 } as Record<string, number>;
      const eligible: { id: string; current_node_id: string }[] = [];
      for (const e of enrollments) {
        statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
        if (
          e.status === "completed" &&
          e.current_node_id &&
          eligibleNodeIds.has(e.current_node_id)
        ) {
          eligible.push({ id: e.id, current_node_id: e.current_node_id });
        }
      }

      // Resolve human-friendly transition labels (up to 5 distinct pairs).
      const pickNextEdge = (fromId: string) => {
        const list = edgesFrom.get(fromId) || [];
        const fromNode = nodeById.get(fromId);
        if (fromNode?.type === "decision" || fromNode?.type === "message_response") {
          const yes = list.find((e) => e.sourceHandle === "yes");
          if (yes) return yes;
        }
        return list[0];
      };
      const labelFor = (n: any): string => {
        if (!n) return "Unknown";
        const t = n.type || "node";
        const d = n.data || {};
        if (t === "message") {
          const name = d.whatsapp_template_name || d.template_name || (d.channel ? `${d.channel} message` : "Message");
          return `Message: ${name}`;
        }
        if (t === "message_response") {
          const wait = `${d.wait_value || 0} ${d.wait_unit || "hours"}`;
          return `Message Response: ${d.condition || "read"} within ${wait}`;
        }
        if (t === "delay") return `Delay: ${d.duration || 0} ${d.unit || "days"}`;
        if (t === "decision") return `Decision: ${d.condition || "condition"}`;
        if (t === "exit") return "Exit";
        if (t === "entry") return "Entry";
        return t;
      };

      const pairCounts = new Map<string, { from_node_id: string; to_node_id: string; from_label: string; to_label: string; count: number }>();
      for (const e of eligible) {
        const next = pickNextEdge(e.current_node_id);
        if (!next) continue;
        const key = `${e.current_node_id}->${next.target}`;
        const existing = pairCounts.get(key);
        if (existing) { existing.count += 1; continue; }
        pairCounts.set(key, {
          from_node_id: e.current_node_id,
          to_node_id: next.target,
          from_label: labelFor(nodeById.get(e.current_node_id)),
          to_label: labelFor(nodeById.get(next.target)),
          count: 1,
        });
      }
      const transitions = Array.from(pairCounts.values()).sort((a, b) => b.count - a.count).slice(0, 5);

      if (action === "resume-preview") {
        return new Response(JSON.stringify({
          success: true,
          eligible: eligible.length,
          remaining_completed: (statusCounts.completed || 0) - eligible.length,
          active: statusCounts.active || 0,
          failed: statusCounts.failed || 0,
          pending_delivery: statusCounts.pending_delivery || 0,
          transitions,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // action === "resume": optionally migrate completed enrollments, then flip status.
      let resumed = 0;
      let migrationErrors = 0;
      if (eligible.length > 0) {
        // Fetch original send timestamps for each eligible enrollment in chunks.
        const sentAtByEnrollment = new Map<string, string>();
        const ids = eligible.map((e) => e.id);
        for (let i = 0; i < ids.length; i += 200) {
          const chunk = ids.slice(i, i + 200);
          const { data: logs, error } = await supabase
            .from("journey_message_log")
            .select("enrollment_id, node_id, sent_at, created_at")
            .in("enrollment_id", chunk);
          if (error) { console.error("[resume] log fetch error:", error); continue; }
          for (const row of (logs || []) as any[]) {
            const key = `${row.enrollment_id}::${row.node_id}`;
            const ts = row.sent_at || row.created_at;
            if (!ts) continue;
            const prev = sentAtByEnrollment.get(key);
            if (!prev || new Date(ts).getTime() < new Date(prev).getTime()) {
              sentAtByEnrollment.set(key, ts);
            }
          }
        }

        // Apply per-enrollment updates in batches.
        const updates: { id: string; current_node_id: string; status: string; next_action_at: string }[] = [];
        for (const e of eligible) {
          const next = pickNextEdge(e.current_node_id);
          if (!next) continue;
          const sentAt = sentAtByEnrollment.get(`${e.id}::${e.current_node_id}`) || new Date(0).toISOString();
          updates.push({
            id: e.id,
            current_node_id: next.target,
            status: "active",
            next_action_at: sentAt,
          });
        }
        for (let i = 0; i < updates.length; i += 200) {
          const chunk = updates.slice(i, i + 200);
          const { error } = await supabase
            .from("journey_enrollments")
            .upsert(chunk, { onConflict: "id" });
          if (error) {
            console.error("[resume] migration upsert error:", error);
            migrationErrors += chunk.length;
          } else {
            resumed += chunk.length;
          }
        }
      }

      await supabase.from("journeys").update({ status: "active" }).eq("id", journey_id);
      supabase.functions
        .invoke("process-journeys", { body: { journey_id, trigger: "resume" } })
        .catch((e: any) => console.error("[resume] kickoff failed:", e?.message || e));

      return new Response(JSON.stringify({
        success: true,
        resumed,
        eligible: eligible.length,
        migration_errors: migrationErrors,
        transitions,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
