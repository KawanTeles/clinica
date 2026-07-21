-- =================================================================================
-- Migration: 009_standardize_rls.sql
-- Descrição: Atualiza 100% das políticas de segurança baseando-se no tenant atual.
-- =================================================================================

-- 1. Atualizar Patients (Políticas substituídas para usar current_clinic_id())
DROP POLICY IF EXISTS "Admin pac all" ON public.patients;
DROP POLICY IF EXISTS "Recep pac all" ON public.patients;
DROP POLICY IF EXISTS "Prof pac select" ON public.patients;

CREATE POLICY "Admin pac all SaaS" ON public.patients FOR ALL 
USING (public.is_admin() AND clinic_id = public.current_clinic_id());

CREATE POLICY "Recep pac all SaaS" ON public.patients FOR ALL 
USING (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());

CREATE POLICY "Prof pac select SaaS" ON public.patients FOR SELECT 
USING (
  clinic_id = public.current_clinic_id() AND 
  EXISTS (
    SELECT 1 FROM public.appointments a 
    WHERE a.patient_id = patients.id 
    AND a.professional_id = public.get_current_professional_id()
  )
);

-- 2. Atualizar Appointments (Agenda isolada por clínica)
DROP POLICY IF EXISTS "Admin All Appointments" ON public.appointments;
DROP POLICY IF EXISTS "Recep All Appointments" ON public.appointments;
DROP POLICY IF EXISTS "Prof Prof Appointments" ON public.appointments;

CREATE POLICY "Admin All Appointments SaaS" ON public.appointments FOR ALL 
USING (public.is_admin() AND clinic_id = public.current_clinic_id());

CREATE POLICY "Recep All Appointments SaaS" ON public.appointments FOR ALL 
USING (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());

CREATE POLICY "Prof Prof Appointments SaaS" ON public.appointments FOR ALL 
USING (
    professional_id = public.get_current_professional_id() AND 
    clinic_id = public.current_clinic_id()
);
