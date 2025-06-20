import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@11.1.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  Deno.env.get('APP_SUPABASE_URL') ?? '',
  Deno.env.get('APP_SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  const body = await req.text();

  try {
    const event = await stripe.webhooks.constructEvent(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')!
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const paymentIntentId = session.payment_intent;

      if (!userId || !paymentIntentId) {
        throw new Error('Missing user ID or payment intent in webhook metadata.');
      }

      const { error } = await supabaseAdmin.from('sessions').insert({
        user_id: userId,
        stripe_payment_intent_id: paymentIntentId,
        status: 'paid', // Mark as paid, but not yet active
      });

      if (error) {
        throw new Error(`Failed to create session in database: ${error.message}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
}); 