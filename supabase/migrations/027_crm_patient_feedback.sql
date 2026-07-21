-- =================================================================================
-- Migration: 027_crm_patient_feedback.sql
-- Descrição: Tabela de feedbacks, índices, RLS e automação de pós-consulta
-- =================================================================================

-- 1. Criação da Tabela
CREATE TABLE IF NOT EXISTS public.crm_feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ANSWERED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Criação de Índices
CREATE INDEX IF NOT EXISTS idx_crm_feedbacks_clinic_id ON public.crm_feedbacks(clinic_id);
CREATE INDEX IF NOT EXISTS idx_crm_feedbacks_patient_id ON public.crm_feedbacks(patient_id);
CREATE INDEX IF NOT EXISTS idx_crm_feedbacks_appointment_id ON public.crm_feedbacks(appointment_id);

-- 3. Habilitar RLS
ALTER TABLE public.crm_feedbacks ENABLE ROW LEVEL SECURITY;

-- 4. Criar Políticas (RLS)
-- ADMIN: acesso completo dentro da clínica
CREATE POLICY "Admin feedback all" ON public.crm_feedbacks
FOR ALL USING (
    public.is_admin()
    AND clinic_id = public.current_clinic_id()
)
WITH CHECK (
    public.is_admin()
    AND clinic_id = public.current_clinic_id()
);

-- RECEPÇÃO: visualizar feedbacks da própria clínica
CREATE POLICY "Recepcao feedback select"
ON public.crm_feedbacks
FOR SELECT
USING (
    public.has_role('RECEPCIONISTA')
    AND clinic_id = public.current_clinic_id()
);

-- PROFISSIONAL: somente feedbacks dos seus pacientes
-- (Para isso, cruza com appointments para verificar o professional_id)
CREATE POLICY "Profissional feedback select"
ON public.crm_feedbacks
FOR SELECT
USING (
    public.has_role('PROFISSIONAL')
    AND clinic_id = public.current_clinic_id()
    AND EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE a.patient_id = crm_feedbacks.patient_id
        AND a.professional_id = public.get_current_professional_id()
    )
);

-- 5. Template WhatsApp
DELETE FROM public.crm_message_templates WHERE name = 'Pesquisa de satisfação pós-consulta' AND trigger_event = 'APPOINTMENT_COMPLETED';

INSERT INTO public.crm_message_templates (clinic_id, name, trigger_event, channel, content, active)
SELECT 
    id AS clinic_id,
    'Pesquisa de satisfação pós-consulta',
    'APPOINTMENT_COMPLETED',
    'WHATSAPP',
    'Olá {{patient_name}}!\n\nEsperamos que sua consulta tenha sido excelente.\n\nComo foi seu atendimento?\n\nResponda com uma nota de 1 a 5.',
    true
FROM public.clinics;

-- 6. Nova Regra de Automação
DELETE FROM public.crm_automation_rules WHERE name = 'Pesquisa de satisfação pós-consulta' AND trigger_event = 'APPOINTMENT_COMPLETED';

INSERT INTO public.crm_automation_rules (clinic_id, name, description, trigger_event, action_type, action_config, active)
SELECT 
    id AS clinic_id,
    'Pesquisa de satisfação pós-consulta',
    'Envia pesquisa de satisfação via WhatsApp logo após a conclusão da consulta.',
    'APPOINTMENT_COMPLETED',
    'SEND_MESSAGE',
    '{"channel": "WHATSAPP", "template": "Pesquisa de satisfação pós-consulta"}'::jsonb,
    true
FROM public.clinics;
