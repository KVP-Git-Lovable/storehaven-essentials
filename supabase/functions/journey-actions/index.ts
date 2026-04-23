import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ALLOWED_ENTITIES, resolveAudience } from "../_shared/journey-schedule.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action, journey_id, contact_id, event_type, event_data } = await req.json();

    if (action === "activate") {
      const { data: journey, error: jErr } = await supabase
        .from("journeys").select("*").eq("id", journey_id).single();
      if (jErr) throw jErr;

      // Validate list view entity early for a clearer error message
      if (journey.list_view_id) {
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

      const result = await resolveAudience(supabase, journey);
      const contactIds = result.contactIds;
      const matched = result.matched;
      const skipped = result.skipped;
      const firstError = result.firstError;

      const canvas = journey.canvas_data as any;
      const entryNode = canvas?.nodes?.find((n: any) => n.type === "entry");
      const firstNodeId = entryNode?.id || canvas?.nodes?.[0]?.id;

      if (contactIds.length > 0) {
        const enrollments = contactIds.map((cid) => ({
          journey_id,
          contact_id: cid,
          current_node_id: firstNodeId,
          status: "active",
          next_action_at: new Date().toISOString(),
        }));
        const { error: enrErr } = await supabase.from("journey_enrollments").insert(enrollments);
        if (enrErr) {
          console.error("[journey-actions] insert journey_enrollments failed:", enrErr);
          throw new Error(`Failed to enroll contacts: ${enrErr.message}`);
        }
      }

      await supabase.from("journeys").update({ status: "active" }).eq("id", journey_id);

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
