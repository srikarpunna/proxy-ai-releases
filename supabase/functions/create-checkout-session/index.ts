import { serve, ConnInfo } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@11.1.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2023-10-16',
});

serve(async (req: Request, connInfo: ConnInfo) => {
  try {
    const { user_id } = await req.json();

    if (!user_id) {
      throw new Error('User ID is required.');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('APP_SUPABASE_URL') ?? '',
      Deno.env.get('APP_SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', user_id)
      .single();

    if (userError) {
      throw new Error(`Could not retrieve user: ${userError.message}`);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'AI Assistant - 24 Hour Access',
              description: 'Full access to all features of the Proxy AI Assistant for 24 hours.',
            },
            unit_amount: 1500, // $15.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${Deno.env.get('APP_URL')}/payment-success`,
      cancel_url: `${Deno.env.get('APP_URL')}/payment-cancelled`,
      metadata: {
        user_id,
      },
    });

    return new Response(JSON.stringify({ sessionId: session.id }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}); 