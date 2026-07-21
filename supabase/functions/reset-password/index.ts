import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error('Não autenticado');

    const { data: adminProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('roles(nome)')
      .eq('auth_user_id', user.id)
      .single();

    if (adminProfile?.roles?.nome !== 'ADMIN') {
      throw new Error('Acesso negado.');
    }

    const { email, userId, action, newPassword } = await req.json();

    if (action === 'SEND_LINK') {
      const { error } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email: email });
      if (error) throw error;
    } else if (action === 'FORCE_RESET') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
      if (error) throw error;
    }

    await supabaseAdmin.from('security_logs').insert({
      user_id: user.id, target_user_id: userId, acao: 'PASSWORD_RESET',
      descricao: `Senha redefinida ou link enviado para ${email}.`
    });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
