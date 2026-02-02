import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Calculate next due date based on frequency
function calculateNextDueDate(currentDue: string, frequency: string): Date {
  const date = new Date(currentDue);
  switch (frequency) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
  }
  return date;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // Find overdue recurring tasks that are still pending and don't have a next occurrence
    const { data: overdueTasks, error: fetchError } = await supabase
      .from("vm_compliance_tasks")
      .select("*")
      .eq("status", "pending")
      .neq("frequency", "one-time")
      .lt("due_date", todayStart);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${overdueTasks?.length || 0} overdue recurring tasks`);

    const createdTasks: string[] = [];

    for (const task of overdueTasks || []) {
      // Check if a next occurrence already exists for this task
      const { data: existingNext } = await supabase
        .from("vm_compliance_tasks")
        .select("id")
        .eq("parent_task_id", task.id)
        .eq("status", "pending")
        .single();

      if (existingNext) {
        console.log(`Task ${task.id} already has a pending next occurrence`);
        continue;
      }

      // Calculate next due date
      const nextDueDate = calculateNextDueDate(task.due_date, task.frequency);

      // Ensure next due date is in the future
      while (nextDueDate < now) {
        switch (task.frequency) {
          case "daily":
            nextDueDate.setDate(nextDueDate.getDate() + 1);
            break;
          case "weekly":
            nextDueDate.setDate(nextDueDate.getDate() + 7);
            break;
          case "monthly":
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            break;
        }
      }

      // Create the next occurrence
      const { data: newTask, error: insertError } = await supabase
        .from("vm_compliance_tasks")
        .insert({
          planogram_id: task.planogram_id,
          store_id: task.store_id,
          title: task.title,
          description: task.description,
          frequency: task.frequency,
          due_date: nextDueDate.toISOString(),
          assigned_to_user_id: task.assigned_to_user_id,
          parent_task_id: task.id,
          is_recurring: true,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        console.error(`Failed to create next occurrence for task ${task.id}:`, insertError);
      } else {
        console.log(`Created next occurrence ${newTask.id} for task ${task.id}, due ${nextDueDate.toISOString()}`);
        createdTasks.push(newTask.id);
      }

      // Mark the original overdue task as expired/missed if still pending
      await supabase
        .from("vm_compliance_tasks")
        .update({ status: "expired" })
        .eq("id", task.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: overdueTasks?.length || 0,
        created: createdTasks.length,
        createdTaskIds: createdTasks,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing recurring tasks:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
