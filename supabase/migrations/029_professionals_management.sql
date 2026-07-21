-- =================================================================================
-- Migration: 029_professionals_management.sql
-- Descrição: Ajustes na tabela professionals, RLS e RPC para criação de usuário.
-- =================================================================================

-- 1. Adicionar colunas adicionais para a agenda do profissional
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS horarios_atendimento JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS dias_disponiveis JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 2. Atualizar RLS de Professionals para alinhar com clinic_id rigoroso
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

-- Removemos políticas antigas
DROP POLICY IF EXISTS "Admin gerencia profissionais" ON public.professionals;
DROP POLICY IF EXISTS "Recepcionista visualiza profissionais" ON public.professionals;
DROP POLICY IF EXISTS "Profissional vê os próprios dados" ON public.professionals;

-- A. ADMIN: Acesso Total
CREATE POLICY "Admin gerencia profissionais" 
ON public.professionals FOR ALL 
USING (public.is_admin() AND clinic_id = public.current_clinic_id());

-- B. RECEPCIONISTA: NENHUM ACESSO (O Guard já bloqueia a tela, mas blindamos aqui também)
-- Não criamos política para Recepcionista nesta tabela, portanto o acesso é implicitamente negado.

-- C. PROFISSIONAL: Vê apenas os seus próprios dados de negócio
CREATE POLICY "Profissional vê os próprios dados" 
ON public.professionals FOR SELECT 
USING (
  public.has_role('PROFISSIONAL') AND
  user_profile_id = public.get_current_user_profile_id() AND
  clinic_id = public.current_clinic_id()
);

CREATE POLICY "Profissional atualiza os próprios dados" 
ON public.professionals FOR UPDATE 
USING (
  public.has_role('PROFISSIONAL') AND
  user_profile_id = public.get_current_user_profile_id() AND
  clinic_id = public.current_clinic_id()
);

-- 3. Função RPC para Administrador criar conta de Profissional
-- Como não temos um backend NodeJS rodando (só o client web), a forma segura de 
-- um Admin criar conta para um profissional sem expor Service Role Key é via RPC Security Definer.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_create_professional(
    p_email VARCHAR,
    p_password VARCHAR,
    p_nome VARCHAR,
    p_telefone VARCHAR,
    p_whatsapp VARCHAR,
    p_especialidade VARCHAR,
    p_registro_profissional VARCHAR,
    p_valor_avista DECIMAL,
    p_valor_cartao DECIMAL,
    p_horarios JSONB,
    p_dias JSONB
) RETURNS UUID AS $$
DECLARE
    v_clinic_id UUID;
    v_role_id UUID;
    v_user_id UUID;
    v_profile_id UUID;
    v_professional_id UUID;
BEGIN
    -- 1. Validar se quem chama é Admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acesso negado: Somente administradores podem criar profissionais.';
    END IF;

    v_clinic_id := public.current_clinic_id();
    IF v_clinic_id IS NULL THEN
        RAISE EXCEPTION 'Clínica não identificada no contexto atual.';
    END IF;

    -- 2. Buscar ID da Role PROFISSIONAL
    SELECT id INTO v_role_id FROM public.roles WHERE nome = 'PROFISSIONAL' LIMIT 1;
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role PROFISSIONAL não encontrada.';
    END IF;

    -- 3. Inserir na tabela auth.users (Tabela interna do Supabase)
    -- Atenção: Esse método é um hack/bypass aceito para sistemas serverless puro SQL.
    -- Em produção corporativa extrema, recomendaria uma Edge Function.
    v_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
        recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, 
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', p_email, crypt(p_password, gen_salt('bf')), now(),
        now(), now(), '{"provider":"email","providers":["email"]}', '{}',
        now(), now(), '', '', '', ''
    );

    -- O trigger nativo "trg_on_auth_user_created" do 001_initial_auth_rbac tentará criar o user_profile!
    -- Porém ele criará com papel RECEPCIONISTA (padrão) e SEM clinic_id correto se for signup publico.
    -- Para corrigir isso, nós fazemos um UPDATE no profile recém criado:
    
    SELECT id INTO v_profile_id FROM public.user_profiles WHERE auth_user_id = v_user_id LIMIT 1;
    
    UPDATE public.user_profiles 
    SET role_id = v_role_id, clinic_id = v_clinic_id, nome = p_nome, ativo = true
    WHERE id = v_profile_id;

    -- 4. Inserir na tabela professionals
    INSERT INTO public.professionals (
        clinic_id, user_profile_id, nome, email, telefone, whatsapp, 
        especialidade, registro_profissional, valor_avista, valor_cartao, 
        horarios_atendimento, dias_disponiveis, ativo, created_by
    ) VALUES (
        v_clinic_id, v_profile_id, p_nome, p_email, p_telefone, p_whatsapp, 
        p_especialidade, p_registro_profissional, p_valor_avista, p_valor_cartao, 
        p_horarios, p_dias, true, auth.uid()
    ) RETURNING id INTO v_professional_id;

    RETURN v_professional_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
