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
    
    // Validate that both photos are provided
    if (!profilePhotoUrl) {
      return new Response(
        JSON.stringify({ 
          error: "baseline_missing",
          status: "blocked",
          score: 0,
          reason: "Baseline profile photo missing – verification required"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!attendancePhotoUrl) {
      return new Response(
        JSON.stringify({ 
          error: "photo_missing",
          status: "blocked",
          score: 0,
          reason: "Attendance photo is required"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
            content: `You are a facial verification assistant. Your job is to:
1. First, detect if there is a clear human face in EACH image
2. If both images contain clear faces, compare them to determine if they are the same person

IMPORTANT RULES:
- If the first image (profile photo) does NOT contain a clear human face, respond with face_detection_failed for "profile"
- If the second image (attendance photo) does NOT contain a clear human face, respond with face_detection_failed for "attendance"
- A "clear face" means: visible eyes, nose, and mouth; not blurry; not too dark; not obscured by objects
- Only calculate match confidence if BOTH images contain valid faces

Respond with ONLY a JSON object (no markdown, no code blocks):
{
  "profile_face_detected": true/false,
  "attendance_face_detected": true/false,
  "face_detection_error": null or "profile" or "attendance" or "both",
  "match": true/false (only valid if both faces detected),
  "confidence": 0-100 (only valid if both faces detected),
  "reason": "brief explanation"
}

If confidence >= 70 and both faces detected, set match to true. Otherwise false.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze these two images. First image is the profile/baseline photo, second is the attendance photo. First check if each contains a clear human face, then compare if both do."
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
        max_tokens: 300,
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
      result = { 
        profile_face_detected: false,
        attendance_face_detected: false,
        face_detection_error: "both",
        match: false, 
        confidence: 0, 
        reason: "Unable to analyze faces - please retake photo" 
      };
    }

    // Handle face detection failures
    if (!result.profile_face_detected) {
      return new Response(
        JSON.stringify({
          error: "no_face_profile",
          status: "blocked",
          score: 0,
          reason: "No face detected in baseline profile photo – please update profile photo"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!result.attendance_face_detected) {
      return new Response(
        JSON.stringify({
          error: "no_face_attendance",
          status: "blocked",
          score: 0,
          reason: "No face detected in captured photo – please retake photo"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Both faces detected - proceed with match result
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
