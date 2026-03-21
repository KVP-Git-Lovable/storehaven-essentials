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
    const { type, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let systemPrompt = "";
    let userPrompt = "";
    let dataContext: any = {};

    switch (type) {
      case "asset_health": {
        // Fetch asset data with maintenance history
        const { data: assets } = await supabase
          .from("assets")
          .select("*, maintenance_tasks(id, status, last_done, next_due, task_type)")
          .limit(100);
        
        const { data: tickets } = await supabase
          .from("service_tickets")
          .select("id, asset_id, status, priority, created_at, resolved_at")
          .limit(200);

        systemPrompt = `You are an AI expert in asset performance management and predictive maintenance for retail operations. 
Analyze asset data to calculate health scores (0-100), predict failures, and recommend maintenance schedules.

For each asset, consider:
- Age since purchase (newer = healthier)
- Maintenance frequency and adherence 
- Number of service tickets (fewer = healthier)
- Time since last maintenance
- Condition status
- Asset criticality

Return your response as a JSON object with this exact structure:
{
  "healthScores": [{"assetId": "...", "assetName": "...", "score": 85, "risk": "low|medium|high", "reason": "..."}],
  "failurePredictions": [{"assetId": "...", "assetName": "...", "probability": 0.75, "predictedDate": "YYYY-MM-DD", "reason": "..."}],
  "maintenanceRecommendations": [{"assetId": "...", "assetName": "...", "action": "...", "priority": "high|medium|low", "reason": "..."}],
  "summary": "Overall fleet health summary text"
}`;

        userPrompt = `Analyze these assets and their service history to provide health scores, failure predictions, and maintenance recommendations:

Assets: ${JSON.stringify(assets || [])}
Service Tickets: ${JSON.stringify(tickets || [])}

${context?.storeId ? `Focus on store: ${context.storeId}` : 'Analyze all stores'}`;
        dataContext = { assets, tickets };
        break;
      }

      case "inventory_forecast": {
        // Fetch inventory and consumption data
        const { data: items } = await supabase
          .from("inventory_items")
          .select("*")
          .limit(50);

        const { data: consumption } = await supabase
          .from("consumption_logs")
          .select("*, inventory_items(name)")
          .order("consumption_date", { ascending: false })
          .limit(500);

        const { data: requisitions } = await supabase
          .from("requisitions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        const { data: footfall } = await supabase
          .from("footfall_records")
          .select("*")
          .order("record_date", { ascending: false })
          .limit(100);

        systemPrompt = `You are an AI expert in inventory management and demand forecasting for retail operations (ice cream business with 100+ stores).

Analyze consumption patterns, seasonality, footfall trends, and stock levels to:
1. Forecast demand for the next 7 and 30 days
2. Identify items that need auto-requisition
3. Predict expiry risks
4. Evaluate vendor performance based on delivery and quality

Return your response as a JSON object with this exact structure:
{
  "demandForecast": [{"itemId": "...", "itemName": "...", "forecast7d": 100, "forecast30d": 400, "trend": "increasing|stable|decreasing", "confidence": 0.85}],
  "autoRequisitions": [{"itemId": "...", "itemName": "...", "currentStock": 50, "recommendedQty": 200, "urgency": "high|medium|low", "reason": "..."}],
  "expiryRisks": [{"itemId": "...", "itemName": "...", "riskLevel": "high|medium|low", "recommendedAction": "..."}],
  "vendorInsights": [{"vendorName": "...", "performanceScore": 85, "recommendation": "..."}],
  "summary": "Overall inventory health and recommendations"
}`;

        userPrompt = `Analyze this inventory data to forecast demand and identify optimization opportunities:

Inventory Items: ${JSON.stringify(items || [])}
Recent Consumption (last 500 logs): ${JSON.stringify(consumption || [])}
Recent Requisitions: ${JSON.stringify(requisitions || [])}
Footfall Data: ${JSON.stringify(footfall || [])}

${context?.storeId ? `Focus on store: ${context.storeId}` : 'Analyze trends across all stores'}`;
        dataContext = { items, consumption, requisitions, footfall };
        break;
      }

      case "ticket_resolution": {
        // Fetch ticket and KB articles
        const { data: ticket } = await supabase
          .from("service_tickets")
          .select("*, assets(name, category), stores(name)")
          .eq("id", context.ticketId)
          .single();

        const { data: kbArticles } = await supabase
          .from("knowledge_base_articles")
          .select("id, title, content, category, keywords")
          .eq("status", "active")
          .limit(50);

        systemPrompt = `You are an AI expert in technical support and service ticket resolution for retail asset management.

Analyze the service ticket and match it with relevant knowledge base articles to:
1. Suggest the most relevant KB articles for resolution
2. Provide step-by-step troubleshooting guidance
3. Estimate resolution time based on similar issues
4. Recommend escalation if needed

Return your response as a JSON object:
{
  "suggestedArticles": [{"articleId": "...", "title": "...", "relevanceScore": 0.9, "reason": "..."}],
  "troubleshootingSteps": ["Step 1...", "Step 2..."],
  "estimatedResolutionTime": "2 hours",
  "shouldEscalate": false,
  "escalationReason": null,
  "summary": "Brief analysis and recommendation"
}`;

        userPrompt = `Analyze this service ticket and suggest resolutions:

Ticket: ${JSON.stringify(ticket || {})}
Knowledge Base Articles: ${JSON.stringify(kbArticles || [])}`;
        dataContext = { ticket, kbArticles };
        break;
      }

      case "store_performance": {
        // Fetch comprehensive store data
        const { data: stores } = await supabase
          .from("stores")
          .select("*")
          .limit(20);

        const { data: footfall } = await supabase
          .from("footfall_records")
          .select("*")
          .order("record_date", { ascending: false })
          .limit(200);

        const { data: assets } = await supabase
          .from("assets")
          .select("id, name, asset_status, condition, store_id")
          .limit(200);

        const { data: tickets } = await supabase
          .from("service_tickets")
          .select("id, store_id, status, priority")
          .limit(200);

        systemPrompt = `You are an AI expert in retail store performance analytics.

Analyze store data including footfall, asset health, and service issues to:
1. Generate weekly performance insights
2. Identify top and bottom performing stores
3. Correlate asset uptime with store performance
4. Recommend improvements

Return your response as a JSON object:
{
  "storeRankings": [{"storeId": "...", "storeName": "...", "overallScore": 85, "footfallTrend": "up|down|stable", "assetHealth": 90}],
  "insights": ["Key insight 1...", "Key insight 2..."],
  "recommendations": [{"storeId": "...", "storeName": "...", "action": "...", "expectedImpact": "..."}],
  "weeklyHighlights": {"topPerformer": "...", "needsAttention": "...", "biggestImprovement": "..."},
  "summary": "Weekly performance overview"
}`;

        userPrompt = `Analyze store performance data:

Stores: ${JSON.stringify(stores || [])}
Footfall (recent): ${JSON.stringify(footfall || [])}
Assets: ${JSON.stringify(assets || [])}
Service Tickets: ${JSON.stringify(tickets || [])}`;
        dataContext = { stores, footfall, assets, tickets };
        break;
      }

      case "nso_risk": {
        // Fetch NSO project data
        const { data: nsoProjects } = await supabase
          .from("stores")
          .select("*")
          .eq("status", "under-renovation")
          .limit(20);

        const { data: nsoTasks } = await supabase
          .from("nso_master_tasks")
          .select("*, nso_master_sections(name)")
          .limit(100);

        systemPrompt = `You are an AI expert in retail project management and new store opening (NSO) risk assessment.

Analyze NSO project data to:
1. Predict delays based on task completion patterns
2. Identify high-risk phases
3. Recommend mitigation actions
4. Estimate realistic completion dates

Return your response as a JSON object:
{
  "projectRisks": [{"storeId": "...", "storeName": "...", "riskLevel": "high|medium|low", "delayProbability": 0.6, "predictedDelay": "2 weeks", "reason": "..."}],
  "criticalTasks": [{"taskName": "...", "phase": "...", "riskFactor": "...", "mitigation": "..."}],
  "recommendations": ["Recommendation 1...", "Recommendation 2..."],
  "summary": "Overall NSO portfolio health"
}`;

        userPrompt = `Analyze NSO projects for risks and delays:

Active NSO Projects: ${JSON.stringify(nsoProjects || [])}
NSO Tasks Template: ${JSON.stringify(nsoTasks || [])}`;
        dataContext = { nsoProjects, nsoTasks };
        break;
      }

      case "employee_scheduling": {
        // Fetch employee and attendance data
        const { data: employees } = await supabase
          .from("employees")
          .select("*")
          .eq("status", "active")
          .limit(100);

        const { data: attendance } = await supabase
          .from("attendance_records")
          .select("*")
          .order("attendance_date", { ascending: false })
          .limit(500);

        const { data: footfall } = await supabase
          .from("footfall_records")
          .select("*")
          .order("record_date", { ascending: false })
          .limit(100);

        systemPrompt = `You are an AI expert in workforce management and employee scheduling for retail operations.

Analyze employee, attendance, and footfall data to:
1. Optimize staff schedules based on predicted footfall
2. Identify understaffed/overstaffed time slots
3. Balance workload across employees
4. Reduce overtime while maintaining coverage

Return your response as a JSON object:
{
  "schedulingRecommendations": [{"storeId": "...", "storeName": "...", "day": "Monday", "currentStaff": 3, "recommendedStaff": 5, "reason": "..."}],
  "workloadBalance": [{"employeeId": "...", "employeeName": "...", "currentHours": 45, "recommendedHours": 40, "action": "..."}],
  "peakHourAnalysis": [{"timeSlot": "11:00-14:00", "averageFootfall": 150, "recommendedStaff": 4}],
  "summary": "Scheduling optimization overview"
}`;

        userPrompt = `Analyze staffing needs:

Employees: ${JSON.stringify(employees || [])}
Recent Attendance: ${JSON.stringify(attendance || [])}
Footfall Patterns: ${JSON.stringify(footfall || [])}`;
        dataContext = { employees, attendance, footfall };
        break;
      }

      case "roster_rebalance": {
        const { currentRoster, availableEmployees, onLeave, shifts, roles: rosterRoles, date } = context;

        systemPrompt = `You are an AI expert in workforce roster management for retail store operations.

Given the current daily roster, employees on leave, and available employees, suggest changes to rebalance the roster.
Goals:
- Remove on-leave employees from the roster
- Fill gaps with available employees matching roles
- Balance headcount across shifts
- Prefer employees whose department/position matches the role

Return your response as a JSON object:
{
  "suggestions": [
    {"action": "remove", "rosterId": "...", "employeeName": "...", "description": "Remove X (on leave)"},
    {"action": "add", "employeeId": "...", "employeeName": "...", "roleId": "...", "shift": "morning", "description": "Add Y to morning shift as Z"},
    {"action": "move", "rosterId": "...", "employeeName": "...", "toShift": "evening", "roleId": "...", "description": "Move X from morning to evening"}
  ],
  "summary": "Brief summary of changes"
}`;

        userPrompt = `Rebalance this roster for ${date}:

Current Roster: ${JSON.stringify(currentRoster)}
Employees on Leave: ${JSON.stringify(onLeave)}
Available Employees (not rostered, not on leave): ${JSON.stringify(availableEmployees)}
Shifts: ${JSON.stringify(shifts)}
Roles: ${JSON.stringify(rosterRoles)}`;
        dataContext = context;
        break;
      }

      default:
        throw new Error(`Unknown insight type: ${type}`);
    }

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
    let parsedInsights;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsedInsights = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", e);
      parsedInsights = { rawResponse: content, parseError: true };
    }

    // For roster_rebalance, return suggestions/summary at top level for easy consumption
    const responseBody = type === "roster_rebalance"
      ? { success: true, type, suggestions: parsedInsights?.suggestions || [], summary: parsedInsights?.summary || "", generatedAt: new Date().toISOString() }
      : { success: true, type, insights: parsedInsights, generatedAt: new Date().toISOString() };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI insights error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
