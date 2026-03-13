import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: isAdmin } = await supabaseAdmin.rpc("is_admin", { _user_id: requestingUser.id });
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Only admins can create users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, username, role_id, reports_to, status } = await req.json();

    if (!email || !password || !username) {
      return new Response(
        JSON.stringify({ error: "Email, password, and username are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    let userId: string;

    if (createError) {
      // If user already exists in auth, check if they have a profile
      if (createError.message?.includes("already been registered")) {
        // Find the existing auth user by email
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError) {
          return new Response(
            JSON.stringify({ error: "Failed to look up existing user" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const existingUser = users?.find((u) => u.email === email);
        if (!existingUser) {
          return new Response(
            JSON.stringify({ error: "User exists but could not be found" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if profile already exists
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("id", existingUser.id)
          .single();

        if (existingProfile) {
          return new Response(
            JSON.stringify({ error: "A user with this email already exists and has a profile. Please use a different email." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Auth user exists but no profile — recover by creating the profile
        userId = existingUser.id;

        // Update the password to the new one provided
        await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      } else {
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      userId = newUser.user.id;
    }

    // Create profile for the user
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      username,
      email,
      role_id: role_id || null,
      reports_to: reports_to || null,
      status: status || "active",
      must_reset_password: true,
    });

    if (profileError) {
      // Only rollback auth user if we just created it
      if (!createError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { id: userId, email } 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
