import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      // Get journey
      const { data: journey, error: jErr } = await supabase
        .from("journeys").select("*").eq("id", journey_id).single();
      if (jErr) throw jErr;

      // Find matching contacts
      let query = supabase.from("journey_contacts").select("id").eq("opted_out", false);
      if (journey.segment_type) query = query.eq("segment_type", journey.segment_type);
      
      const filters = journey.filters as any;
      if (filters?.city) query = query.eq("city", filters.city);

      const { data: contacts, error: cErr } = await query;
      if (cErr) throw cErr;

      // Get first node from canvas
      const canvas = journey.canvas_data as any;
      const entryNode = canvas?.nodes?.find((n: any) => n.type === "entry");
      const firstNodeId = entryNode?.id || canvas?.nodes?.[0]?.id;

      // Enroll contacts
      if (contacts && contacts.length > 0) {
        const enrollments = contacts.map((c: any) => ({
          journey_id,
          contact_id: c.id,
          current_node_id: firstNodeId,
          status: "active",
          next_action_at: new Date().toISOString(),
        }));
        await supabase.from("journey_enrollments").insert(enrollments);
      }

      // Update status
      await supabase.from("journeys").update({ status: "active" }).eq("id", journey_id);

      return new Response(JSON.stringify({ success: true, enrolled: contacts?.length || 0 }), {
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
