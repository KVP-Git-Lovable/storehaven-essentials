import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentUrls, videoUrls, existingTitle } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build context from documents and video URLs
    let documentContext = "";
    
    // Fetch and read document content from URLs
    if (documentUrls && documentUrls.length > 0) {
      for (const doc of documentUrls) {
        try {
          // For PDFs and documents, we'll extract what we can from the filename/URL
          // In a production system, you'd use a document parsing service
          documentContext += `\nDocument: ${doc.file_name}\nURL: ${doc.file_url}\n`;
        } catch (e) {
          console.error("Error processing document:", e);
        }
      }
    }

    // Process video URLs
    let videoContext = "";
    if (videoUrls && videoUrls.length > 0) {
      videoContext = "\nVideo Resources:\n" + videoUrls.join("\n");
    }

    const systemPrompt = `You are an expert technical writer specializing in creating knowledge base articles for retail operations, asset maintenance, and equipment management for an ice cream store chain.

Based on the provided document names, URLs, and video links, generate a comprehensive knowledge base article. Extract and infer relevant technical information to create:

1. A descriptive title (if not provided)
2. A brief summary (2-3 sentences)
3. Detailed content explaining the topic
4. Category suggestion (one of: general, maintenance, repair, installation, safety, calibration, cleaning, inspection)
5. Article type suggestion (one of: guide, troubleshooting, procedure, reference, faq)
6. Relevant keywords (5-10 comma-separated terms)
7. Do's - list of recommended practices (5-10 items)
8. Don'ts - list of things to avoid (5-10 items)
9. Process Steps - ordered list of steps to follow (5-15 steps)

Return your response as a JSON object with this exact structure:
{
  "title": "Article Title",
  "summary": "Brief summary...",
  "content": "Detailed article content with sections...",
  "category": "maintenance",
  "article_type": "procedure",
  "keywords": ["keyword1", "keyword2"],
  "dos": ["Do this", "Do that"],
  "donts": ["Don't do this", "Avoid that"],
  "process_steps": ["Step 1: ...", "Step 2: ..."]
}`;

    const userPrompt = `Create a knowledge base article based on the following resources:

${existingTitle ? `Existing Title: ${existingTitle}` : ""}

Documents attached:
${documentContext || "No documents attached"}

Video URLs:
${videoContext || "No videos attached"}

Analyze these resources and generate a comprehensive knowledge base article with all the required fields. If documents are technical manuals or brochures, infer the equipment type and create appropriate maintenance/usage guidance.`;

    // Call Lovable AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    // Parse JSON from response
    let parsedContent;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsedContent = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", e);
      // Try to extract any valid JSON object from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedContent = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          parsedContent = { 
            error: "Failed to parse response",
            rawContent: content 
          };
        }
      } else {
        parsedContent = { 
          error: "No valid JSON found",
          rawContent: content 
        };
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: parsedContent,
      generatedAt: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Generate KB content error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
