import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

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
    const {
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

    if (!/^\+[1-9]\d{1,14}$/.test(to_number) || !/^\+[1-9]\d{1,14}$/.test(from_number)) {
      return new Response(JSON.stringify({ error: 'Phone numbers must be in E.164 format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: template, error: tmplError } = await supabase
      .from('whatsapp_templates')
      .select('*')
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

    const params = new URLSearchParams({
      To: `whatsapp:${to_number}`,
      From: `whatsapp:${from_number}`,
    });

    if (template.twilio_content_sid) {
      // Template send: must use ContentSid + ContentVariables.
      // Do NOT send Body — Twilio will reject (error 63019) when both are present
      // or when the template has placeholders and variables are missing/empty.
      params.set('ContentSid', template.twilio_content_sid);

      // Determine how many {{N}} placeholders the template expects
      const placeholderNums = new Set<string>();
      const re = /\{\{(\d+)\}\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(template.body || '')) !== null) placeholderNums.add(m[1]);

      const incoming = (variables && typeof variables === 'object') ? variables as Record<string, string> : {};
      const filled: Record<string, string> = {};
      for (const n of placeholderNums) {
        const v = incoming[n];
        filled[n] = (v != null && String(v).trim() !== '') ? String(v) : 'Customer';
      }
      // Also pass through any extra named variables the caller supplied
      for (const [k, v] of Object.entries(incoming)) {
        if (!(k in filled) && v != null) filled[k] = String(v);
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
      return new Response(JSON.stringify({ error: `Twilio error [${twilioResponse.status}]: ${JSON.stringify(twilioData)}`, twilio: twilioData }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
