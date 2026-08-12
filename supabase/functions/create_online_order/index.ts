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

    const {
      customerName,
      customerEmail,
      customerPhone,
      fulfillmentMethod,
      shippingAddress,
      preferredPickupDate,
      items,
      subtotal,
      totalAmount,
    } = await req.json();

    // Validate required fields
    if (!customerName || !customerEmail || !customerPhone) {
      return new Response(
        JSON.stringify({ error: "Customer name, email, and phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!fulfillmentMethod || !["delivery", "pickup"].includes(fulfillmentMethod)) {
      return new Response(
        JSON.stringify({ error: "Invalid fulfillment method. Must be 'delivery' or 'pickup'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "Order must contain at least one item" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subtotal || !totalAmount) {
      return new Response(
        JSON.stringify({ error: "Subtotal and total amount are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate fulfillment-specific fields
    if (fulfillmentMethod === "delivery" && !shippingAddress) {
      return new Response(
        JSON.stringify({ error: "Shipping address is required for delivery orders" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (fulfillmentMethod === "pickup" && !preferredPickupDate) {
      return new Response(
        JSON.stringify({ error: "Preferred pickup date is required for pickup orders" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate order number: ON-YYYYMMDD-XXXXX
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    const orderNumber = `ON-${dateStr}-${randomStr}`;

    // Prepare order data
    const orderData = {
      order_number: orderNumber,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      fulfillment_method: fulfillmentMethod,
      shipping_address_line1: shippingAddress?.line1 || null,
      shipping_address_line2: shippingAddress?.line2 || null,
      shipping_city: shippingAddress?.city || null,
      shipping_state: shippingAddress?.state || null,
      shipping_pincode: shippingAddress?.pincode || null,
      preferred_pickup_date: preferredPickupDate || null,
      items: items,
      subtotal: subtotal,
      total_amount: totalAmount,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    // Insert into online_orders table
    const { data, error } = await supabaseAdmin
      .from("online_orders")
      .insert([orderData])
      .select("id, order_number, status, created_at");

    if (error) {
      console.error("create_online_order: insert failed", {
        error: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
      });
      return new Response(
        JSON.stringify({ error: "Failed to create order: " + error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ error: "Order creation returned no data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        order: {
          id: data[0].id,
          orderNumber: data[0].order_number,
          status: data[0].status,
          createdAt: data[0].created_at,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("create_online_order: unhandled error", errorMessage, error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
