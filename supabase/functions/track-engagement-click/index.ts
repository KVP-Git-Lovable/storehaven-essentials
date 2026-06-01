import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FALLBACK_URL = "https://jewellery.quickapp.ai";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("t") || "";
    if (!token) {
      return Response.redirect(FALLBACK_URL, 302);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link } = await supabase
      .from("whatsapp_tracked_links")
      .select("journey_id, journey_step_id, person_id, entity_type, template_id, original_url, whatsapp_message_sid")
      .eq("token", token)
      .maybeSingle();

    if (!link) {
      return Response.redirect(FALLBACK_URL, 302);
    }

    // Fire-and-forget event log
    try {
      await supabase.from("journey_message_events").insert({
        journey_id: link.journey_id,
        journey_step_id: link.journey_step_id,
        person_id: link.person_id,
        entity_type: link.entity_type || "customer",
        whatsapp_message_sid: link.whatsapp_message_sid,
        template_id: link.template_id,
        event_type: "clicked",
        event_timestamp: new Date().toISOString(),
        metadata_json: {
          token,
          user_agent: req.headers.get("user-agent") || null,
          ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        },
      });
    } catch (e) {
      console.error("[track-engagement-click] insert failed", e);
    }

    return Response.redirect(link.original_url, 302);
  } catch (e) {
    console.error("[track-engagement-click] error", e);
    return Response.redirect(FALLBACK_URL, 302);
  }
});
