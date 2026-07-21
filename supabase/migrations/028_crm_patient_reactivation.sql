-- =================================================================================
-- Migration: 028_crm_patient_reactivation.sql
-- Descrição: Tabela de campanhas de reativação, RLS e regra automática.
-- =================================================================================

-- 1. Criação da Tabela
CREATE TABLE IF NOT EXISTS public.crm_reactivation_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    last_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    inactive_since DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONTACTED', 'RESPONDED', 'REACTIVATED', 'IGNORED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Trigger para updated_at
DROP TRIGGER IF EXISTS trg_update_crm_reactivation_campaigns ON public.crm_reactivation_campaigns;
CREATE TRIGGER trg_update_crm_reactivation_campaigns
BEFORE UPDATE ON public.crm_reactivation_campaigns
FOR EACH ROW EXECUTE FUNCTION public.set_crm_updated_at();

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_crm_reactivation_clinic_id ON public.crm_reactivation_campaigns(clinic_id);
CREATE INDEX IF NOT EXISTS idx_crm_reactivation_patient_id ON public.crm_reactivation_campaigns(patient_id);
CREATE INDEX IF NOT EXISTS idx_crm_reactivation_status ON public.crm_reactivation_campaigns(status);

-- 4. RLS
ALTER TABLE public.crm_reactivation_campaigns ENABLE ROW LEVEL SECURITY;

-- ADMIN:
CREATE POLICY "Admin reactivation full" ON public.crm_reactivation_campaigns
    FOR ALL USING (public.is_admin() AND clinic_id = public.current_clinic_id());

-- RECEPÇÃO:
CREATE POLICY "Recepcao reactivation select" ON public.crm_reactivation_campaigns
    FOR SELECT USING (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());
    
CREATE POLICY "Recepcao reactivation update" ON public.crm_reactivation_campaigns
    FOR UPDATE USING (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());

-- PROFISSIONAL (Apenas de seus pacientes):
CREATE POLICY "Profissional reactivation select"
ON public.crm_reactivation_campaigns
FOR SELECT USING (
    public.has_role('PROFISSIONAL')
    AND clinic_id = public.current_clinic_id()
    AND EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE a.patient_id = crm_reactivation_campaigns.patient_id
        AND a.professional_id = public.get_current_professional_id()
    )
);

-- 5. Função RPC para buscar pacientes inativos (Performance via banco)
CREATE OR REPLACE FUNCTION public.find_inactive_patients(p_inactive_days INT)
RETURNS TABLE (
    patient_id UUID,
    clinic_id UUID,
    last_appointment_id UUID,
    last_appointment_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS patient_id,
        p.clinic_id,
        a.id AS last_appointment_id,
        a.data AS last_appointment_date
    FROM public.patients p
    JOIN (
        -- Pega a última consulta de cada paciente
        SELECT patient_id, MAX(data) as max_data
        FROM public.appointments
        WHERE status IN ('concluida', 'concluída')
        GROUP BY patient_id
    ) latest ON latest.patient_id = p.id
    JOIN public.appointments a ON a.patient_id = latest.patient_id AND a.data = latest.max_data
    WHERE 
        -- Última consulta faz mais de X dias
        latest.max_data <= CURRENT_DATE - p_inactive_days
        AND NOT EXISTS (
            -- Não possui consulta futura marcada
            SELECT 1 FROM public.appointments fut
            WHERE fut.patient_id = p.id 
            AND fut.data >= CURRENT_DATE
            AND fut.status IN ('solicitada', 'aguardando_aprovacao', 'confirmada', 'Agendado', 'agendado', 'pendente', 'Pendente')
        );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 6. Template de Mensagem (Paciente Inativo)
DELETE FROM public.crm_message_templates WHERE name = 'Paciente Inativo' AND trigger_event = 'PATIENT_INACTIVE';

INSERT INTO public.crm_message_templates (clinic_id, name, trigger_event, channel, content, active)
SELECT 
    id AS clinic_id,
    'Paciente Inativo',
    'PATIENT_INACTIVE',
    'WHATSAPP',
    'Olá {{patient_name}}!\n\nSentimos sua falta na Clínica Zoe.\n\nJá faz algum tempo desde sua última consulta.\n\nGostaria de agendar um novo atendimento?',
    true
FROM public.clinics;

-- 7. Regra de Automação
DELETE FROM public.crm_automation_rules WHERE name = 'Reativação de Paciente Inativo' AND trigger_event = 'PATIENT_INACTIVE';

INSERT INTO public.crm_automation_rules (clinic_id, name, description, trigger_event, action_type, action_config, active)
SELECT 
    id AS clinic_id,
    'Reativação de Paciente Inativo',
    'Envia mensagem automática para pacientes inativos há muito tempo.',
    'PATIENT_INACTIVE',
    'SEND_MESSAGE',
    '{"channel": "WHATSAPP", "template": "Paciente Inativo"}'::jsonb,
    true
FROM public.clinics;
