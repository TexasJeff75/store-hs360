import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];
    console.log(`Processing recurring orders for date: ${today}`);

    const { data: dueRecurringOrders, error: fetchError } = await supabase
      .from('recurring_orders')
      .select('*')
      .eq('status', 'active')
      .lte('next_order_date', today);

    if (fetchError) {
      throw new Error(`Error fetching recurring orders: ${fetchError.message}`);
    }

    if (!dueRecurringOrders || dueRecurringOrders.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No recurring orders due for processing',
          processed: 0,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log(`Found ${dueRecurringOrders.length} recurring orders to process`);

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const recurring_order of dueRecurringOrders) {
      try {
        console.log(`Processing recurring_order ${recurring_order.id}`);

        const nextOrderDate = calculateNextOrderDate(
          recurring_order.next_order_date,
          recurring_order.frequency,
          recurring_order.frequency_interval
        );

        const orderAmount = 100;

        const { error: orderInsertError } = await supabase
          .from('recurring_order_history')
          .insert({
            recurring_order_id: recurring_order.id,
            status: 'pending',
            scheduled_date: recurring_order.next_order_date,
            amount: orderAmount,
          });

        if (orderInsertError) {
          throw new Error(`Error creating order record: ${orderInsertError.message}`);
        }

        const { error: updateError } = await supabase
          .from('recurring_orders')
          .update({
            next_order_date: nextOrderDate,
            last_order_date: today,
            total_orders: recurring_order.total_orders + 1,
          })
          .eq('id', recurring_order.id);

        if (updateError) {
          throw new Error(`Error updating recurring_order: ${updateError.message}`);
        }

        results.processed++;
        console.log(`Successfully processed recurring_order ${recurring_order.id}`);
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`RecurringOrder ${recurring_order.id}: ${errorMessage}`);
        console.error(`Failed to process recurring_order ${recurring_order.id}:`, error);

        await supabase.from('recurring_order_history').insert({
          recurring_order_id: recurring_order.id,
          status: 'failed',
          scheduled_date: recurring_order.next_order_date,
          amount: 0,
          error_message: errorMessage,
        });
      }
    }

    console.log('Processing complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} recurring orders, ${results.failed} failed`,
        ...results,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in process-recurring_orders function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

function calculateNextOrderDate(
  currentDate: string,
  frequency: string,
  interval: number = 1
): string {
  const date = new Date(currentDate);

  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + interval * 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + interval * 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + interval);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + interval * 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + interval);
      break;
    default:
      date.setDate(date.getDate() + interval * 30);
  }

  return date.toISOString().split('T')[0];
}
