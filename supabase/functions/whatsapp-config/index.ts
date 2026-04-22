// WhatsApp Configuration endpoint.
// Returns sender info from Twilio (via the Lovable connector gateway) plus
// locally-stored metadata (webhook URL, business name, throughput).
// All Twilio credentials remain server-side.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

interface SenderInfo {
  phone_number: string;
  status: string;
  sender_sid: string;
}

async function fetchTwilioSender(
  lovableKey: string,
  twilioKey: string,
): Promise<SenderInfo | null> {
  // 1) Try Messaging Senders endpoint first
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/Channels/Senders`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
      },
    });
    if (res.ok) {
      const data = await res.json();
      const senders: Array<Record<string, unknown>> = data.senders || [];
      const wa = senders.find((s) => {
        const sid = String(s.sender_id || "");
        const props = s.properties as Record<string, unknown> | undefined;
        const addr = props ? String(props.address || "") : "";
        return sid.startsWith("whatsapp:") || addr.startsWith("whatsapp:");
      });
      if (wa) {
        const sid = String(wa.sender_id || "");
        const props = wa.properties as Record<string, unknown> | undefined;
        const addr = props ? String(props.address || "") : "";
        const phone = (sid || addr).replace(/^whatsapp:/, "");
        return {
          phone_number: phone,
          status: String(wa.status || "unknown").toUpperCase(),
          sender_sid: String(wa.sid || ""),
        };
      }
    } else {
      console.log("[whatsapp-config] Senders endpoint not usable", res.status);
    }
  } catch (e) {
    console.log("[whatsapp-config] Senders fetch error:", e);
  }

  // 2) Fallback: IncomingPhoneNumbers (account-scoped REST API)
  try {
    const res = await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers.json`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
      },
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("[whatsapp-config] Fallback failed", res.status, txt);
      return null;
    }
    const data = await res.json();
    const nums: Array<Record<string, unknown>> = data.incoming_phone_numbers || [];
    const first = nums[0];
    if (!first) return null;
    return {
      phone_number: String(first.phone_number || ""),
      status: String(first.status || "in-use").toUpperCase(),
      sender_sid: String(first.sid || ""),
    };
  } catch (e) {
    console.error("[whatsapp-config] Fallback error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Twilio connector not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Read local config row
    const { data: configRow } = await supabase
      .from("whatsapp_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    // Fetch sender info from Twilio
    const sender = await fetchTwilioSender(LOVABLE_API_KEY, TWILIO_API_KEY);

    // Update local row with latest sender + sync time
    if (configRow && sender) {
      await supabase
        .from("whatsapp_config")
        .update({
          sender_number: sender.phone_number,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", configRow.id);
    } else if (configRow) {
      await supabase
        .from("whatsapp_config")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", configRow.id);
    }

    const body = {
      phone_number: sender?.phone_number || configRow?.sender_number || "",
      status: sender?.status || "UNKNOWN",
      sender_sid: sender?.sender_sid || "",
      business_name: configRow?.business_name || "QuickApp",
      webhook_url: configRow?.webhook_url || "",
      throughput: configRow?.throughput || "80 messages per second",
      last_synced_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[whatsapp-config] error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
