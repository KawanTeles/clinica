-- =================================================================================
-- Migration: 006_refactor_multitenancy.sql
-- Descrição: Injeção de current_clinic_id() via JWT para suporte a SaaS.
-- =================================================================================

-- Função principal para extrair ID da clínica ativa via JWT Claims
CREATE OR REPLACE FUNCTION public.current_clinic()
RETURNS public.clinics AS $$
DECLARE
  v_clinic_id UUID;
  v_clinic public.clinics;
BEGIN
  v_clinic_id := NULLIF(current_setting('request.jwt.claim.clinic_id', true), '')::UUID;
  
  IF v_clinic_id IS NOT NULL THEN
    SELECT * INTO v_clinic FROM public.clinics WHERE id = v_clinic_id;
    RETURN v_clinic;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.clinic_active()
RETURNS BOOLEAN AS $$
  SELECT (public.current_clinic()).ativo = TRUE;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS UUID AS $$
  SELECT (public.current_clinic()).id;
$$ LANGUAGE sql STABLE;

-- 1. Criação retroativa da tabela de Clínicas, caso não exista (da Etapa 7)
CREATE TABLE IF NOT EXISTS public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(150) NOT NULL,
  cnpj VARCHAR(20) UNIQUE,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserindo um tenant padrão apenas se a tabela estiver vazia
INSERT INTO public.clinics (nome) 
SELECT 'Clínica Zoe Matriz' WHERE NOT EXISTS (SELECT 1 FROM public.clinics);

-- 2. Propagação retroativa da coluna clinic_id para as tabelas iniciais
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id);
UPDATE public.user_profiles SET clinic_id = (SELECT id FROM public.clinics LIMIT 1) WHERE clinic_id IS NULL;

ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id);
UPDATE public.roles SET clinic_id = (SELECT id FROM public.clinics LIMIT 1) WHERE clinic_id IS NULL;

ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id);
UPDATE public.permissions SET clinic_id = (SELECT id FROM public.clinics LIMIT 1) WHERE clinic_id IS NULL;

ALTER TABLE public.security_logs ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id);
UPDATE public.security_logs SET clinic_id = (SELECT id FROM public.clinics LIMIT 1) WHERE clinic_id IS NULL;

ALTER TABLE public.professional_schedule ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id);
UPDATE public.professional_schedule SET clinic_id = (SELECT id FROM public.clinics LIMIT 1) WHERE clinic_id IS NULL;

ALTER TABLE public.schedule_blocks ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id);
UPDATE public.schedule_blocks SET clinic_id = (SELECT id FROM public.clinics LIMIT 1) WHERE clinic_id IS NULL;

ALTER TABLE public.appointment_history ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id);
UPDATE public.appointment_history SET clinic_id = (SELECT id FROM public.clinics LIMIT 1) WHERE clinic_id IS NULL;

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id);
UPDATE public.notifications SET clinic_id = (SELECT id FROM public.clinics LIMIT 1) WHERE clinic_id IS NULL;

-- 3. Criação de Índices Básicos de Performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_clinic ON public.user_profiles(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic ON public.appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic ON public.patients(clinic_id);
