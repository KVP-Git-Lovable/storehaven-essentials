import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { toWhatsAppE164IN } from "../_shared/phone-india.ts";

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

function collectActionUrls(contentTypes: unknown): string[] {
  if (!contentTypes || typeof contentTypes !== 'object') return [];
  const urls: string[] = [];
  for (const config of Object.values(contentTypes as Record<string, any>)) {
    const actions = Array.isArray(config?.actions) ? config.actions : [];
    for (const action of actions) {
      if (typeof action?.url === 'string') urls.push(action.url);
    }
  }
  return urls;
}

function normalizeUrlTemplateVariables(
  filled: Record<string, string>,
  actionUrls: string[],
  toNumber: string,
) {
  const recipientDigits = toNumber.replace(/\D/g, '');
  for (const url of actionUrls) {
    const re = /([?&])([^=&?#]+)=\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(url)) !== null) {
      const paramName = match[2].toLowerCase();
      const variableKey = match[3];
      if (paramName.includes('phone') || paramName.includes('mobile') || paramName.includes('whatsapp')) {
        filled[variableKey] = recipientDigits;
        continue;
      }

      const value = filled[variableKey];
      if (value && /\s/.test(value)) filled[variableKey] = encodeURIComponent(value);
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    let {
      template_id, to_number, from_number, variables, order_id,
      allow_user_initiated, internal_caller, journey_enrollment_id,
    } = body;

    // Auth: either a user JWT, OR an internal call from another edge function using the service role key
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    const internalKey = req.headers.get('X-Internal-Service-Key');

    if (internal_caller && internalKey && internalKey === supabaseServiceKey) {
      // Internal service-to-service call (e.g. process-journeys)
      userId = null;
    } else {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing authorization' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = user.id;
    }

    if (!template_id || !to_number || !from_number) {
      return new Response(JSON.stringify({ error: 'template_id, to_number, and from_number are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auto-normalize Indian phone formats (10-digit -> +91XXXXXXXXXX, etc.)
    to_number = toWhatsAppE164IN(to_number) ?? to_number;
    from_number = toWhatsAppE164IN(from_number) ?? from_number;

    if (!/^\+[1-9]\d{1,14}$/.test(to_number) || !/^\+[1-9]\d{1,14}$/.test(from_number)) {
      return new Response(JSON.stringify({ error: 'Phone numbers must be in E.164 format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: template, error: tmplError } = await supabase
      .from('whatsapp_templates')
      .select('*, twilio_content_types, twilio_template_type, twilio_media_url, twilio_media_is_variable, twilio_required_variables')
      .eq('id', template_id)
      .single();

    if (tmplError || !template) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isApproved = template.status === 'approved';
    const isUserInitiated = !!template.user_initiated_approved;
    const eligible = isApproved || (allow_user_initiated && isUserInitiated);
    if (!eligible) {
      return new Response(JSON.stringify({ error: 'Template must be approved before sending' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY is not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
    if (!TWILIO_API_KEY) {
      return new Response(JSON.stringify({ error: 'TWILIO_API_KEY is not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const MARKER_RE = /\n?<!--vars:\{[^}]*\}-->/;
    let messageBody = (template.body || '').replace(MARKER_RE, '').trimEnd();

    if (variables && typeof variables === 'object') {
      Object.keys(variables).forEach((key) => {
        messageBody = messageBody.replaceAll(`{{${key}}}`, variables[key]);
      });
    }

    const statusCallbackUrl = `${supabaseUrl}/functions/v1/whatsapp-inbound?event=status`;

    const params = new URLSearchParams({
      To: `whatsapp:${to_number}`,
      From: `whatsapp:${from_number}`,
      StatusCallback: statusCallbackUrl,
    });

    if (template.twilio_content_sid) {
      // Template send: must use ContentSid + ContentVariables.
      // Do NOT send Body — Twilio will reject (error 63019) when both are present
      // or when the template has placeholders and variables are missing/empty.
      params.set('ContentSid', template.twilio_content_sid);

      // Determine the FULL set of placeholders the template expects.
      // Prefer the synced Twilio metadata (covers body + media + headers + CTAs).
      // Fall back to scanning the local body string for {{N}} when metadata
      // is not yet synced (legacy rows).
      const placeholderNums = new Set<string>();
      const metaRequired: string[] = Array.isArray(template.twilio_required_variables)
        ? (template.twilio_required_variables as string[])
        : [];
      for (const v of metaRequired) placeholderNums.add(String(v));
      if (placeholderNums.size === 0) {
        const re = /\{\{(\w+)\}\}/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(template.body || '')) !== null) placeholderNums.add(m[1]);
      }

      const incoming = (variables && typeof variables === 'object') ? variables as Record<string, string> : {};
      const filled: Record<string, string> = {};
      for (const n of placeholderNums) {
        const v = incoming[n];
        filled[n] = (v != null && String(v).trim() !== '') ? String(v) : '';
      }
      // Also pass through any extra named variables the caller supplied
      for (const [k, v] of Object.entries(incoming)) {
        if (!(k in filled) && v != null) filled[k] = String(v);
      }

      normalizeUrlTemplateVariables(filled, collectActionUrls(template.twilio_content_types), to_number);

      // Media-template guardrail: if the template uses a variable-driven media
      // URL and the caller did NOT supply that variable, fail fast with a clear
      // diagnostic so the journey log says exactly why instead of generic 63019.
      if (template.twilio_template_type === 'twilio/media' && template.twilio_media_is_variable) {
        const mediaUrlTemplate = String(template.twilio_media_url || '');
        const mediaVarMatch = mediaUrlTemplate.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/);
        const mediaVarKey = mediaVarMatch ? mediaVarMatch[1] : null;
        if (mediaVarKey && (!filled[mediaVarKey] || filled[mediaVarKey] === 'Customer')) {
          return new Response(JSON.stringify({
            error: `Template '${template.name}' has a variable media URL ({{${mediaVarKey}}}) but no value was provided for it. Bind the URL in Twilio or pass it in 'variables'.`,
            template_type: template.twilio_template_type,
            media_url: template.twilio_media_url,
            required_variables: metaRequired,
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      if (Object.keys(filled).length > 0) {
        params.set('ContentVariables', JSON.stringify(filled));
      }
    } else {
      // Free-form (session) message: send the rendered Body
      params.set('Body', messageBody);
    }

    const twilioResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TWILIO_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      const errorCode = String(twilioData?.code || twilioData?.error_code || twilioResponse.status);
      const errorMessage = twilioData?.message || twilioData?.error || `Twilio error ${twilioResponse.status}`;
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage,
        errorCode: errorCode,
        twilio: twilioData
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('whatsapp_message_log').insert({
      template_id,
      to_number,
      twilio_message_sid: twilioData.sid,
      status: twilioData.status || 'queued',
      sent_by: userId,
    });

    try {
      const last10 = to_number.replace(/\D/g, '').slice(-10);
      const { data: cust } = await supabase
        .from('customers')
        .select('id')
        .or(`phone.eq.${to_number},phone.ilike.%${last10}`)
        .limit(1)
        .maybeSingle();

      await supabase.from('whatsapp_messages').insert({
        phone: to_number,
        customer_id: cust?.id ?? null,
        direction: 'outbound',
        message: messageBody,
        message_type: 'template',
        order_id: order_id ?? null,
        status: twilioData.status || 'sent',
        twilio_message_sid: twilioData.sid,
        is_read: true,
      });
    } catch (e) {
      console.error('whatsapp_messages insert failed:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      message_sid: twilioData.sid,
      twilio_message_sid: twilioData.sid,
      status: twilioData.status || 'sent',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
