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
    const { planogramImageUrl, submittedImageUrl } = await req.json();

    if (!planogramImageUrl || !submittedImageUrl) {
      return new Response(
        JSON.stringify({ error: "Both planogram and submitted image URLs are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Analyzing VM compliance images...");
    console.log("Planogram URL:", planogramImageUrl);
    console.log("Submitted URL:", submittedImageUrl);

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
            content: `You are an expert visual merchandising compliance analyzer. Your task is to compare a reference planogram image with an actual store display photo and determine how closely they match.

Analyze both images for:
1. Product placement and arrangement
2. Shelf organization and layout
3. Signage and promotional materials
4. Overall visual compliance

You must respond with a JSON object containing:
- matchPercentage: A number from 0 to 100 representing how closely the actual photo matches the planogram
- reviewStatus: One of "match" (90-100%), "average_match" (60-89%), "low_match" (20-59%), or "no_match" (0-19%)
- reasoning: A brief explanation of your assessment (max 100 words)

Be strict but fair in your assessment. Consider:
- 90-100%: Nearly identical layout, products correctly placed, signage matches
- 60-89%: Most elements correct, minor deviations in placement or signage
- 20-59%: Significant differences, products misplaced or missing elements
- 0-19%: Major non-compliance, completely different layout or empty shelves`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please compare these two images. The first is the reference planogram showing how the display should look. The second is the actual photo taken at the store. Analyze how closely the actual display matches the planogram and provide your assessment."
              },
              {
                type: "image_url",
                image_url: { url: planogramImageUrl }
              },
              {
                type: "image_url",
                image_url: { url: submittedImageUrl }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_compliance_analysis",
              description: "Submit the visual merchandising compliance analysis result",
              parameters: {
                type: "object",
                properties: {
                  matchPercentage: {
                    type: "number",
                    description: "Match percentage from 0 to 100"
                  },
                  reviewStatus: {
                    type: "string",
                    enum: ["match", "average_match", "low_match", "no_match"],
                    description: "Review status based on match percentage"
                  },
                  reasoning: {
                    type: "string",
                    description: "Brief explanation of the assessment"
                  }
                },
                required: ["matchPercentage", "reviewStatus", "reasoning"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "submit_compliance_analysis" } }
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
    console.log("AI Response:", JSON.stringify(aiResponse, null, 2));

    // Extract tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "submit_compliance_analysis") {
      throw new Error("Invalid AI response format");
    }

    const analysisResult = JSON.parse(toolCall.function.arguments);
    
    // Validate and normalize the result
    let matchPercentage = Math.min(100, Math.max(0, Math.round(analysisResult.matchPercentage)));
    
    // Ensure reviewStatus matches the percentage ranges
    let reviewStatus: string;
    if (matchPercentage >= 90) {
      reviewStatus = "match";
    } else if (matchPercentage >= 60) {
      reviewStatus = "average_match";
    } else if (matchPercentage >= 20) {
      reviewStatus = "low_match";
    } else {
      reviewStatus = "no_match";
    }

    console.log("Analysis result:", { matchPercentage, reviewStatus, reasoning: analysisResult.reasoning });

    return new Response(
      JSON.stringify({
        matchPercentage,
        reviewStatus,
        reasoning: analysisResult.reasoning
      }),
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
