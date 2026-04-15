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

    const authHeader = req.headers.get('Authorization');
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

    const body = await req.json();
    const { template_id, to_number, from_number, variables } = body;

    if (!template_id || !to_number || !from_number) {
      return new Response(JSON.stringify({ error: 'template_id, to_number, and from_number are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate E.164 format
    if (!/^\+[1-9]\d{1,14}$/.test(to_number) || !/^\+[1-9]\d{1,14}$/.test(from_number)) {
      return new Response(JSON.stringify({ error: 'Phone numbers must be in E.164 format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get template
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

    if (template.status !== 'approved') {
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

    // Build message body with variables replaced
    let messageBody = template.body;
    if (variables && typeof variables === 'object') {
      Object.keys(variables).forEach((key) => {
        messageBody = messageBody.replace(`{{${key}}}`, variables[key]);
      });
    }

    // Send via Twilio
    const params = new URLSearchParams({
      To: `whatsapp:${to_number}`,
      From: `whatsapp:${from_number}`,
      Body: messageBody,
    });

    if (template.twilio_content_sid) {
      params.set('ContentSid', template.twilio_content_sid);
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
      return new Response(JSON.stringify({ error: `Twilio error [${twilioResponse.status}]: ${JSON.stringify(twilioData)}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log the message
    await supabase.from('whatsapp_message_log').insert({
      template_id,
      to_number,
      twilio_message_sid: twilioData.sid,
      status: twilioData.status || 'queued',
      sent_by: user.id,
    });

    return new Response(JSON.stringify({ success: true, message_sid: twilioData.sid }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
