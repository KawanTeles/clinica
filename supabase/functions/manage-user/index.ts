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

    // Validação ADMIN
    const { data: adminProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('*, roles(nome)')
      .eq('auth_user_id', user.id)
      .single();

    if (adminProfile?.roles?.nome !== 'ADMIN') {
      throw new Error('Acesso negado. Apenas administradores podem gerenciar usuários.');
    }

    const { data: hasPermData } = await supabaseAdmin.rpc('has_permission', { perm_name: 'gerenciar_administradores' });
    // Deno/PostgREST RPC workaround since RPC uses auth context, but we are admin client.
    // Instead we can check manually:
    const { data: permData } = await supabaseAdmin
      .from('role_permissions')
      .select('permissions(nome)')
      .eq('role_id', adminProfile.role_id);
    const hasAdminPerm = permData?.some(p => p.permissions.nome === 'gerenciar_administradores');

    const body = await req.json();
    const { action, email, password, nome, roleId, userId, ativo } = body;

    // Ação: CRIAR USUÁRIO
    if (action === 'CREATE') {
      // Checar se a role solicitada é ADMIN e validar permissão
      const { data: targetRole } = await supabaseAdmin.from('roles').select('nome').eq('id', roleId).single();
      if (targetRole?.nome === 'ADMIN' && !hasAdminPerm) {
        throw new Error('Você não tem permissão para criar novos Administradores.');
      }

      let newUserId = null;
      try {
        const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
          email, password, email_confirm: true
        });
        if (createAuthError) throw createAuthError;
        newUserId = authData.user.id;

        const { error: profileError } = await supabaseAdmin.from('user_profiles').insert({
          auth_user_id: newUserId,
          nome, email, role_id: roleId, ativo
        });
        if (profileError) throw profileError;

        await supabaseAdmin.from('security_logs').insert({
          user_id: user.id, target_user_id: newUserId, acao: 'CREATE_USER',
          descricao: `Usuário ${email} criado.`
        });

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (err) {
        if (newUserId) await supabaseAdmin.auth.admin.deleteUser(newUserId);
        throw err;
      }
    }

    // Ação: ATUALIZAR USUÁRIO
    if (action === 'UPDATE') {
      // Bloquear downgrade/upgrade admin se não tiver permissão
      const { data: currentTarget } = await supabaseAdmin.from('user_profiles').select('roles(nome)').eq('auth_user_id', userId).single();
      const { data: newRoleObj } = await supabaseAdmin.from('roles').select('nome').eq('id', roleId).single();

      if ((currentTarget?.roles?.nome === 'ADMIN' || newRoleObj?.nome === 'ADMIN') && !hasAdminPerm) {
         throw new Error('Você não tem permissão para gerenciar Administradores.');
      }

      const { error: updateError } = await supabaseAdmin.from('user_profiles')
        .update({ role_id: roleId, ativo: ativo })
        .eq('auth_user_id', userId);
      
      if (updateError) throw updateError;

      await supabaseAdmin.from('security_logs').insert({
        user_id: user.id, target_user_id: userId, acao: 'UPDATE_USER',
        descricao: `Status ou Cargo do usuário alterado.`
      });

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
