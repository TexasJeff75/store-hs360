import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RecurringOrder {
  id: string;
  user_id: string;
  organization_id: string | null;
  product_id: number;
  quantity: number;
  frequency: string;
  frequency_interval: number;
  status: string;
  next_order_date: string;
  end_date: string | null;
  payment_method_id: string | null;
  shipping_address_id: string | null;
  location_id: string | null;
  discount_percentage: number;
  last_order_date: string | null;
  total_orders: number;
  consecutive_failures: number;
}

function calculateNextDate(
  currentDate: string,
  frequency: string,
  interval: number,
): string {
  const date = new Date(currentDate);
  switch (frequency) {
    case "weekly":
      date.setDate(date.getDate() + interval * 7);
      break;
    case "biweekly":
      date.setDate(date.getDate() + interval * 14);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + interval);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + interval * 3);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + interval);
      break;
    default:
      date.setDate(date.getDate() + interval * 30);
  }
  return date.toISOString().split("T")[0];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().split("T")[0];

    const { data: dueOrders, error: fetchError } = await supabase
      .from("recurring_orders")
      .select("*")
      .eq("status", "active")
      .lte("next_order_date", today)
      .eq("processing_lock", false);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch due orders", details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const orders = (dueOrders || []) as RecurringOrder[];
    const results = { processed: 0, succeeded: 0, failed: 0, errors: [] as string[] };

    for (const order of orders) {
      results.processed++;

      await supabase
        .from("recurring_orders")
        .update({ processing_lock: true })
        .eq("id", order.id);

      try {
        const { data: product } = await supabase
          .from("products")
          .select("id, name, price, image_url, sku")
          .eq("id", order.product_id)
          .maybeSingle();

        if (!product) {
          throw new Error(`Product ${order.product_id} not found`);
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", order.user_id)
          .maybeSingle();

        const unitPrice = Number(product.price) * (1 - (order.discount_percentage || 0) / 100);
        const totalAmount = unitPrice * order.quantity;

        const { error: historyInsertError } = await supabase
          .from("recurring_order_history")
          .insert({
            recurring_order_id: order.id,
            status: "processing",
            scheduled_date: order.next_order_date,
            amount: totalAmount,
          });

        if (historyInsertError) {
          throw new Error(`Failed to create history entry: ${historyInsertError.message}`);
        }

        let shippingAddress = null;
        if (order.shipping_address_id) {
          const { data: addr } = await supabase
            .from("customer_addresses")
            .select("*")
            .eq("id", order.shipping_address_id)
            .maybeSingle();
          if (addr) {
            shippingAddress = {
              first_name: addr.first_name,
              last_name: addr.last_name,
              company: addr.company,
              address1: addr.address1,
              address2: addr.address2,
              city: addr.city,
              state_or_province: addr.state_or_province,
              postal_code: addr.postal_code,
              country_code: addr.country_code,
              phone: addr.phone,
              email: addr.email,
            };
          }
        }

        const orderItems = [
          {
            productId: product.id,
            name: product.name,
            quantity: order.quantity,
            price: unitPrice,
            image: product.image_url || "",
            sku: product.sku || "",
          },
        ];

        const { data: newOrder, error: orderError } = await supabase
          .from("orders")
          .insert({
            user_id: order.user_id,
            organization_id: order.organization_id,
            location_id: order.location_id,
            customer_email: profile?.email || "",
            items: orderItems,
            subtotal: totalAmount,
            shipping: 0,
            tax: 0,
            total: totalAmount,
            status: "pending",
            payment_status: "pending",
            shipping_address: shippingAddress,
            order_source: "recurring_order",
            notes: `Auto-generated from recurring order`,
          })
          .select("id")
          .single();

        if (orderError) {
          throw new Error(`Failed to create order: ${orderError.message}`);
        }

        const nextDate = calculateNextDate(
          order.next_order_date,
          order.frequency,
          order.frequency_interval,
        );

        const isExpired = order.end_date && nextDate > order.end_date;

        await supabase
          .from("recurring_orders")
          .update({
            processing_lock: false,
            last_order_date: today,
            total_orders: order.total_orders + 1,
            next_order_date: nextDate,
            consecutive_failures: 0,
            last_processing_error: null,
            status: isExpired ? "expired" : "active",
          })
          .eq("id", order.id);

        await supabase
          .from("recurring_order_history")
          .update({
            status: "completed",
            order_id: newOrder.id,
            processed_date: new Date().toISOString(),
          })
          .eq("recurring_order_id", order.id)
          .eq("scheduled_date", order.next_order_date)
          .eq("status", "processing");

        results.succeeded++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        results.failed++;
        results.errors.push(`Order ${order.id}: ${errorMsg}`);

        const newFailures = (order.consecutive_failures || 0) + 1;
        const shouldPause = newFailures >= 3;

        await supabase
          .from("recurring_orders")
          .update({
            processing_lock: false,
            consecutive_failures: newFailures,
            last_processing_error: errorMsg,
            status: shouldPause ? "paused" : "active",
          })
          .eq("id", order.id);

        await supabase
          .from("recurring_order_history")
          .update({
            status: "failed",
            error_message: errorMsg,
            processed_date: new Date().toISOString(),
          })
          .eq("recurring_order_id", order.id)
          .eq("scheduled_date", order.next_order_date)
          .eq("status", "processing");
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
