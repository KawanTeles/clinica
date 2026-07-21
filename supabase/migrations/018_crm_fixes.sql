-- =================================================================================
-- Migration: 018_crm_fixes.sql
-- Descrição: Correção de políticas RLS da Recepcionista no CRM 
-- =================================================================================

-- 1. Inserir permissões ausentes para a RECEPCIONISTA (Necessárias para Criar Leads e Mover Oportunidades)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.nome = 'RECEPCIONISTA' 
  AND p.nome IN ('crm.pipeline', 'crm.manage')
ON CONFLICT DO NOTHING;

-- 2. Correção no RLS de Patients para permitir que a RECEPCIONISTA crie o paciente
CREATE POLICY "Recep patients insert" ON public.patients 
  FOR INSERT WITH CHECK (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());

-- As políticas de Manage all para crm_pipeline e crm_interactions criadas na migration 017 
-- usavam 'crm.pipeline' e 'crm.manage', que agora foram concedidas para a Recepcionista.
