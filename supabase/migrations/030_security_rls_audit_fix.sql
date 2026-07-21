-- =================================================================================
-- Migration: 030_security_rls_audit_fix.sql
-- Descrição: Habilita RLS em todas as tabelas vulneráveis remanescentes (005, 008, 015)
-- =================================================================================

-- 1. Habilitar RLS para todas as tabelas afetadas
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_insurances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_health_insurances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;

-- Da Migration 008 (Portal do Paciente)
ALTER TABLE public.patient_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_sessions ENABLE ROW LEVEL SECURITY;

-- Da Migration 015
ALTER TABLE public.financial_audit ENABLE ROW LEVEL SECURITY;

-- 2. Limpar políticas existentes se houver (para garantir idempotência)
DROP POLICY IF EXISTS "Block all audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Block all financial_audit" ON public.financial_audit;

-- 3. Políticas Cegas (Apenas acesso via RPC / Trigger / Security Definer)
-- Estas tabelas não podem ser lidas ou editadas pelo frontend diretamente.
CREATE POLICY "Block all audit_logs" ON public.audit_logs FOR ALL USING (false);
CREATE POLICY "Block all financial_audit" ON public.financial_audit FOR ALL USING (false);

-- 4. Tabelas Filhas Diretas de Clínicas (clinic_id)
-- health_insurances, procedures, specialties

CREATE POLICY "Admin All health_insurances" ON public.health_insurances FOR ALL 
USING (public.is_admin() AND clinic_id = public.current_clinic_id());
CREATE POLICY "Recep Select health_insurances" ON public.health_insurances FOR SELECT 
USING (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());
CREATE POLICY "Prof Select health_insurances" ON public.health_insurances FOR SELECT 
USING (public.has_role('PROFISSIONAL') AND clinic_id = public.current_clinic_id());

CREATE POLICY "Admin All procedures" ON public.procedures FOR ALL 
USING (public.is_admin() AND clinic_id = public.current_clinic_id());
CREATE POLICY "Recep Select procedures" ON public.procedures FOR SELECT 
USING (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());
CREATE POLICY "Prof Select procedures" ON public.procedures FOR SELECT 
USING (public.has_role('PROFISSIONAL') AND clinic_id = public.current_clinic_id());

CREATE POLICY "Admin All specialties" ON public.specialties FOR ALL 
USING (public.is_admin() AND clinic_id = public.current_clinic_id());
CREATE POLICY "Recep Select specialties" ON public.specialties FOR SELECT 
USING (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());
CREATE POLICY "Prof Select specialties" ON public.specialties FOR SELECT 
USING (public.has_role('PROFISSIONAL') AND clinic_id = public.current_clinic_id());

-- 5. Tabelas Filhas de Pacientes (patient_id)
-- patient_alerts, patient_contacts, patient_documents, patient_health_insurances, patient_devices, patient_sessions

CREATE POLICY "Admin All patient_alerts" ON public.patient_alerts FOR ALL 
USING (public.is_admin() AND patient_id IN (SELECT id FROM public.patients WHERE clinic_id = public.current_clinic_id()));
CREATE POLICY "Recep Select patient_alerts" ON public.patient_alerts FOR SELECT 
USING (public.has_role('RECEPCIONISTA') AND patient_id IN (SELECT id FROM public.patients WHERE clinic_id = public.current_clinic_id()));
CREATE POLICY "Prof Select patient_alerts" ON public.patient_alerts FOR SELECT 
USING (public.has_role('PROFISSIONAL') AND patient_id IN (SELECT id FROM public.patients WHERE clinic_id = public.current_clinic_id()));

CREATE POLICY "Admin All patient_contacts" ON public.patient_contacts FOR ALL 
USING (public.is_admin() AND patient_id IN (SELECT id FROM public.patients WHERE clinic_id = public.current_clinic_id()));
CREATE POLICY "Recep Select patient_contacts" ON public.patient_contacts FOR SELECT 
USING (public.has_role('RECEPCIONISTA') AND patient_id IN (SELECT id FROM public.patients WHERE clinic_id = public.current_clinic_id()));
CREATE POLICY "Prof Select patient_contacts" ON public.patient_contacts FOR SELECT 
USING (public.has_role('PROFISSIONAL') AND patient_id IN (SELECT id FROM public.patients WHERE clinic_id = public.current_clinic_id()));

CREATE POLICY "Admin All patient_documents" ON public.patient_documents FOR ALL 
USING (public.is_admin() AND patient_id IN (SELECT id FROM public.patients WHERE clinic_id = public.current_clinic_id()));
CREATE POLICY "Recep Select patient_documents" ON public.patient_documents FOR SELECT 
USING (public.has_role('RECEPCIONISTA') AND patient_id IN (SELECT id FROM public.patients WHERE clinic_id = public.current_clinic_id()));
CREATE POLICY "Prof Select patient_documents" ON public.patient_documents FOR SELECT 
USING (public.has_role('PROFISSIONAL') AND patient_id IN (SELECT id FROM public.patients WHERE clinic_id = public.current_clinic_id()));

CREATE POLICY "Admin All patient_health_insurances" ON public.patient_health_insurances FOR ALL 
USING (public.is_admin() AND patient_id IN (SELECT id FROM public.patients WHERE clinic_id = public.current_clinic_id()));
CREATE POLICY "Recep Select patient_health_insurances" ON public.patient_health_insurances FOR SELECT 
USING (public.has_role('RECEPCIONISTA') AND patient_id IN (SELECT id FROM public.patients WHERE clinic_id = public.current_clinic_id()));
CREATE POLICY "Prof Select patient_health_insurances" ON public.patient_health_insurances FOR SELECT 
USING (public.has_role('PROFISSIONAL') AND patient_id IN (SELECT id FROM public.patients WHERE clinic_id = public.current_clinic_id()));

-- Portal do Cliente: Se houver backend/RPC pra ler sessões pelo admin
CREATE POLICY "Admin All patient_devices" ON public.patient_devices FOR ALL 
USING (public.is_admin() AND patient_id IN (SELECT id FROM public.patients WHERE clinic_id = public.current_clinic_id()));
CREATE POLICY "Admin All patient_sessions" ON public.patient_sessions FOR ALL 
USING (public.is_admin() AND patient_id IN (SELECT id FROM public.patients WHERE clinic_id = public.current_clinic_id()));
-- No futuro: Adicionar política para o próprio paciente ler sua sessão (se autenticado pelo portal)

-- 6. Tabelas Filhas de Profissionais (professional_id)
-- professional_procedures

CREATE POLICY "Admin All professional_procedures" ON public.professional_procedures FOR ALL 
USING (public.is_admin() AND professional_id IN (SELECT id FROM public.professionals WHERE clinic_id = public.current_clinic_id()));
CREATE POLICY "Recep Select professional_procedures" ON public.professional_procedures FOR SELECT 
USING (public.has_role('RECEPCIONISTA') AND professional_id IN (SELECT id FROM public.professionals WHERE clinic_id = public.current_clinic_id()));
CREATE POLICY "Prof All professional_procedures" ON public.professional_procedures FOR ALL 
USING (professional_id = public.get_current_professional_id());
