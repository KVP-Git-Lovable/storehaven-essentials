import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlanogramData {
  id: string;
  title: string;
  deadline: string | null;
  frequency: string;
  schedule_time: string | null;
  schedule_days_of_week: number[] | null;
  schedule_day_of_month: number | null;
  schedule_week_of_month: number | null;
  schedule_date: string | null;
  assigned_to_user_id: string | null;
}

interface StoreAssociation {
  store_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { planogramId } = await req.json();

    if (!planogramId) {
      return new Response(
        JSON.stringify({ error: "planogramId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch planogram details
    const { data: planogram, error: planogramError } = await supabase
      .from("planograms")
      .select("*")
      .eq("id", planogramId)
      .single();

    if (planogramError || !planogram) {
      return new Response(
        JSON.stringify({ error: "Planogram not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch associated stores
    const { data: storeAssociations, error: storeError } = await supabase
      .from("planogram_stores")
      .select("store_id")
      .eq("planogram_id", planogramId);

    if (storeError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch store associations" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!storeAssociations || storeAssociations.length === 0) {
      return new Response(
        JSON.stringify({ message: "No stores associated with this planogram", tasksCreated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const frequency = planogram.frequency || "one-time";
    const applicableUpto = planogram.deadline ? new Date(planogram.deadline) : null;
    const scheduleTime = planogram.schedule_time || "10:00";
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Generate task dates based on frequency
    const taskDates: Date[] = [];

    if (frequency === "one-time") {
      // Single task on schedule_date or today
      if (planogram.schedule_date) {
        taskDates.push(new Date(planogram.schedule_date));
      } else {
        taskDates.push(new Date());
      }
    } else if (frequency === "daily") {
      // Daily tasks from today until applicableUpto
      const currentDate = new Date(today);
      currentDate.setDate(currentDate.getDate() + 1); // Start from tomorrow
      
      while (applicableUpto && currentDate <= applicableUpto) {
        taskDates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (frequency === "weekly") {
      // Weekly tasks on specified days
      const daysOfWeek = planogram.schedule_days_of_week || [1]; // Default to Monday
      const currentDate = new Date(today);
      currentDate.setDate(currentDate.getDate() + 1); // Start from tomorrow
      
      while (applicableUpto && currentDate <= applicableUpto) {
        const dayOfWeek = currentDate.getDay();
        if (daysOfWeek.includes(dayOfWeek)) {
          taskDates.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (frequency === "monthly") {
      // Monthly tasks
      const currentDate = new Date(today);
      currentDate.setDate(1); // Start from first of current month
      currentDate.setMonth(currentDate.getMonth() + 1); // Start from next month
      
      while (applicableUpto && currentDate <= applicableUpto) {
        let targetDate: Date | null = null;
        
        if (planogram.schedule_week_of_month && planogram.schedule_days_of_week?.length) {
          // e.g., "2nd Monday"
          targetDate = getNthDayOfMonth(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            planogram.schedule_days_of_week[0],
            planogram.schedule_week_of_month
          );
        } else if (planogram.schedule_day_of_month) {
          // e.g., "15th of month"
          targetDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            Math.min(planogram.schedule_day_of_month, getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth()))
          );
        }
        
        if (targetDate && targetDate > today && targetDate <= applicableUpto) {
          taskDates.push(targetDate);
        }
        
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    // Limit to prevent excessive task creation
    const maxTasks = 100;
    const limitedDates = taskDates.slice(0, maxTasks);

    // Create tasks for each store and date combination
    const tasksToInsert: any[] = [];
    
    for (const storeAssoc of storeAssociations) {
      for (const taskDate of limitedDates) {
        // Parse schedule time
        const [hours, minutes] = scheduleTime.split(":").map(Number);
        const dueDate = new Date(taskDate);
        dueDate.setHours(hours || 10, minutes || 0, 0, 0);
        
        tasksToInsert.push({
          planogram_id: planogramId,
          store_id: storeAssoc.store_id,
          title: planogram.title,
          description: planogram.description,
          frequency: frequency,
          due_date: dueDate.toISOString(),
          assigned_to_user_id: planogram.assigned_to_user_id,
          is_recurring: frequency !== "one-time",
          status: "pending",
        });
      }
    }

    if (tasksToInsert.length === 0) {
      return new Response(
        JSON.stringify({ message: "No tasks to create", tasksCreated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert tasks
    const { error: insertError } = await supabase
      .from("vm_compliance_tasks")
      .insert(tasksToInsert);

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create tasks", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        message: "Tasks created successfully", 
        tasksCreated: tasksToInsert.length,
        stores: storeAssociations.length,
        dates: limitedDates.length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to get nth day of month (e.g., 2nd Monday)
function getNthDayOfMonth(year: number, month: number, dayOfWeek: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay();
  
  // Calculate the first occurrence of the target day
  let firstOccurrence = 1 + ((dayOfWeek - firstDayOfWeek + 7) % 7);
  
  // Calculate the nth occurrence
  const targetDay = firstOccurrence + (n - 1) * 7;
  
  // Handle "last" week (n=5)
  if (n === 5) {
    const daysInMonth = getDaysInMonth(year, month);
    let lastOccurrence = firstOccurrence;
    while (lastOccurrence + 7 <= daysInMonth) {
      lastOccurrence += 7;
    }
    return new Date(year, month, lastOccurrence);
  }
  
  return new Date(year, month, targetDay);
}

// Helper function to get days in a month
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
