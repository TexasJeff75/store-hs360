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
    console.log(`Processing subscriptions for date: ${today}`);

    const { data: dueSubscriptions, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .lte('next_order_date', today);

    if (fetchError) {
      throw new Error(`Error fetching subscriptions: ${fetchError.message}`);
    }

    if (!dueSubscriptions || dueSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No subscriptions due for processing',
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

    console.log(`Found ${dueSubscriptions.length} subscriptions to process`);

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const subscription of dueSubscriptions) {
      try {
        console.log(`Processing subscription ${subscription.id}`);

        const nextOrderDate = calculateNextOrderDate(
          subscription.next_order_date,
          subscription.frequency,
          subscription.frequency_interval
        );

        const orderAmount = 100;

        const { error: orderInsertError } = await supabase
          .from('subscription_orders')
          .insert({
            subscription_id: subscription.id,
            status: 'pending',
            scheduled_date: subscription.next_order_date,
            amount: orderAmount,
          });

        if (orderInsertError) {
          throw new Error(`Error creating order record: ${orderInsertError.message}`);
        }

        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            next_order_date: nextOrderDate,
            last_order_date: today,
            total_orders: subscription.total_orders + 1,
          })
          .eq('id', subscription.id);

        if (updateError) {
          throw new Error(`Error updating subscription: ${updateError.message}`);
        }

        results.processed++;
        console.log(`Successfully processed subscription ${subscription.id}`);
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Subscription ${subscription.id}: ${errorMessage}`);
        console.error(`Failed to process subscription ${subscription.id}:`, error);

        await supabase.from('subscription_orders').insert({
          subscription_id: subscription.id,
          status: 'failed',
          scheduled_date: subscription.next_order_date,
          amount: 0,
          error_message: errorMessage,
        });
      }
    }

    console.log('Processing complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} subscriptions, ${results.failed} failed`,
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
    console.error('Error in process-subscriptions function:', error);
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
