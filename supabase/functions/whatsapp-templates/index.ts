import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONTENT_API_BASE = 'https://content.twilio.com';

// Inspect a Twilio Content `types` map and derive normalized template metadata
// (template type, media URL, whether the media URL is variable-driven, and the
// full set of required {{N}} or {{name}} variables across body + media).
function deriveTwilioMetadata(types: Record<string, any> | null | undefined) {
  const t = types && typeof types === 'object' ? types : {};
  const knownTypes = Object.keys(t);
  // Prefer media when present so the UI surfaces the asset clearly.
  const templateType = knownTypes.find((k) => k === 'twilio/media')
    || knownTypes.find((k) => k === 'twilio/text')
    || knownTypes[0]
    || null;

  let mediaUrl: string | null = null;
  let mediaIsVariable = false;
  const media = t['twilio/media'];
  if (media && typeof media === 'object') {
    const candidate = Array.isArray(media.media) ? media.media[0] : media.media;
    if (typeof candidate === 'string' && candidate.length > 0) {
      mediaUrl = candidate;
      mediaIsVariable = /\{\{[^}]+\}\}/.test(candidate);
    }
  }

  // Collect every placeholder referenced anywhere in the content definition
  const required = new Set<string>();
  const collect = (s: unknown) => {
    if (typeof s !== 'string') return;
    const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) required.add(m[1]);
  };
  for (const v of Object.values(t)) {
    if (!v || typeof v !== 'object') continue;
    const obj = v as Record<string, unknown>;
    collect(obj.body);
    collect((obj as any).media);
    if (Array.isArray((obj as any).media)) (obj as any).media.forEach(collect);
    // CTA / list templates also have headers, footers, actions, items
    collect((obj as any).header);
    collect((obj as any).footer);
    if (Array.isArray((obj as any).actions)) {
      for (const a of (obj as any).actions) {
        if (a && typeof a === 'object') {
          collect(a.title); collect(a.url); collect(a.phone);
        }
      }
    }
  }

  return {
    templateType,
    mediaUrl,
    mediaIsVariable,
    requiredVariables: Array.from(required),
  };
}

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
          let status = 'pending';
          let rejectionReason = null;
          let userInitiatedApproved = false;

          // Try to fetch approval status
          try {
            const approvalResp = await fetch(
              `${CONTENT_API_BASE}/v1/Content/${content.sid}/ApprovalRequests`,
              { headers: { 'Authorization': twilio.authHeader } }
            );
            if (approvalResp.ok) {
              const approvalData = await approvalResp.json();
              const waStatus = approvalData?.whatsapp?.status;
               if (waStatus === 'approved') {
                 status = 'approved';
                 userInitiatedApproved = true;
               } else if (waStatus === 'rejected') {
                status = 'rejected';
                rejectionReason = approvalData?.whatsapp?.rejection_reason || 'Unknown';
                userInitiatedApproved = false;
               } else if (waStatus) {
                 status = waStatus;
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
            user_initiated_approved: userInitiatedApproved,
            created_by: user.id,
            twilio_content_types: content.types || null,
            twilio_template_type: deriveTwilioMetadata(content.types).templateType,
            twilio_media_url: deriveTwilioMetadata(content.types).mediaUrl,
            twilio_media_is_variable: deriveTwilioMetadata(content.types).mediaIsVariable,
            twilio_required_variables: deriveTwilioMetadata(content.types).requiredVariables,
            twilio_synced_at: new Date().toISOString(),
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
          .in('status', ['submitted', 'pending', 'approved'])
          .not('twilio_content_sid', 'is', null);

        const results = [];
        for (const tmpl of templates || []) {
          try {
            // Fetch BOTH the approval state and the live Content definition
            // so the local row stays a faithful mirror of Twilio's record.
            const [approvalResp, contentResp] = await Promise.all([
              fetch(
                `${CONTENT_API_BASE}/v1/Content/${tmpl.twilio_content_sid}/ApprovalRequests`,
                { headers: { 'Authorization': twilio.authHeader } },
              ),
              fetch(
                `${CONTENT_API_BASE}/v1/Content/${tmpl.twilio_content_sid}`,
                { headers: { 'Authorization': twilio.authHeader } },
              ),
            ]);
            const data = await approvalResp.json();
            const whatsappStatus = data?.whatsapp?.status;

            const userInitiatedApproved = whatsappStatus === 'approved';

            const updates: Record<string, unknown> = {
              user_initiated_approved: userInitiatedApproved,
            };
            if (whatsappStatus) {
              updates.status = whatsappStatus;
              updates.rejection_reason = whatsappStatus === 'rejected'
                ? (data?.whatsapp?.rejection_reason || 'Unknown')
                : null;
            }

            if (contentResp.ok) {
              const contentJson = await contentResp.json();
              const meta = deriveTwilioMetadata(contentJson?.types);
              updates.twilio_content_types = contentJson?.types ?? null;
              updates.twilio_template_type = meta.templateType;
              updates.twilio_media_url = meta.mediaUrl;
              updates.twilio_media_is_variable = meta.mediaIsVariable;
              updates.twilio_required_variables = meta.requiredVariables;
              updates.twilio_synced_at = new Date().toISOString();
            }

            await supabase
              .from('whatsapp_templates')
              .update(updates)
              .eq('id', tmpl.id);

            results.push({ id: tmpl.id, status: whatsappStatus || tmpl.status, user_initiated_approved: userInitiatedApproved });
          } catch (e) {
            results.push({ id: tmpl.id, error: String(e) });
          }
        }

        return new Response(JSON.stringify({ synced: results.length, results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // --- Verify media URL is publicly reachable ---
      if (action === 'verify-media-url') {
        const { url } = body;
        if (!url || typeof url !== 'string') {
          return new Response(JSON.stringify({ ok: false, error: 'url is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        try {
          // HEAD first; some CDNs reject HEAD so fall back to ranged GET
          let resp = await fetch(url, { method: 'HEAD', redirect: 'follow' });
          if (!resp.ok || !resp.headers.get('content-type')) {
            resp = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, redirect: 'follow' });
          }
          const contentType = resp.headers.get('content-type') || null;
          const contentLength = resp.headers.get('content-length');
          return new Response(JSON.stringify({
            ok: resp.ok || resp.status === 206,
            status: resp.status,
            content_type: contentType,
            content_length: contentLength ? Number(contentLength) : null,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({
            ok: false, status: 0, error: e instanceof Error ? e.message : String(e),
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
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
        let userInitiatedApproved = false;

        if (twilioResponse.ok) {
          const whatsappStatus = approvalData?.whatsapp?.status;
          if (whatsappStatus === 'approved') {
            newStatus = 'approved';
            userInitiatedApproved = true;
          } else if (whatsappStatus === 'rejected') {
            newStatus = 'rejected';
            rejectionReason = approvalData?.whatsapp?.rejection_reason || 'Unknown reason';
            userInitiatedApproved = false;
          } else if (whatsappStatus) {
            newStatus = whatsappStatus;
          }
        }

        const { data: updated } = await supabase
          .from('whatsapp_templates')
          .update({
            status: newStatus,
            rejection_reason: rejectionReason,
            user_initiated_approved: userInitiatedApproved,
          })
          .eq('id', template_id)
          .select()
          .single();

        return new Response(JSON.stringify(updated), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // --- Create template (default action) ---
      const { name, category, language, body: templateBody } = body;

      // Strip the friendly-variable mapping marker before sending to Twilio.
      // The marker is preserved in DB so the UI can reconstruct friendly names.
      const MARKER_RE = /\n?<!--vars:\{[^}]*\}-->/;
      const twilioCleanBody = typeof templateBody === 'string'
        ? templateBody.replace(MARKER_RE, '').trimEnd()
        : templateBody;

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
                  body: twilioCleanBody,
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
