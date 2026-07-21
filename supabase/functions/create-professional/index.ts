import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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

    // Validate if the caller is an ADMIN
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error('Não autenticado');

    // Validação Segura de Admin
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('*, roles(nome)')
      .eq('auth_user_id', user.id)
      .single();

    if (userProfile?.roles?.nome !== 'ADMIN') {
      throw new Error('Permissão negada. Apenas administradores podem criar profissionais.');
    }

    const body = await req.json();
    const { email, password, nome, especialidade, registro, telefone, whatsapp, valorAvista, valorCartao, descricao } = body;

    // Início da "Transação" com Fallbacks (Compensatory Actions)
    let newUserId = null;
    let newUserProfileId = null;

    try {
      // 1. Criar Auth User
      const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true
      });
      if (createAuthError) throw createAuthError;
      newUserId = authData.user.id;

      // Pegar ID da Role 'PROFISSIONAL'
      const { data: roleData } = await supabaseAdmin.from('roles').select('id').eq('nome', 'PROFISSIONAL').single();

      // 2. Criar Profile
      const { data: profileData, error: profileError } = await supabaseAdmin.from('user_profiles').insert({
        auth_user_id: newUserId,
        nome: nome,
        email: email,
        role_id: roleData.id
      }).select().single();
      if (profileError) throw profileError;
      newUserProfileId = profileData.id;

      // 3. Criar Profissional
      const { error: profError } = await supabaseAdmin.from('professionals').insert({
        user_profile_id: newUserProfileId,
        nome: nome,
        especialidade: especialidade,
        registro_profissional: registro,
        telefone: telefone,
        whatsapp: whatsapp,
        valor_avista: valorAvista,
        valor_cartao: valorCartao,
        descricao: descricao,
        created_by: user.id
      });
      if (profError) throw profError;

      // 4. Log de Sucesso
      await supabaseAdmin.from('security_logs').insert({
        user_id: user.id,
        acao: 'CREATE_PROFESSIONAL',
        descricao: `Profissional ${nome} criado por admin.`
      });

      return new Response(JSON.stringify({ success: true, message: 'Profissional criado com sucesso.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      });

    } catch (transactionError) {
      // Rollback (Compensatory actions)
      if (newUserProfileId) await supabaseAdmin.from('user_profiles').delete().eq('id', newUserProfileId);
      if (newUserId) await supabaseAdmin.auth.admin.deleteUser(newUserId);
      
      await supabaseAdmin.from('security_logs').insert({
        user_id: user.id,
        acao: 'ERROR_CREATE_PROFESSIONAL',
        descricao: `Falha ao criar profissional ${nome}: ${transactionError.message}`
      });
      throw transactionError;
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
