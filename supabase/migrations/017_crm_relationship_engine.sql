-- =================================================================================
-- Migration: 017_crm_relationship_engine.sql
-- Descrição: Criação das tabelas base para o módulo de CRM
-- =================================================================================

-- 1. Novas Permissões
INSERT INTO public.permissions (nome, descricao) VALUES 
('crm.view', 'Visualizar dados do CRM'),
('crm.manage', 'Gerenciar dados do CRM'),
('crm.tasks', 'Gerenciar tarefas do CRM'),
('crm.pipeline', 'Gerenciar funil de vendas/atendimento do CRM'),
('crm.automation', 'Gerenciar automações do CRM')
ON CONFLICT (nome) DO NOTHING;

-- 2. Vincular Permissões aos Roles

-- ADMIN: todas
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.nome = 'ADMIN' 
  AND p.nome IN ('crm.view', 'crm.manage', 'crm.tasks', 'crm.pipeline', 'crm.automation')
ON CONFLICT DO NOTHING;

-- RECEPCIONISTA: crm.view, crm.tasks
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.nome = 'RECEPCIONISTA' 
  AND p.nome IN ('crm.view', 'crm.tasks')
ON CONFLICT DO NOTHING;

-- PROFISSIONAL: crm.view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.nome = 'PROFISSIONAL' 
  AND p.nome IN ('crm.view')
ON CONFLICT DO NOTHING;


-- 3. Criação das Tabelas

CREATE TABLE public.crm_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.crm_pipeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'media',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.crm_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pendente',
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
    event VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- 4. Criação de Índices
CREATE INDEX idx_crm_interact_patient ON public.crm_interactions(patient_id);
CREATE INDEX idx_crm_pipeline_patient ON public.crm_pipeline(patient_id);
CREATE INDEX idx_crm_tasks_patient ON public.crm_tasks(patient_id);
CREATE INDEX idx_crm_tasks_assignee ON public.crm_tasks(assigned_to);
CREATE INDEX idx_crm_automation_patient ON public.automation_logs(patient_id);

CREATE INDEX idx_crm_interactions_clinic ON public.crm_interactions(clinic_id);
CREATE INDEX idx_crm_pipeline_clinic ON public.crm_pipeline(clinic_id);
CREATE INDEX idx_crm_tasks_clinic ON public.crm_tasks(clinic_id);
CREATE INDEX idx_automation_logs_clinic ON public.automation_logs(clinic_id);


-- 5. Triggers de Atualização (updated_at)
CREATE OR REPLACE FUNCTION public.set_crm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crm_interactions_updated_at
BEFORE UPDATE ON public.crm_interactions
FOR EACH ROW EXECUTE FUNCTION public.set_crm_updated_at();

CREATE TRIGGER trg_crm_pipeline_updated_at
BEFORE UPDATE ON public.crm_pipeline
FOR EACH ROW EXECUTE FUNCTION public.set_crm_updated_at();

CREATE TRIGGER trg_crm_tasks_updated_at
BEFORE UPDATE ON public.crm_tasks
FOR EACH ROW EXECUTE FUNCTION public.set_crm_updated_at();


-- 6. Row Level Security (RLS)
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- ADMIN (Acesso Total com isolamento SaaS)
CREATE POLICY "Admin crm_interactions all" ON public.crm_interactions 
  FOR ALL USING (public.is_admin() AND clinic_id = public.current_clinic_id())
  WITH CHECK (public.is_admin() AND clinic_id = public.current_clinic_id());

CREATE POLICY "Admin crm_pipeline all" ON public.crm_pipeline 
  FOR ALL USING (public.is_admin() AND clinic_id = public.current_clinic_id())
  WITH CHECK (public.is_admin() AND clinic_id = public.current_clinic_id());

CREATE POLICY "Admin crm_tasks all" ON public.crm_tasks 
  FOR ALL USING (public.is_admin() AND clinic_id = public.current_clinic_id())
  WITH CHECK (public.is_admin() AND clinic_id = public.current_clinic_id());

CREATE POLICY "Admin automation_logs all" ON public.automation_logs 
  FOR ALL USING (public.is_admin() AND clinic_id = public.current_clinic_id())
  WITH CHECK (public.is_admin() AND clinic_id = public.current_clinic_id());

-- RECEPCIONISTA E USUÁRIOS COM PERMISSÕES ESPECÍFICAS
-- Interactions
CREATE POLICY "Recep crm_interactions select" ON public.crm_interactions 
  FOR SELECT USING (public.has_role('RECEPCIONISTA') AND public.has_permission('crm.view') AND clinic_id = public.current_clinic_id());

CREATE POLICY "Manage crm_interactions all" ON public.crm_interactions 
  FOR ALL USING (public.has_permission('crm.manage') AND clinic_id = public.current_clinic_id())
  WITH CHECK (public.has_permission('crm.manage') AND clinic_id = public.current_clinic_id());

-- Pipeline
CREATE POLICY "Recep crm_pipeline select" ON public.crm_pipeline 
  FOR SELECT USING (public.has_role('RECEPCIONISTA') AND public.has_permission('crm.view') AND clinic_id = public.current_clinic_id());

CREATE POLICY "Manage crm_pipeline all" ON public.crm_pipeline 
  FOR ALL USING (public.has_permission('crm.pipeline') AND clinic_id = public.current_clinic_id())
  WITH CHECK (public.has_permission('crm.pipeline') AND clinic_id = public.current_clinic_id());

-- Tasks
CREATE POLICY "Recep crm_tasks select" ON public.crm_tasks 
  FOR SELECT USING (public.has_role('RECEPCIONISTA') AND public.has_permission('crm.view') AND clinic_id = public.current_clinic_id());

CREATE POLICY "Recep crm_tasks insert" ON public.crm_tasks 
  FOR INSERT WITH CHECK (public.has_role('RECEPCIONISTA') AND public.has_permission('crm.tasks') AND assigned_to = auth.uid() AND clinic_id = public.current_clinic_id());

CREATE POLICY "Recep crm_tasks update" ON public.crm_tasks 
  FOR UPDATE USING (public.has_role('RECEPCIONISTA') AND public.has_permission('crm.tasks') AND assigned_to = auth.uid() AND clinic_id = public.current_clinic_id());

CREATE POLICY "Manage crm_tasks all" ON public.crm_tasks 
  FOR ALL USING (public.has_permission('crm.manage') AND clinic_id = public.current_clinic_id())
  WITH CHECK (public.has_permission('crm.manage') AND clinic_id = public.current_clinic_id());

-- Automation Logs (Apenas Admin ou usuários com permissão explícita)
CREATE POLICY "User automation_logs all" ON public.automation_logs 
  FOR ALL USING (public.has_permission('crm.automation') AND clinic_id = public.current_clinic_id())
  WITH CHECK (public.has_permission('crm.automation') AND clinic_id = public.current_clinic_id());


-- PROFISSIONAL (Acesso de Leitura APENAS para pacientes da sua própria agenda)
CREATE POLICY "Prof crm_interactions select" ON public.crm_interactions 
  FOR SELECT USING (
    public.has_role('PROFISSIONAL') AND 
    public.has_permission('crm.view') AND 
    clinic_id = public.current_clinic_id() AND
    EXISTS (SELECT 1 FROM public.appointments a WHERE a.patient_id = crm_interactions.patient_id AND a.professional_id = public.get_current_professional_id())
  );

CREATE POLICY "Prof crm_pipeline select" ON public.crm_pipeline 
  FOR SELECT USING (
    public.has_role('PROFISSIONAL') AND 
    public.has_permission('crm.view') AND 
    clinic_id = public.current_clinic_id() AND
    EXISTS (SELECT 1 FROM public.appointments a WHERE a.patient_id = crm_pipeline.patient_id AND a.professional_id = public.get_current_professional_id())
  );

CREATE POLICY "Prof crm_tasks select" ON public.crm_tasks 
  FOR SELECT USING (
    public.has_role('PROFISSIONAL') AND 
    public.has_permission('crm.view') AND 
    clinic_id = public.current_clinic_id() AND
    EXISTS (SELECT 1 FROM public.appointments a WHERE a.patient_id = crm_tasks.patient_id AND a.professional_id = public.get_current_professional_id())
  );
