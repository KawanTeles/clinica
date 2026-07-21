-- =================================================================================
-- Migration: 023_crm_communication_center.sql
-- Descrição: Criação do centro de comunicação (Mensagens e Templates)
-- =================================================================================

-- 1. Tabela de Templates de Mensagens
CREATE TABLE public.crm_message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    trigger_event VARCHAR(100), -- Ex: LEAD_CREATED, APPOINTMENT_CONFIRMED
    channel VARCHAR(50) DEFAULT 'WHATSAPP',
    content TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(clinic_id, name)
);

CREATE INDEX idx_crm_templates_clinic ON public.crm_message_templates(clinic_id);
CREATE INDEX idx_crm_templates_event ON public.crm_message_templates(trigger_event);

CREATE TRIGGER trg_crm_templates_updated_at
BEFORE UPDATE ON public.crm_message_templates
FOR EACH ROW EXECUTE FUNCTION public.set_crm_updated_at();


-- 2. Tabela de Registro de Mensagens Enviadas
CREATE TABLE public.crm_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL, -- Ex: WHATSAPP, EMAIL
    provider VARCHAR(100),        -- Ex: EVOLUTION, CLOUD_API, MOCK
    direction VARCHAR(20) DEFAULT 'OUTBOUND', -- OUTBOUND, INBOUND
    template_id UUID REFERENCES public.crm_message_templates(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,  -- PENDING, SENT, DELIVERED, FAILED
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_crm_messages_clinic ON public.crm_messages(clinic_id);
CREATE INDEX idx_crm_messages_patient ON public.crm_messages(patient_id);
CREATE INDEX idx_crm_messages_status ON public.crm_messages(status);

CREATE TRIGGER trg_crm_messages_updated_at
BEFORE UPDATE ON public.crm_messages
FOR EACH ROW EXECUTE FUNCTION public.set_crm_updated_at();

-- =================================================================================
-- Inserir Templates Iniciais
-- =================================================================================
INSERT INTO public.crm_message_templates (clinic_id, name, trigger_event, content)
SELECT id, 'Boas-vindas Novo Lead', 'LEAD_CREATED', 'Olá, {{patient_name}}! Recebemos seu interesse na Clínica Zoe. Nossa equipe entrará em contato em breve.'
FROM public.clinics
ON CONFLICT (clinic_id, name) DO NOTHING;

-- Ajustar regras de automação default para disparar a mensagem
INSERT INTO public.crm_automation_rules (clinic_id, name, description, trigger_event, action_type, action_config, active)
SELECT id, 'Disparo Automático de Boas-vindas', 'Envia WhatsApp ao criar novo lead', 'LEAD_CREATED', 'SEND_MESSAGE', '{"channel": "WHATSAPP", "provider": "MOCK"}', true 
FROM public.clinics c
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_automation_rules r 
  WHERE r.clinic_id = c.id AND r.name = 'Disparo Automático de Boas-vindas'
);


-- =================================================================================
-- Row Level Security (RLS)
-- =================================================================================
ALTER TABLE public.crm_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_messages ENABLE ROW LEVEL SECURITY;

-- ADMIN: Acesso Total
CREATE POLICY "Admin crm_templates all" ON public.crm_message_templates 
  FOR ALL USING (public.is_admin() AND clinic_id = public.current_clinic_id())
  WITH CHECK (public.is_admin() AND clinic_id = public.current_clinic_id());

CREATE POLICY "Admin crm_messages all" ON public.crm_messages 
  FOR ALL USING (public.is_admin() AND clinic_id = public.current_clinic_id())
  WITH CHECK (public.is_admin() AND clinic_id = public.current_clinic_id());

-- RECEPCIONISTA: Visualizar templates e mensagens
CREATE POLICY "Recep crm_templates view" ON public.crm_message_templates 
  FOR SELECT USING (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());

CREATE POLICY "Recep crm_messages view" ON public.crm_messages 
  FOR SELECT USING (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());

-- PROFISSIONAL: Visualizar apenas mensagens de seus pacientes da agenda
CREATE POLICY "Prof crm_messages select" ON public.crm_messages 
  FOR SELECT USING (
    public.has_role('PROFISSIONAL') AND 
    clinic_id = public.current_clinic_id() AND
    EXISTS (SELECT 1 FROM public.appointments a WHERE a.patient_id = crm_messages.patient_id AND a.professional_id = public.get_current_professional_id())
  );

-- =================================================================================
-- RPC Segurança para Escrita por Workers
-- =================================================================================
CREATE OR REPLACE FUNCTION public.create_crm_message(
    p_clinic_id UUID,
    p_patient_id UUID,
    p_channel VARCHAR,
    p_provider VARCHAR,
    p_direction VARCHAR,
    p_template_id UUID,
    p_content TEXT,
    p_status VARCHAR,
    p_error_message TEXT
) RETURNS UUID
SECURITY DEFINER
AS $$
DECLARE
    v_message_id UUID;
BEGIN
    INSERT INTO public.crm_messages (
        clinic_id, patient_id, channel, provider, direction, template_id, content, status, error_message
    ) VALUES (
        p_clinic_id, p_patient_id, p_channel, p_provider, p_direction, p_template_id, p_content, p_status, p_error_message
    ) RETURNING id INTO v_message_id;
    
    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;
