-- =================================================================================
-- Migration: 019_crm_event_engine.sql
-- Descrição: Motor base de eventos para automações do CRM
-- =================================================================================

CREATE TABLE public.crm_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_source VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices
CREATE INDEX idx_crm_events_clinic ON public.crm_events(clinic_id);
CREATE INDEX idx_crm_events_patient ON public.crm_events(patient_id);
CREATE INDEX idx_crm_events_type ON public.crm_events(event_type);
CREATE INDEX idx_crm_events_processed ON public.crm_events(processed);

-- RLS
ALTER TABLE public.crm_events ENABLE ROW LEVEL SECURITY;

-- ADMIN (Acesso Total com isolamento SaaS)
CREATE POLICY "Admin crm_events all" ON public.crm_events 
  FOR ALL USING (public.is_admin() AND clinic_id = public.current_clinic_id())
  WITH CHECK (public.is_admin() AND clinic_id = public.current_clinic_id());

-- RECEPÇÃO (Gera eventos permitidos)
CREATE POLICY "Recep crm_events insert" ON public.crm_events 
  FOR INSERT WITH CHECK (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());

CREATE POLICY "Recep crm_events select" ON public.crm_events 
  FOR SELECT USING (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());

CREATE POLICY "Recep crm_events update" ON public.crm_events 
  FOR UPDATE USING (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());

-- PROFISSIONAL (Apenas relacionados à própria agenda/pacientes)
CREATE POLICY "Prof crm_events select" ON public.crm_events 
  FOR SELECT USING (
    public.has_role('PROFISSIONAL') AND 
    clinic_id = public.current_clinic_id() AND
    (
      professional_id = public.get_current_professional_id() OR
      EXISTS (SELECT 1 FROM public.appointments a WHERE a.patient_id = crm_events.patient_id AND a.professional_id = public.get_current_professional_id())
    )
  );

CREATE POLICY "Prof crm_events insert" ON public.crm_events 
  FOR INSERT WITH CHECK (
    public.has_role('PROFISSIONAL') AND 
    clinic_id = public.current_clinic_id() AND
    EXISTS (SELECT 1 FROM public.appointments a WHERE a.patient_id = patient_id AND a.professional_id = public.get_current_professional_id())
  );
