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
    const { baselineImageUrl, submittedImageUrl, taskName } = await req.json();

    if (!baselineImageUrl || !submittedImageUrl) {
      return new Response(
        JSON.stringify({ error: "Both baseline and submitted image URLs are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const isPlaceholder = baselineImageUrl.includes("placehold.co") || 
                          baselineImageUrl.includes("placeholder");
    
    if (isPlaceholder) {
      return new Response(
        JSON.stringify({
          complianceScore: null,
          complianceStatus: "pending",
          reasoning: "Cannot analyze: Baseline image is a placeholder. Please upload a real reference photo.",
          error: "placeholder_image"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analyzing task compliance...", { taskName });

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
            content: `You are an expert maintenance task compliance analyzer. Your task is to compare a reference/baseline photo with an actual task completion photo to determine how well the task was completed.

Task being evaluated: ${taskName || "Maintenance Task"}

Analyze both images for:
1. Cleanliness and tidiness compared to the baseline
2. Proper arrangement and organization
3. Completeness of the task (all areas covered)
4. Quality of work performed
5. Any missed areas or deficiencies

You must respond using the submit_compliance_result tool with:
- complianceScore: 0-100 representing task completion quality
- complianceStatus: "excellent" (90-100), "good" (70-89), "needs_improvement" (40-69), or "poor" (0-39)
- reasoning: Brief explanation (max 100 words)

Be fair but thorough in your assessment.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Compare these two images. The first is the baseline/reference showing how the area should look after the task is properly completed. The second is the actual photo taken after task execution. Assess how well the task was completed."
              },
              { type: "image_url", image_url: { url: baselineImageUrl } },
              { type: "image_url", image_url: { url: submittedImageUrl } }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_compliance_result",
              description: "Submit the task compliance analysis result",
              parameters: {
                type: "object",
                properties: {
                  complianceScore: { type: "number", description: "Score from 0 to 100" },
                  complianceStatus: {
                    type: "string",
                    enum: ["excellent", "good", "needs_improvement", "poor"],
                    description: "Status based on score"
                  },
                  reasoning: { type: "string", description: "Brief explanation of assessment" }
                },
                required: ["complianceScore", "complianceStatus", "reasoning"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "submit_compliance_result" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add funds to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "submit_compliance_result") {
      throw new Error("Invalid AI response format");
    }

    const result = JSON.parse(toolCall.function.arguments);
    const complianceScore = Math.min(100, Math.max(0, Math.round(result.complianceScore)));
    
    let complianceStatus: string;
    if (complianceScore >= 90) complianceStatus = "excellent";
    else if (complianceScore >= 70) complianceStatus = "good";
    else if (complianceScore >= 40) complianceStatus = "needs_improvement";
    else complianceStatus = "poor";

    console.log("Compliance result:", { complianceScore, complianceStatus, reasoning: result.reasoning });

    return new Response(
      JSON.stringify({ complianceScore, complianceStatus, reasoning: result.reasoning }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error analyzing compliance:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
