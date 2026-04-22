// WhatsApp Configuration endpoint.
// Returns sender info from Twilio (via the Lovable connector gateway) plus
// locally-stored metadata (webhook URL, business name, throughput).
// All Twilio credentials remain server-side.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
): Promise<{ sender: SenderInfo | null; debug: string }> {
  const debugParts: string[] = [];

  // 1) Try Messaging Senders endpoint first
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/Channels/Senders`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
      },
    });
    debugParts.push(`senders:${res.status}`);
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
          sender: {
            phone_number: phone,
            status: String(wa.status || "unknown").toUpperCase(),
            sender_sid: String(wa.sid || ""),
          },
          debug: debugParts.join(","),
        };
      }
    }
  } catch (e) {
    debugParts.push(`senders_err:${e instanceof Error ? e.message : "unk"}`);
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
    debugParts.push(`incoming:${res.status}`);
    if (!res.ok) {
      return { sender: null, debug: debugParts.join(",") };
    }
    const data = await res.json();
    const nums: Array<Record<string, unknown>> = data.incoming_phone_numbers || [];
    const first = nums[0];
    if (!first) return { sender: null, debug: debugParts.join(",") };
    return {
      sender: {
        phone_number: String(first.phone_number || ""),
        status: String(first.status || "in-use").toUpperCase(),
        sender_sid: String(first.sid || ""),
      },
      debug: debugParts.join(","),
    };
  } catch (e) {
    debugParts.push(`incoming_err:${e instanceof Error ? e.message : "unk"}`);
    return { sender: null, debug: debugParts.join(",") };
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

    // Validate JWT if provided
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", ""),
      );
      if (!user) {
        return new Response(
          JSON.stringify({ ok: false, error: "Unauthorized" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

    // Read local config row
    const { data: configRow } = await supabase
      .from("whatsapp_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    let sender: SenderInfo | null = null;
    let debug = "no_keys";
    if (LOVABLE_API_KEY && TWILIO_API_KEY) {
      const result = await fetchTwilioSender(LOVABLE_API_KEY, TWILIO_API_KEY);
      sender = result.sender;
      debug = result.debug;
    }

    // Update local row with latest sender + sync time
    if (configRow) {
      const updates: Record<string, unknown> = {
        last_synced_at: new Date().toISOString(),
      };
      if (sender?.phone_number) {
        updates.sender_number = sender.phone_number;
      }
      await supabase.from("whatsapp_config").update(updates).eq("id", configRow.id);
    }

    const body = {
      ok: true,
      phone_number: sender?.phone_number || configRow?.sender_number || "",
      status: sender?.status || "UNKNOWN",
      sender_sid: sender?.sender_sid || "",
      business_name: configRow?.business_name || "QuickApp",
      webhook_url: configRow?.webhook_url || "",
      throughput: configRow?.throughput || "80 messages per second",
      last_synced_at: new Date().toISOString(),
      debug,
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[whatsapp-config] error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
