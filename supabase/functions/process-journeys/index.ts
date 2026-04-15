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

    // Get active journeys
    const { data: activeJourneys } = await supabase
      .from("journeys").select("*").eq("status", "active");

    if (!activeJourneys || activeJourneys.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const journey of activeJourneys) {
      const canvas = journey.canvas_data as any;
      if (!canvas?.nodes || !canvas?.edges) continue;

      // Get enrollments that need processing
      const { data: enrollments } = await supabase
        .from("journey_enrollments")
        .select("*, journey_contacts(*)")
        .eq("journey_id", journey.id)
        .eq("status", "active")
        .lte("next_action_at", new Date().toISOString());

      if (!enrollments) continue;

      for (const enrollment of enrollments) {
        const currentNode = canvas.nodes.find((n: any) => n.id === enrollment.current_node_id);
        if (!currentNode) continue;

        const nodeType = currentNode.type;

        if (nodeType === "exit") {
          await supabase.from("journey_enrollments")
            .update({ status: "completed" })
            .eq("id", enrollment.id);
          processed++;
          continue;
        }

        if (nodeType === "delay") {
          const duration = currentNode.data?.duration || 1;
          const unit = currentNode.data?.unit || "days";
          const delayMs = unit === "hours" ? duration * 3600000 : duration * 86400000;
          const enrolledAt = new Date(enrollment.enrolled_at).getTime();
          const nextActionAt = new Date(enrollment.next_action_at!).getTime();
          
          if (Date.now() >= nextActionAt + delayMs) {
            // Advance to next node
            const nextEdge = canvas.edges.find((e: any) => e.source === currentNode.id);
            if (nextEdge) {
              await supabase.from("journey_enrollments")
                .update({ current_node_id: nextEdge.target, next_action_at: new Date().toISOString() })
                .eq("id", enrollment.id);
            }
          }
          processed++;
          continue;
        }

        if (nodeType === "message") {
          const contact = enrollment.journey_contacts;
          const channel = currentNode.data?.channel || "email";
          const templateBody = (currentNode.data?.template_body || "")
            .replace(/\{name\}/g, contact?.name || "")
            .replace(/\{last_purchase_date\}/g, contact?.last_purchase_date || "N/A");

          // Log message
          await supabase.from("journey_message_log").insert({
            journey_id: journey.id,
            enrollment_id: enrollment.id,
            contact_id: enrollment.contact_id,
            channel,
            template_body: templateBody,
            status: "sent",
          });

          // Advance to next node
          const nextEdge = canvas.edges.find((e: any) => e.source === currentNode.id);
          if (nextEdge) {
            await supabase.from("journey_enrollments")
              .update({ current_node_id: nextEdge.target, next_action_at: new Date().toISOString() })
              .eq("id", enrollment.id);
          }
          processed++;
          continue;
        }

        if (nodeType === "decision") {
          const condition = currentNode.data?.condition || "opened";
          
          // Check if contact has the event
          const { data: events } = await supabase
            .from("journey_contact_events")
            .select("id")
            .eq("contact_id", enrollment.contact_id)
            .eq("event_type", condition)
            .limit(1);

          const hasEvent = events && events.length > 0;
          const handleId = hasEvent ? "yes" : "no";
          const nextEdge = canvas.edges.find(
            (e: any) => e.source === currentNode.id && (e.sourceHandle === handleId || (!e.sourceHandle && hasEvent))
          );

          if (nextEdge) {
            await supabase.from("journey_enrollments")
              .update({ current_node_id: nextEdge.target, next_action_at: new Date().toISOString() })
              .eq("id", enrollment.id);
          }
          processed++;
          continue;
        }

        // Entry node or unknown - advance to next
        const nextEdge = canvas.edges.find((e: any) => e.source === currentNode.id);
        if (nextEdge) {
          await supabase.from("journey_enrollments")
            .update({ current_node_id: nextEdge.target, next_action_at: new Date().toISOString() })
            .eq("id", enrollment.id);
        }
        processed++;
      }
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
