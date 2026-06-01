// Public Twilio inbound WhatsApp webhook.
// Replies to greetings with a Trayi Jewellery welcome message via TwiML.
// Non-greeting messages return an empty TwiML response, leaving room for
// future intent handlers (orders, products, etc.) without interfering.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GREETING_RE = /^\s*(hi|hello|hey|start)[\s!.?,]*$/i;
const WELCOME =
  "Welcome to Trayi Jewellery. ✨ I am your StoreOps assistant. How may I assist you today?";

// Assistance intent: explicit cry-for-help keywords. Checked BEFORE product
// intent so phrases like "need help on some orders" route to the fallback
// (assistance request) flow instead of the product template.
const ASSISTANCE_INTENT_RE =
  /\b(help|support|assist|assistance|issue|issues|problem|problems)\b|\bnot\s+working\b/i;

// Order history intent: regex-based detection across natural variations
// ("my last order", "need my recent orders", "order history", etc.).
// Checked AFTER assistance but BEFORE store-location/product/fallback.
const ORDER_HISTORY_PATTERNS: RegExp[] = [
  /my.*order/i,
  /last.*order/i,
  /recent.*order/i,
  /order.*history/i,
  /order.*info/i,
  /order.*details/i,
  /\borders?\b/i,
];
const isOrderHistoryIntent = (text: string): boolean =>
  ORDER_HISTORY_PATTERNS.some((re) => re.test(text));

// Purchase intent: deterministic regex match for buy/purchase queries.
// Checked AFTER assistance but BEFORE order-history so phrases like
// "place order" / "want to buy" route to the catalogue reply rather
// than being captured by the broader /\borders?\b/i order-history pattern.
const PURCHASE_INTENT_PATTERNS: RegExp[] = [
  /place.*order/i,
  /need.*buy/i,
  /want.*buy/i,
  /want.*purchase/i,
  /would.*like.*buy/i,
  /would.*like.*purchase/i,
  /\bbuy\b/i,
  /\bpurchase\b/i,
];
const isPurchaseIntent = (text: string): boolean =>
  PURCHASE_INTENT_PATTERNS.some((re) => re.test(text));

const PURCHASE_INTENT_REPLY =
  "That's wonderful to hear! At Trayi Jewellers, we specialise in finely curated jewellery, including exquisite diamonds and necklaces.\n\nYou can explore our latest collections on the 'Products' page here:\nhttps://trayijewellers.in/";

// Store location intent: deterministic phrase match for address enquiries.
const STORE_LOCATION_INTENT_RE =
  /\b(where\s+is\s+your\s+store|where\s+are\s+you\s+located|store\s+address|store\s+location|your\s+address|your\s+location|location|address)\b/i;

const STORE_LOCATION_REPLY =
  "We are located at:\n\n2nd Floor, Bharath Mall,\nOpp KSRTC Bus Stand,\nBejai, Mangalore - 575003.\n\nYou may reach us at +91 8971783030 for any queries,\nor visit our website:\nhttps://trayijewellers.in/\n\nPlease note: We currently do not have any branches.";

const NO_ORDERS_REPLY =
  "I could not find any past orders associated with your number. If you need help, I can log a request for assistance.";

// Product Inquiry intent: keyword match (case-insensitive, word-boundary)
const PRODUCT_INTENT_RE = /\b(products?|diamonds?|jewell?ery|collections?|items?)\b/i;
const PRODUCT_TEMPLATE_SID = "HX440122d86a157cb01de5f75a3aba1dd3";
const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";

async function sendProductTemplate(
  toNumber: string,
  fromNumber: string,
  customerId: string | null,
): Promise<void> {
  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const twilioKey = Deno.env.get("TWILIO_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!lovableKey || !twilioKey) {
      console.warn("[whatsapp-inbound] product-intent: missing Twilio/Lovable keys, skipping");
      return;
    }
    if (!toNumber || !/^\+[1-9]\d{1,14}$/.test(toNumber)) {
      console.warn("[whatsapp-inbound] product-intent: invalid recipient", toNumber);
      return;
    }

    let sender = fromNumber;
    if ((!sender || !/^\+[1-9]\d{1,14}$/.test(sender)) && supabaseUrl && serviceKey) {
      try {
        const sb = createClient(supabaseUrl, serviceKey);
        const { data: cfg } = await sb
          .from("whatsapp_config")
          .select("sender_number")
          .limit(1)
          .maybeSingle();
        if (cfg?.sender_number) sender = String(cfg.sender_number);
      } catch (e) {
        console.error("[whatsapp-inbound] product-intent: sender lookup err", e);
      }
    }
    if (!sender || !/^\+[1-9]\d{1,14}$/.test(sender)) {
      console.warn("[whatsapp-inbound] product-intent: no valid sender number");
      return;
    }

    const statusCallbackUrl = supabaseUrl
      ? `${supabaseUrl}/functions/v1/whatsapp-inbound?event=status`
      : null;

    const params = new URLSearchParams({
      To: `whatsapp:${toNumber}`,
      From: `whatsapp:${sender}`,
      ContentSid: PRODUCT_TEMPLATE_SID,
    });
    if (statusCallbackUrl) params.set("StatusCallback", statusCallbackUrl);

    const resp = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("[whatsapp-inbound] product-intent: Twilio error", resp.status, data);
      return;
    }
    console.log("[whatsapp-inbound] product-intent: template sent", data?.sid);

    if (supabaseUrl && serviceKey) {
      try {
        const sb = createClient(supabaseUrl, serviceKey);
        await sb.from("whatsapp_messages").insert({
          phone: toNumber,
          customer_id: customerId,
          direction: "outbound",
          message: "[Product Inquiry template]",
          message_type: "template",
          status: data?.status || "queued",
          twilio_message_sid: data?.sid || null,
          is_read: true,
        });
      } catch (e) {
        console.error("[whatsapp-inbound] product-intent: log insert err", e);
      }
    }
  } catch (e) {
    console.error("[whatsapp-inbound] product-intent: unexpected error", e);
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twiml(message?: string): Response {
  const inner = message
    ? `<Message>${escapeXml(message)}</Message>`
    : "";
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
  return new Response(xml, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // Twilio sends application/x-www-form-urlencoded
    const contentType = req.headers.get("content-type") || "";
    let body = "";
    let from = "";
    let to = "";
    let messageSid = "";
    let profileName = "";
    let messageStatus = "";
    let errorCode = "";
    let channelStatusMessage = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = params.get("Body") ?? "";
      from = params.get("From") ?? "";
      to = params.get("To") ?? "";
      messageSid = params.get("MessageSid") ?? "";
      profileName = params.get("ProfileName") ?? "";
      messageStatus = params.get("MessageStatus") ?? "";
      errorCode = params.get("ErrorCode") ?? "";
      channelStatusMessage = params.get("ChannelStatusMessage") ?? "";
    } else if (contentType.includes("application/json")) {
      const json = await req.json().catch(() => ({}));
      body = json.Body ?? json.body ?? "";
      from = json.From ?? json.from ?? "";
      to = json.To ?? json.to ?? "";
      messageSid = json.MessageSid ?? "";
      profileName = json.ProfileName ?? "";
      messageStatus = json.MessageStatus ?? json.messageStatus ?? "";
      errorCode = json.ErrorCode ?? json.errorCode ?? "";
      channelStatusMessage = json.ChannelStatusMessage ?? json.channelStatusMessage ?? "";
    }

    console.log("[whatsapp-inbound]", {
      from,
      to,
      messageSid,
      profileName,
      bodyPreview: body.slice(0, 200),
    });

    const eventType = new URL(req.url).searchParams.get("event") || "inbound";

    // Normalize phone (strip whatsapp: prefix)
    const normalizedFrom = from.replace(/^whatsapp:/i, "").trim();

    if (eventType === "status" && messageSid) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey) {
        const supabase = createClient(supabaseUrl, serviceKey);
        const status = (messageStatus || "unknown").toLowerCase();
        const errorMessage = [errorCode, channelStatusMessage].filter(Boolean).join(": ") || null;

        await supabase
          .from("whatsapp_message_log")
          .update({ status })
          .eq("twilio_message_sid", messageSid);

        await supabase
          .from("whatsapp_messages")
          .update({ status })
          .eq("twilio_message_sid", messageSid);

        // Journey delivery state machine: queued/sent/delivered/read = success path,
        // failed/undelivered = terminal failure. Anything else is intermediate.
        const SUCCESS = new Set(["sent", "delivered", "read"]);
        const FAILURE = new Set(["failed", "undelivered"]);
        const terminalSuccess = SUCCESS.has(status);
        const terminalFailure = FAILURE.has(status);

        const deliveryStatus = terminalSuccess
          ? "delivered"
          : terminalFailure
          ? "failed"
          : "pending";

        // Find the journey_message_log row for this provider SID so we can
        // also advance the matching enrollment.
        const { data: jmlRows } = await supabase
          .from("journey_message_log")
          .select("id, journey_id, enrollment_id, node_id, delivery_status")
          .eq("twilio_message_sid", messageSid);

        await supabase
          .from("journey_message_log")
          .update({
            status,
            delivery_status: deliveryStatus,
            error_message: errorMessage,
            error_code: errorCode || null,
          })
          .eq("twilio_message_sid", messageSid);

        for (const jml of jmlRows || []) {
          // Idempotency: skip if we already advanced/failed this enrollment
          if (jml.delivery_status === "delivered" || jml.delivery_status === "failed") continue;

          if (terminalSuccess) {
            const { data: journey } = await supabase
              .from("journeys")
              .select("canvas_data")
              .eq("id", jml.journey_id)
              .maybeSingle();
            const canvas = (journey?.canvas_data as any) || {};
            const nextEdge = (canvas.edges || []).find((e: any) => e.source === jml.node_id);
            if (nextEdge) {
              await supabase
                .from("journey_enrollments")
                .update({
                  status: "active",
                  current_node_id: nextEdge.target,
                  next_action_at: new Date().toISOString(),
                })
                .eq("id", jml.enrollment_id);
            } else {
              await supabase
                .from("journey_enrollments")
                .update({ status: "completed" })
                .eq("id", jml.enrollment_id);
            }
          } else if (terminalFailure) {
            await supabase
              .from("journey_enrollments")
              .update({ status: "failed" })
              .eq("id", jml.enrollment_id);
          }
        }

        // Engagement events (additive; isolated try/catch — must not break webhook).
        try {
          const EVENT_MAP: Record<string, string> = {
            sent: "sent",
            delivered: "delivered",
            read: "read",
            failed: "failed",
            undelivered: "failed",
          };
          const evt = EVENT_MAP[status];
          if (evt && (jmlRows?.length || 0) > 0) {
            // Resolve contact -> entity_type from journey_contacts
            const contactIds = Array.from(new Set((jmlRows || []).map((r: any) => r.contact_id).filter(Boolean)));
            const contactMap: Record<string, string> = {};
            if (contactIds.length > 0) {
              const { data: contacts } = await supabase
                .from("journey_contacts")
                .select("id, segment_type")
                .in("id", contactIds);
              for (const c of contacts || []) {
                contactMap[c.id] = c.segment_type || "customer";
              }
            }
            const rows = (jmlRows || []).map((r: any) => ({
              journey_id: r.journey_id,
              journey_step_id: r.node_id,
              person_id: r.contact_id,
              entity_type: contactMap[r.contact_id] || "customer",
              whatsapp_message_sid: messageSid,
              event_type: evt,
              event_timestamp: new Date().toISOString(),
              metadata_json: { error_code: errorCode || null, error_message: errorMessage },
            }));
            if (rows.length > 0) {
              // ignoreDuplicates so re-deliveries of same webhook are no-ops
              const { error: evErr } = await supabase
                .from("journey_message_events")
                .upsert(rows, { onConflict: "whatsapp_message_sid,event_type", ignoreDuplicates: true });
              if (evErr) console.error("[whatsapp-inbound] engagement event insert failed", evErr);
            }
          }
        } catch (e) {
          console.error("[whatsapp-inbound] engagement tracking error", e);
        }
      }
      return twiml();
    }

    // Log inbound message + auto-reply (best-effort, never breaks TwiML)
    const logMessages = async (isGreeting: boolean) => {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        console.log("[whatsapp-inbound] logMessages start", {
          hasUrl: !!supabaseUrl,
          hasKey: !!serviceKey,
          normalizedFrom,
          isGreeting,
        });
        if (!supabaseUrl || !serviceKey || !normalizedFrom) {
          console.warn("[whatsapp-inbound] missing config or phone, skipping log");
          return;
        }
        const supabase = createClient(supabaseUrl, serviceKey);

        // Lookup customer by phone — try exact match, then last-10-digits suffix.
        let customerId: string | null = null;
        const last10 = normalizedFrom.replace(/\D/g, "").slice(-10);
        try {
          const { data: exact } = await supabase
            .from("customers")
            .select("id")
            .eq("phone", normalizedFrom)
            .limit(1)
            .maybeSingle();
          if (exact?.id) {
            customerId = exact.id;
          } else if (last10.length === 10) {
            const { data: fuzzy } = await supabase
              .from("customers")
              .select("id")
              .ilike("phone", `%${last10}`)
              .limit(1)
              .maybeSingle();
            if (fuzzy?.id) customerId = fuzzy.id;
          }
        } catch (lookupErr) {
          console.error("[whatsapp-inbound] customer lookup error:", lookupErr);
        }

        const inboundRow = {
          phone: normalizedFrom,
          customer_id: customerId,
          direction: "inbound",
          message: body,
          message_type: "text",
          status: "received",
          twilio_message_sid: messageSid || null,
          profile_name: profileName || null,
          is_read: false,
        };
        const { data: insIn, error: insInErr } = await supabase
          .from("whatsapp_messages")
          .insert(inboundRow)
          .select("id")
          .maybeSingle();
        if (insInErr) {
          console.error("[whatsapp-inbound] insert inbound error:", insInErr);
        } else {
          console.log("[whatsapp-inbound] inbound saved", insIn?.id);
        }

        // Self-heal: capture our own WhatsApp sender number from the `To` field
        // so outbound flows (journeys, campaigns) have a from_number even when
        // Twilio's senders API returns empty.
        try {
          const normalizedTo = (to || "").replace(/^whatsapp:/i, "").trim();
          if (normalizedTo && /^\+[1-9]\d{1,14}$/.test(normalizedTo)) {
            const { data: cfg } = await supabase
              .from("whatsapp_config")
              .select("id, sender_number")
              .limit(1)
              .maybeSingle();
            if (cfg && !cfg.sender_number) {
              await supabase
                .from("whatsapp_config")
                .update({ sender_number: normalizedTo })
                .eq("id", cfg.id);
              console.log("[whatsapp-inbound] auto-set sender_number to", normalizedTo);
            }
          }
        } catch (e) {
          console.error("[whatsapp-inbound] sender_number self-heal error:", e);
        }

        if (isGreeting) {
          const { data: insOut, error: insOutErr } = await supabase
            .from("whatsapp_messages")
            .insert({
              phone: normalizedFrom,
              customer_id: customerId,
              direction: "outbound",
              message: WELCOME,
              message_type: "text",
              status: "sent",
              is_read: true,
            })
            .select("id")
            .maybeSingle();
          if (insOutErr) {
            console.error("[whatsapp-inbound] insert outbound error:", insOutErr);
          } else {
            console.log("[whatsapp-inbound] outbound (welcome) saved", insOut?.id);
          }
        }
      } catch (e) {
        console.error("[whatsapp-inbound] log error:", e);
      }
    };

    // 1) Greeting check runs FIRST, before any other intent logic.
    if (GREETING_RE.test(body)) {
      await logMessages(true);
      return twiml(WELCOME);
    }

    // 2) Assistance intent — checked BEFORE product intent so phrases like
    //    "need help on some orders" are routed to the fallback (assistance
    //    request) flow instead of the product template.
    const isAssistanceIntent = ASSISTANCE_INTENT_RE.test(body);

    // 2a) Purchase intent — deterministic guided reply to the catalogue.
    //     Runs before order-history so "place order" / "want to buy" don't
    //     get misrouted by the broad /\borders?\b/i order-history pattern.
    const purchaseIntentDetected = !isAssistanceIntent && isPurchaseIntent(body);
    if (purchaseIntentDetected) {
      console.log("[whatsapp-inbound] purchase-intent matched", {
        bodyPreview: body.slice(0, 120),
      });
      await logMessages(false);
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && serviceKey && normalizedFrom) {
          const sb = createClient(supabaseUrl, serviceKey);
          await sb.from("whatsapp_messages").insert({
            phone: normalizedFrom,
            customer_id: null,
            direction: "outbound",
            message: PURCHASE_INTENT_REPLY,
            message_type: "text",
            status: "sent",
            is_read: true,
          });
        }
      } catch (e) {
        console.error("[whatsapp-inbound] purchase-intent outbound log err", e);
      }
      return twiml(PURCHASE_INTENT_REPLY);
    }

    // 2b) Order history intent — regex-based detection. Fetch last 3
    //     orders for the customer matched on phone and reply via TwiML.
    const orderIntentDetected =
      !isAssistanceIntent && !purchaseIntentDetected && isOrderHistoryIntent(body);
    console.log("[whatsapp-inbound] intent", {
      bodyPreview: body.slice(0, 120),
      isAssistanceIntent,
      purchaseIntentDetected,
      orderIntentDetected,
    });
    if (orderIntentDetected) {
      await logMessages(false);
      let reply = NO_ORDERS_REPLY;
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && serviceKey && normalizedFrom) {
          const sb = createClient(supabaseUrl, serviceKey);
          const last10 = normalizedFrom.replace(/\D/g, "").slice(-10);
          let customerId: string | null = null;
          const { data: exact } = await sb
            .from("customers")
            .select("id")
            .eq("phone", normalizedFrom)
            .limit(1)
            .maybeSingle();
          if (exact?.id) customerId = exact.id;
          else if (last10.length === 10) {
            const { data: fuzzy } = await sb
              .from("customers")
              .select("id")
              .ilike("phone", `%${last10}`)
              .limit(1)
              .maybeSingle();
            if (fuzzy?.id) customerId = fuzzy.id;
          }

          if (customerId) {
            const { data: orders } = await sb
              .from("orders")
              .select("id, order_number, created_at, total_amount, order_items(quantity, products:item_id(name))")
              .eq("customer_id", customerId)
              .order("created_at", { ascending: false })
              .limit(3);

            console.log("[whatsapp-inbound] order-history fetched", {
              customerId,
              count: Array.isArray(orders) ? orders.length : 0,
            });

            if (orders && orders.length > 0) {
              const lines = ["Here are your last 3 orders:", ""];
              for (const o of orders as any[]) {
                const dateStr = o.created_at
                  ? new Date(o.created_at).toLocaleDateString("en-IN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "";
                lines.push(`Order #${o.order_number} (${dateStr})`);
                const items = Array.isArray(o.order_items) ? o.order_items : [];
                if (items.length === 0) {
                  lines.push("  (no items)");
                } else {
                  for (const it of items) {
                    const pname = it?.products?.name || "Item";
                    lines.push(`  ${pname} x ${it?.quantity ?? 1}`);
                  }
                }
                lines.push("");
              }
              lines.push("Let me know if you need more details on any order.");
              reply = lines.join("\n");
            }
          }

          // Log the outbound reply on the conversation thread.
          try {
            await sb.from("whatsapp_messages").insert({
              phone: normalizedFrom,
              customer_id: customerId,
              direction: "outbound",
              message: reply,
              message_type: "text",
              status: "sent",
              is_read: true,
            });
          } catch (e) {
            console.error("[whatsapp-inbound] order-history outbound log err", e);
          }
        }
      } catch (e) {
        console.error("[whatsapp-inbound] order-history handler err", e);
      }
      return twiml(reply);
    }

    // 2b) Store location intent — static reply with address/contact details.
    if (!isAssistanceIntent && STORE_LOCATION_INTENT_RE.test(body)) {
      await logMessages(false);
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && serviceKey && normalizedFrom) {
          const sb = createClient(supabaseUrl, serviceKey);
          await sb.from("whatsapp_messages").insert({
            phone: normalizedFrom,
            customer_id: null,
            direction: "outbound",
            message: STORE_LOCATION_REPLY,
            message_type: "text",
            status: "sent",
            is_read: true,
          });
        }
      } catch (e) {
        console.error("[whatsapp-inbound] store-location outbound log err", e);
      }
      return twiml(STORE_LOCATION_REPLY);
    }

    // 3) Product Inquiry intent — sends a predefined Twilio template.
    //    Template send happens via REST (not TwiML), so we still return empty TwiML.
    if (!isAssistanceIntent && PRODUCT_INTENT_RE.test(body)) {
      await logMessages(false);
      // Lookup customer_id again for the outbound row (best-effort).
      let customerId: string | null = null;
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && serviceKey && normalizedFrom) {
          const sb = createClient(supabaseUrl, serviceKey);
          const last10 = normalizedFrom.replace(/\D/g, "").slice(-10);
          const { data: exact } = await sb
            .from("customers")
            .select("id")
            .eq("phone", normalizedFrom)
            .limit(1)
            .maybeSingle();
          if (exact?.id) customerId = exact.id;
          else if (last10.length === 10) {
            const { data: fuzzy } = await sb
              .from("customers")
              .select("id")
              .ilike("phone", `%${last10}`)
              .limit(1)
              .maybeSingle();
            if (fuzzy?.id) customerId = fuzzy.id;
          }
        }
      } catch (e) {
        console.error("[whatsapp-inbound] product-intent customer lookup err", e);
      }
      const senderNumber = (to || "").replace(/^whatsapp:/i, "").trim();
      await sendProductTemplate(normalizedFrom, senderNumber, customerId);
      return twiml();
    }

    // 3) Fallback: bot couldn't help. Apologise, log a request for the team.
    const FALLBACK_REPLY =
      "I'm sorry, I do not have that information right now. Meanwhile, I will log a request for assistance on your behalf so that a member of our team can help you shortly.";

    // Skip empty bodies (e.g. media-only messages with no text) to avoid noise.
    if (!body || !body.trim()) {
      await logMessages(false);
      return twiml();
    }

    await logMessages(false);

    // Best-effort: log the apology as outbound + create a whatsapp_requests row.
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey && normalizedFrom) {
        const sb = createClient(supabaseUrl, serviceKey);

        // Resolve customer for name/id (city column not yet on customers).
        let customerId: string | null = null;
        let customerName: string | null = null;
        try {
          const last10 = normalizedFrom.replace(/\D/g, "").slice(-10);
          const { data: exact } = await sb
            .from("customers")
            .select("id, name")
            .eq("phone", normalizedFrom)
            .limit(1)
            .maybeSingle();
          if (exact?.id) {
            customerId = exact.id;
            customerName = exact.name ?? null;
          } else if (last10.length === 10) {
            const { data: fuzzy } = await sb
              .from("customers")
              .select("id, name")
              .ilike("phone", `%${last10}`)
              .limit(1)
              .maybeSingle();
            if (fuzzy?.id) {
              customerId = fuzzy.id;
              customerName = fuzzy.name ?? null;
            }
          }
        } catch (e) {
          console.error("[whatsapp-inbound] fallback customer lookup err", e);
        }

        // Find the inbound message id we just inserted (most recent for this phone).
        let inboundMessageId: string | null = null;
        try {
          const { data: lastIn } = await sb
            .from("whatsapp_messages")
            .select("id")
            .eq("phone", normalizedFrom)
            .eq("direction", "inbound")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastIn?.id) inboundMessageId = lastIn.id;
        } catch (e) {
          console.error("[whatsapp-inbound] fallback inbound lookup err", e);
        }

        // Log the apology reply into the conversation thread.
        try {
          await sb.from("whatsapp_messages").insert({
            phone: normalizedFrom,
            customer_id: customerId,
            direction: "outbound",
            message: FALLBACK_REPLY,
            message_type: "text",
            status: "sent",
            is_read: true,
          });
        } catch (e) {
          console.error("[whatsapp-inbound] fallback outbound insert err", e);
        }

        // Insert the structured request row.
        try {
          const { error: reqErr } = await sb.from("whatsapp_requests").insert({
            phone_number: normalizedFrom,
            customer_id: customerId,
            customer_name: customerName ?? profileName ?? null,
            request_type: "Assistance",
            message_text: body,
            city: null,
            conversation_phone: normalizedFrom,
            inbound_message_id: inboundMessageId,
            status: "Open",
          });
          if (reqErr) console.error("[whatsapp-inbound] request insert err", reqErr);
        } catch (e) {
          console.error("[whatsapp-inbound] request insert exception", e);
        }
      }
    } catch (e) {
      console.error("[whatsapp-inbound] fallback handler err", e);
    }

    return twiml(FALLBACK_REPLY);
  } catch (error) {
    console.error("[whatsapp-inbound] error:", error);
    // Always return valid TwiML so Twilio doesn't retry-storm.
    return twiml();
  }
});
