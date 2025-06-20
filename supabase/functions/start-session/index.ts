import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('APP_SUPABASE_URL') ?? '',
  Deno.env.get('APP_SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  try {
    const { user_id } = await req.json();

    if (!user_id) {
      throw new Error('User ID is required.');
    }

    // Find the most recent 'paid' session for the user
    const { data: paidSession, error: findError } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('user_id', user_id)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (findError) {
      throw new Error(`Could not find a paid session: ${findError.message}`);
    }

    // Activate the session
    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from('sessions')
      .update({
        status: 'active',
        activated_at: new Date().toISOString(),
      })
      .eq('id', paidSession.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to activate session: ${updateError.message}`);
    }

    return new Response(JSON.stringify(updatedSession), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}); 