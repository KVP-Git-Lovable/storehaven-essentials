// Shared helpers for free-form journey message dispatch.
// Channels: whatsapp (Twilio), sms (Twilio), email (Lovable Email).

export type FreeformChannel = "whatsapp" | "sms" | "email";

export interface ChannelSendResult {
  channel: FreeformChannel;
  accepted: boolean;
  status: string; // "sent" | "queued" | "failed"
  errorMessage: string | null;
  errorCode: string | null;
  providerMessageId: string | null;
  providerMetadata: Record<string, unknown> | null;
}

const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";

function getNested(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  let cur: any = obj;
  for (const p of path.split(".")) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function resolveContactToken(contact: any, rawPath: string): string {
  if (!contact) return "";
  let path = rawPath.trim().startsWith("contact.") ? rawPath.trim().slice(8) : rawPath.trim();
  if (path === "name") {
    const n = contact.name;
    if (n != null && String(n).trim()) return String(n);
    const fn = contact.first_name ?? "";
    const ln = contact.last_name ?? "";
    const combined = `${fn} ${ln}`.trim();
    if (combined) return combined;
  }
  const direct = getNested(contact, path);
  if (direct != null && direct !== "") return String(direct);
  const meta = getNested(contact.metadata, path);
  return meta == null ? "" : String(meta);
}

// Replace {{contact.field}} / {field} tokens in free-form body with contact values.
export function renderFreeformBody(body: string, contact: any): string {
  if (!body) return "";
  let out = body.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, inner) => resolveContactToken(contact, inner));
  out = out.replace(/\{\s*([^{}]+?)\s*\}/g, (_m, inner) => resolveContactToken(contact, inner));
  return out;
}

export async function sendWhatsAppFreeform(
  fromNumber: string,
  toNumber: string,
  body: string,
): Promise<ChannelSendResult> {
  const result: ChannelSendResult = {
    channel: "whatsapp",
    accepted: false,
    status: "failed",
    errorMessage: null,
    errorCode: null,
    providerMessageId: null,
    providerMetadata: null,
  };
  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const twilioKey = Deno.env.get("TWILIO_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");
    if (!twilioKey) throw new Error("TWILIO_API_KEY not configured");
    if (!fromNumber || !/^\+[1-9]\d{1,14}$/.test(fromNumber)) throw new Error("Invalid WhatsApp sender number");
    if (!toNumber || !/^\+[1-9]\d{1,14}$/.test(toNumber)) throw new Error("Invalid recipient phone");
    if (!body || !body.trim()) throw new Error("Empty message body");

    const params = new URLSearchParams({
      To: `whatsapp:${toNumber}`,
      From: `whatsapp:${fromNumber}`,
      Body: body,
    });
    const resp = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const data = await resp.json();
    result.providerMetadata = data;
    if (!resp.ok) {
      result.errorCode = String(data?.code || resp.status);
      result.errorMessage = data?.message || `Twilio error ${resp.status}`;
      // Friendly hint for the 24h window failure.
      if (String(data?.code) === "63016") {
        result.errorMessage = `Outside 24h window — Meta requires an approved template. (${data.message})`;
      }
      return result;
    }
    result.accepted = true;
    result.status = data?.status || "queued";
    result.providerMessageId = data?.sid || null;
    return result;
  } catch (e: any) {
    result.errorMessage = e?.message || String(e);
    return result;
  }
}

export async function sendSms(
  fromNumber: string,
  toNumber: string,
  body: string,
): Promise<ChannelSendResult> {
  const result: ChannelSendResult = {
    channel: "sms",
    accepted: false,
    status: "failed",
    errorMessage: null,
    errorCode: null,
    providerMessageId: null,
    providerMetadata: null,
  };
  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const twilioKey = Deno.env.get("TWILIO_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");
    if (!twilioKey) throw new Error("TWILIO_API_KEY not configured");
    if (!fromNumber || !/^\+[1-9]\d{1,14}$/.test(fromNumber)) throw new Error("Invalid SMS sender number — set whatsapp_config.sms_sender_number");
    if (!toNumber || !/^\+[1-9]\d{1,14}$/.test(toNumber)) throw new Error("Invalid recipient phone");
    if (!body || !body.trim()) throw new Error("Empty message body");

    const params = new URLSearchParams({
      To: toNumber,
      From: fromNumber,
      Body: body,
    });
    const resp = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const data = await resp.json();
    result.providerMetadata = data;
    if (!resp.ok) {
      result.errorCode = String(data?.code || resp.status);
      result.errorMessage = data?.message || `Twilio error ${resp.status}`;
      return result;
    }
    result.accepted = true;
    result.status = data?.status || "queued";
    result.providerMessageId = data?.sid || null;
    return result;
  } catch (e: any) {
    result.errorMessage = e?.message || String(e);
    return result;
  }
}

// Email transport — placeholder implementation that logs a pending state until
// Lovable Email is configured for this project. When email infra is present,
// this will be replaced by a call to send-transactional-email or enqueue_email.
export async function sendEmail(
  toEmail: string,
  subject: string,
  body: string,
): Promise<ChannelSendResult> {
  const result: ChannelSendResult = {
    channel: "email",
    accepted: false,
    status: "failed",
    errorMessage: null,
    errorCode: null,
    providerMessageId: null,
    providerMetadata: null,
  };
  if (!toEmail || !/.+@.+\..+/.test(toEmail)) {
    result.errorMessage = "Contact email missing or invalid";
    return result;
  }
  if (!subject?.trim()) {
    result.errorMessage = "Email subject is empty";
    return result;
  }
  if (!body?.trim()) {
    result.errorMessage = "Email body is empty";
    return result;
  }
  result.errorCode = "email_not_configured";
  result.errorMessage =
    "Email sending is not configured yet. Ask an admin to set up Lovable Email (Cloud → Emails) to enable this channel.";
  return result;
}
