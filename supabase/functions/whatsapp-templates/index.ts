import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONTENT_API_BASE = 'https://content.twilio.com';

function getTwilioAuth() {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!accountSid || !authToken) return null;
  return {
    accountSid,
    authHeader: 'Basic ' + btoa(`${accountSid}:${authToken}`),
  };
}

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

      // --- Import templates from Twilio ---
      if (action === 'import-from-twilio') {
        const twilio = getTwilioAuth();
        if (!twilio) {
          return new Response(JSON.stringify({ error: 'Twilio credentials not configured' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Fetch all content templates from Twilio
        const resp = await fetch(`${CONTENT_API_BASE}/v1/Content`, {
          headers: { 'Authorization': twilio.authHeader },
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.error('Twilio Content API list error:', errText);
          return new Response(JSON.stringify({ error: `Twilio API error: ${resp.status}` }), {
            status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const twilioData = await resp.json();
        const contents = twilioData.contents || [];

        let imported = 0;
        let skipped = 0;

        for (const content of contents) {
          // Check if already imported
          const { data: existing } = await supabase
            .from('whatsapp_templates')
            .select('id')
            .eq('twilio_content_sid', content.sid)
            .maybeSingle();

          if (existing) {
            skipped++;
            continue;
          }

          // Extract body from content types
          let templateBody = '';
          if (content.types?.['twilio/text']?.body) {
            templateBody = content.types['twilio/text'].body;
          } else if (content.types?.['twilio/media']?.body) {
            templateBody = content.types['twilio/media'].body;
          } else if (content.types?.['twilio/quick-reply']?.body) {
            templateBody = content.types['twilio/quick-reply'].body;
          } else {
            templateBody = JSON.stringify(content.types || {});
          }

          // Determine status from approval info
          let status = 'submitted';
          let rejectionReason = null;

          // Try to fetch approval status
          try {
            const approvalResp = await fetch(
              `${CONTENT_API_BASE}/v1/Content/${content.sid}/ApprovalRequests`,
              { headers: { 'Authorization': twilio.authHeader } }
            );
            if (approvalResp.ok) {
              const approvalData = await approvalResp.json();
              const waStatus = approvalData?.whatsapp?.status;
              if (waStatus === 'approved') status = 'approved';
              else if (waStatus === 'rejected') {
                status = 'rejected';
                rejectionReason = approvalData?.whatsapp?.rejection_reason || 'Unknown';
              }
            }
          } catch (e) {
            console.error('Error fetching approval for', content.sid, e);
          }

          const categoryMap: Record<string, string> = {
            'twilio/text': 'UTILITY',
            'twilio/media': 'MARKETING',
            'twilio/quick-reply': 'UTILITY',
          };
          const firstType = Object.keys(content.types || {})[0] || '';
          const category = categoryMap[firstType] || 'UTILITY';

          await supabase.from('whatsapp_templates').insert({
            name: content.friendly_name || content.sid,
            category,
            language: content.language || 'en',
            body: templateBody,
            twilio_content_sid: content.sid,
            status,
            rejection_reason: rejectionReason,
            created_by: user.id,
          });

          imported++;
        }

        return new Response(JSON.stringify({ imported, skipped, total: contents.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // --- Bulk sync statuses ---
      if (action === 'bulk-sync') {
        const twilio = getTwilioAuth();
        if (!twilio) {
          return new Response(JSON.stringify({ error: 'Twilio credentials not configured' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: templates } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .in('status', ['submitted'])
          .not('twilio_content_sid', 'is', null);

        const results = [];
        for (const tmpl of templates || []) {
          try {
            const resp = await fetch(
              `${CONTENT_API_BASE}/v1/Content/${tmpl.twilio_content_sid}/ApprovalRequests`,
              { headers: { 'Authorization': twilio.authHeader } }
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

        const twilio = getTwilioAuth();
        if (!twilio) {
          return new Response(JSON.stringify({ error: 'Twilio credentials not configured' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

        const twilioResponse = await fetch(
          `${CONTENT_API_BASE}/v1/Content/${template.twilio_content_sid}/ApprovalRequests`,
          { headers: { 'Authorization': twilio.authHeader } }
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

      // Insert into DB as draft
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

      // Submit to Twilio Content API
      const twilio = getTwilioAuth();
      if (twilio) {
        try {
          const twilioResponse = await fetch(`${CONTENT_API_BASE}/v1/Content`, {
            method: 'POST',
            headers: {
              'Authorization': twilio.authHeader,
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
            // Submit for WhatsApp approval
            try {
              await fetch(`${CONTENT_API_BASE}/v1/Content/${twilioData.sid}/ApprovalRequests/whatsapp`, {
                method: 'POST',
                headers: {
                  'Authorization': twilio.authHeader,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name,
                  category: category.toLowerCase(),
                }),
              });
            } catch (approvalErr) {
              console.error('WhatsApp approval submission error:', approvalErr);
            }

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
            console.error('Twilio Content API error:', JSON.stringify(twilioData));
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
