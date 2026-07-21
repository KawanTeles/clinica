-- =================================================================================
-- Migration: 021_crm_automation_security_fix.sql
-- Descrição: Cria função SECURITY DEFINER para gravação segura de logs de automação
-- =================================================================================

CREATE OR REPLACE FUNCTION public.create_automation_log(
    p_patient_id UUID,
    p_professional_id UUID,
    p_event VARCHAR,
    p_status VARCHAR,
    p_payload JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clinic_id UUID;
    v_user_id UUID;
BEGIN
    -- Validar sessão ativa (usuário logado)
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado. Usuário não autenticado.';
    END IF;

    -- Obter clinic_id do contexto seguro atual
    v_clinic_id := public.current_clinic_id();
    IF v_clinic_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado. Clínica não identificada no contexto.';
    END IF;

    -- Inserir o log ignorando o RLS nativo (SECURITY DEFINER atua com privilégios de criador)
    INSERT INTO public.automation_logs (
        clinic_id,
        patient_id,
        professional_id,
        event,
        status,
        payload
    ) VALUES (
        v_clinic_id,
        p_patient_id,
        p_professional_id,
        p_event,
        p_status,
        COALESCE(p_payload, '{}'::jsonb)
    );
END;
$$;

-- Revogar execução pública genérica (boa prática)
REVOKE EXECUTE ON FUNCTION public.create_automation_log(UUID, UUID, VARCHAR, VARCHAR, JSONB) FROM public;

-- Garantir acesso apenas para usuários autenticados
GRANT EXECUTE ON FUNCTION public.create_automation_log(UUID, UUID, VARCHAR, VARCHAR, JSONB) TO authenticated;
