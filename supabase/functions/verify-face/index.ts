import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profilePhotoUrl, attendancePhotoUrl, attendanceRecordId } = await req.json();
    
    if (!profilePhotoUrl || !attendancePhotoUrl) {
      return new Response(
        JSON.stringify({ error: "Both profile photo and attendance photo URLs are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use Lovable AI with vision capabilities to compare faces
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a facial verification assistant. Compare the two face images and determine if they are the same person.
            
Analyze:
1. Facial structure and features
2. Eye shape and positioning
3. Nose and mouth characteristics
4. Overall face shape

Respond with ONLY a JSON object (no markdown, no code blocks):
{
  "match": true/false,
  "confidence": 0-100,
  "reason": "brief explanation"
}

If confidence >= 70, set match to true. Otherwise false.
If either image doesn't clearly show a face, set confidence to 0 and match to false.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Compare these two face photos and determine if they are the same person. First image is the profile/reference photo, second is the attendance photo."
              },
              {
                type: "image_url",
                image_url: { url: profilePhotoUrl }
              },
              {
                type: "image_url",
                image_url: { url: attendancePhotoUrl }
              }
            ]
          }
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    console.log("AI Response:", content);

    // Parse the AI response
    let result;
    try {
      // Clean the response - remove markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      result = JSON.parse(cleanedContent);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      result = { match: false, confidence: 0, reason: "Unable to analyze faces" };
    }

    const verificationStatus = result.match ? "matched" : "mismatch";
    const matchScore = result.confidence || 0;

    // Update attendance record if ID provided
    if (attendanceRecordId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (supabaseUrl && supabaseKey) {
        await fetch(`${supabaseUrl}/rest/v1/attendance_records?id=eq.${attendanceRecordId}`, {
          method: "PATCH",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify({
            face_verification_status: verificationStatus,
            face_match_score: matchScore
          })
        });
      }
    }

    return new Response(
      JSON.stringify({
        status: verificationStatus,
        score: matchScore,
        reason: result.reason
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Face verification error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
