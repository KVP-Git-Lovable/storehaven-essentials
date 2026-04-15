import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user auth
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

    // GET: List or single template
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const templateId = url.searchParams.get('id');
      const status = url.searchParams.get('status');
      const category = url.searchParams.get('category');

      if (templateId) {
        const { data, error } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let query = supabase.from('whatsapp_templates').select('*').order('updated_at', { ascending: false });
      if (status) query = query.eq('status', status);
      if (category) query = query.eq('category', category);

      const { data, error } = await query;
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE
    if (req.method === 'DELETE') {
      const body = await req.json();
      const { template_id } = body;

      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', template_id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST: Route by "action" field in body
    if (req.method === 'POST') {
      const body = await req.json();
      const action = body.action || 'create';

      // --- Bulk sync ---
      if (action === 'bulk-sync') {
        const { data: templates } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .in('status', ['submitted'])
          .not('twilio_content_sid', 'is', null);

        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');

        if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
          return new Response(JSON.stringify({ error: 'Twilio not configured' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const results = [];
        for (const tmpl of templates || []) {
          try {
            const resp = await fetch(
              `${GATEWAY_URL}/v1/Content/${tmpl.twilio_content_sid}/ApprovalRequests`,
              {
                headers: {
                  'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                  'X-Connection-Api-Key': TWILIO_API_KEY,
                },
              }
            );
            const data = await resp.json();
            const whatsappStatus = data?.whatsapp?.status;

            if (whatsappStatus === 'approved' || whatsappStatus === 'rejected') {
              await supabase
                .from('whatsapp_templates')
                .update({
                  status: whatsappStatus,
                  rejection_reason: whatsappStatus === 'rejected'
                    ? (data?.whatsapp?.rejection_reason || 'Unknown')
                    : null,
                })
                .eq('id', tmpl.id);
            }
            results.push({ id: tmpl.id, status: whatsappStatus || tmpl.status });
          } catch (e) {
            results.push({ id: tmpl.id, error: String(e) });
          }
        }

        return new Response(JSON.stringify({ synced: results.length, results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // --- Refresh status ---
      if (action === 'refresh-status') {
        const { template_id } = body;

        if (!template_id) {
          return new Response(JSON.stringify({ error: 'template_id is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: template } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .eq('id', template_id)
          .single();

        if (!template || !template.twilio_content_sid) {
          return new Response(JSON.stringify({ error: 'Template not found or not submitted to Twilio' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');

        if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
          return new Response(JSON.stringify({ error: 'Twilio not configured' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const twilioResponse = await fetch(
          `${GATEWAY_URL}/v1/Content/${template.twilio_content_sid}/ApprovalRequests`,
          {
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'X-Connection-Api-Key': TWILIO_API_KEY,
            },
          }
        );

        const approvalData = await twilioResponse.json();
        let newStatus = template.status;
        let rejectionReason = template.rejection_reason;

        if (twilioResponse.ok) {
          const whatsappStatus = approvalData?.whatsapp?.status;
          if (whatsappStatus === 'approved') {
            newStatus = 'approved';
          } else if (whatsappStatus === 'rejected') {
            newStatus = 'rejected';
            rejectionReason = approvalData?.whatsapp?.rejection_reason || 'Unknown reason';
          }
        }

        const { data: updated } = await supabase
          .from('whatsapp_templates')
          .update({ status: newStatus, rejection_reason: rejectionReason })
          .eq('id', template_id)
          .select()
          .single();

        return new Response(JSON.stringify(updated), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // --- Create template (default action) ---
      const { name, category, language, body: templateBody } = body;

      if (!name || !category || !templateBody) {
        return new Response(JSON.stringify({ error: 'name, category, and body are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!/^[a-z][a-z0-9_]*$/.test(name)) {
        return new Response(JSON.stringify({ error: 'Name must be lowercase with underscores only' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!['UTILITY', 'MARKETING', 'AUTHENTICATION'].includes(category)) {
        return new Response(JSON.stringify({ error: 'Invalid category' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: template, error: insertError } = await supabase
        .from('whatsapp_templates')
        .insert({
          name,
          category,
          language: language || 'en',
          body: templateBody,
          status: 'draft',
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Try to submit to Twilio Content API
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');

      if (LOVABLE_API_KEY && TWILIO_API_KEY) {
        try {
          const twilioResponse = await fetch(`${GATEWAY_URL}/v1/Content`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'X-Connection-Api-Key': TWILIO_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              friendly_name: name,
              language: language || 'en',
              variables: {},
              types: {
                'twilio/text': {
                  body: templateBody,
                },
              },
            }),
          });

          const twilioData = await twilioResponse.json();

          if (twilioResponse.ok && twilioData.sid) {
            await supabase
              .from('whatsapp_templates')
              .update({
                twilio_content_sid: twilioData.sid,
                status: 'submitted',
              })
              .eq('id', template.id);

            template.twilio_content_sid = twilioData.sid;
            template.status = 'submitted';
          } else {
            console.error('Twilio Content API error:', twilioData);
          }
        } catch (twilioError) {
          console.error('Twilio submission error:', twilioError);
        }
      }

      return new Response(JSON.stringify(template), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
