-- =================================================================================
-- Migration: 020_crm_automation_rules.sql
-- Descrição: Engine de regras de automação
-- =================================================================================

CREATE TABLE public.crm_automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    name VARCHAR(150),
    description TEXT,
    trigger_event VARCHAR(100),
    action_type VARCHAR(100),
    action_config JSONB DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices
CREATE INDEX idx_crm_rules_clinic ON public.crm_automation_rules(clinic_id);
CREATE INDEX idx_crm_rules_trigger ON public.crm_automation_rules(trigger_event);
CREATE INDEX idx_crm_rules_active ON public.crm_automation_rules(active);

-- Triggers de updated_at
CREATE TRIGGER trg_crm_rules_updated_at
BEFORE UPDATE ON public.crm_automation_rules
FOR EACH ROW EXECUTE FUNCTION public.set_crm_updated_at();

-- RLS
ALTER TABLE public.crm_automation_rules ENABLE ROW LEVEL SECURITY;

-- ADMIN (Acesso Total com isolamento SaaS)
CREATE POLICY "Admin crm_rules all" ON public.crm_automation_rules 
  FOR ALL USING (public.is_admin() AND clinic_id = public.current_clinic_id())
  WITH CHECK (public.is_admin() AND clinic_id = public.current_clinic_id());

-- RECEPÇÃO (Somente visualização, já que é config administrativa)
CREATE POLICY "Recep crm_rules view" ON public.crm_automation_rules 
  FOR SELECT USING (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());

-- =================================================================================
-- Inserir regras iniciais (default) para todas as clínicas existentes
-- =================================================================================

-- Regra 1: LEAD_CREATED -> CREATE_TASK
INSERT INTO public.crm_automation_rules (clinic_id, name, description, trigger_event, action_type, action_config, active)
SELECT id, 'Tarefa de Boas-Vindas', 'Cria tarefa: Entrar em contato com novo paciente', 'LEAD_CREATED', 'CREATE_TASK', '{"title": "Entrar em contato com novo paciente", "assign_to_role": "RECEPCIONISTA"}', true 
FROM public.clinics;

-- Regra 2: PIPELINE_CHANGED -> CREATE_INTERACTION
INSERT INTO public.crm_automation_rules (clinic_id, name, description, trigger_event, action_type, action_config, active)
SELECT id, 'Histórico de Mudança de Funil', 'Registrar: Paciente avançou no funil CRM', 'PIPELINE_CHANGED', 'CREATE_INTERACTION', '{"type": "system", "description": "Paciente avançou no funil CRM"}', true 
FROM public.clinics;

-- Regra 3: INTERACTION_CREATED -> automation_logs
INSERT INTO public.crm_automation_rules (clinic_id, name, description, trigger_event, action_type, action_config, active)
SELECT id, 'Auditoria de Interações', 'Registrar histórico no automation_logs', 'INTERACTION_CREATED', 'LOG_ONLY', '{}', true 
FROM public.clinics;
