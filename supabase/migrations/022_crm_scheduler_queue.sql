-- =================================================================================
-- Migration: 022_crm_scheduler_queue.sql
-- Descrição: Tabela para gerenciamento assíncrono de jobs do CRM
-- =================================================================================

CREATE TABLE public.crm_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.crm_events(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES public.crm_automation_rules(id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices
CREATE INDEX idx_crm_jobs_clinic ON public.crm_jobs(clinic_id);
CREATE INDEX idx_crm_jobs_status ON public.crm_jobs(status);
CREATE INDEX idx_crm_jobs_scheduled_at ON public.crm_jobs(scheduled_at);

-- Trigger para updated_at
CREATE TRIGGER trg_crm_jobs_updated_at
BEFORE UPDATE ON public.crm_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_crm_updated_at();

-- =================================================================================
-- RLS - Row Level Security
-- =================================================================================
ALTER TABLE public.crm_jobs ENABLE ROW LEVEL SECURITY;

-- ADMIN (Acesso Total com isolamento SaaS)
CREATE POLICY "Admin crm_jobs all" ON public.crm_jobs 
  FOR ALL USING (public.is_admin() AND clinic_id = public.current_clinic_id())
  WITH CHECK (public.is_admin() AND clinic_id = public.current_clinic_id());

-- =================================================================================
-- Trigger: Transformar Eventos em Jobs (crm_events -> crm_jobs)
-- =================================================================================
CREATE OR REPLACE FUNCTION public.trg_process_crm_event_to_jobs()
RETURNS TRIGGER
SECURITY DEFINER -- Garante que o trigger pode inserir na tabela crm_jobs independente do RLS do frontend
AS $$
BEGIN
    -- Busca regras ativas que dão match com o tipo de evento e clinic_id
    INSERT INTO public.crm_jobs (clinic_id, event_id, rule_id, status, scheduled_at, payload)
    SELECT 
        NEW.clinic_id,
        NEW.id,
        r.id,
        'pending',
        now(),
        NEW.payload
    FROM public.crm_automation_rules r
    WHERE r.clinic_id = NEW.clinic_id 
      AND r.trigger_event = NEW.event_type 
      AND r.active = true;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_after_insert_crm_events
AFTER INSERT ON public.crm_events
FOR EACH ROW EXECUTE FUNCTION public.trg_process_crm_event_to_jobs();
