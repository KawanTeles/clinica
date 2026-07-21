-- =================================================================================
-- Migration: 005_module_patients_enterprise.sql
-- Descrição: Clínicas (SaaS), Auditoria Universal, Pacientes, Procedimentos e Financeiro.
-- =================================================================================

-- 1. Estrutura Multi-Tenant Base
CREATE TABLE public.clinics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(150) NOT NULL,
  cnpj VARCHAR(20) UNIQUE,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
INSERT INTO public.clinics (nome) VALUES ('Clínica Zoe Matriz');

-- Adicionando clinic_id nas tabelas preexistentes
ALTER TABLE public.professionals 
ADD COLUMN clinic_id UUID REFERENCES public.clinics(id) DEFAULT (SELECT id FROM public.clinics LIMIT 1);
ALTER TABLE public.appointments 
ADD COLUMN clinic_id UUID REFERENCES public.clinics(id) DEFAULT (SELECT id FROM public.clinics LIMIT 1);

-- 2. Auditoria Universal (Redução de JSONs gigantescos e reaproveitamento)
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL, -- Ex: 'patients', 'appointments'
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.trigger_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_old_json JSONB := '{}'::jsonb;
  v_new_json JSONB := '{}'::jsonb;
  v_diff JSONB := '{}'::jsonb;
  k TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT key FROM jsonb_each(to_jsonb(NEW))
    LOOP
      IF to_jsonb(NEW)->>k IS DISTINCT FROM to_jsonb(OLD)->>k THEN
        v_diff := jsonb_set(v_diff, ARRAY[k], to_jsonb(NEW)->k);
        v_old_json := jsonb_set(v_old_json, ARRAY[k], to_jsonb(OLD)->k);
      END IF;
    END LOOP;
    
    IF v_diff <> '{}'::jsonb THEN
      INSERT INTO public.audit_logs (entity_type, entity_id, action, old_data, new_data, changed_by)
      VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', v_old_json, v_diff, auth.uid());
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Planos de Saúde (Catálogo)
CREATE TABLE public.health_insurances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID REFERENCES public.clinics(id) DEFAULT (SELECT id FROM public.clinics LIMIT 1),
  nome VARCHAR(150) NOT NULL UNIQUE,
  cnpj VARCHAR(20),
  telefone VARCHAR(20),
  registro_ans VARCHAR(50),
  ativo BOOLEAN DEFAULT TRUE
);

-- 4. Especialidades e Procedimentos
CREATE TABLE public.specialties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID REFERENCES public.clinics(id) DEFAULT (SELECT id FROM public.clinics LIMIT 1),
  nome VARCHAR(150) NOT NULL UNIQUE,
  descricao TEXT
);

CREATE TABLE public.procedures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID REFERENCES public.clinics(id) DEFAULT (SELECT id FROM public.clinics LIMIT 1),
  specialty_id UUID REFERENCES public.specialties(id) ON DELETE CASCADE,
  nome VARCHAR(150) NOT NULL,
  descricao TEXT,
  duracao INTEGER DEFAULT 60,
  ativo BOOLEAN DEFAULT TRUE
);

CREATE TABLE public.professional_procedures (
  professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE,
  procedure_id UUID REFERENCES public.procedures(id) ON DELETE CASCADE,
  valor_avista DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  valor_cartao DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  duracao_personalizada INTEGER,
  ativo BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (professional_id, procedure_id)
);

-- 5. Pacientes
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES public.clinics(id) DEFAULT (SELECT id FROM public.clinics LIMIT 1),
    
    -- Login Cliente
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, 
    email VARCHAR(150) UNIQUE,
    email_verificado BOOLEAN DEFAULT FALSE,
    telefone_verificado BOOLEAN DEFAULT FALSE,
    ultimo_login TIMESTAMP WITH TIME ZONE,
    foto TEXT,
    
    preferred_notification_channel VARCHAR(20) DEFAULT 'WHATSAPP' CHECK (preferred_notification_channel IN ('WHATSAPP', 'EMAIL', 'SMS')),
    language VARCHAR(10) DEFAULT 'pt-BR',
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    token_notificacoes TEXT,
    
    nome VARCHAR(150) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    rg VARCHAR(20),
    data_nascimento DATE,
    sexo VARCHAR(20),
    telefone VARCHAR(20),
    whatsapp VARCHAR(20),
    
    -- Endereço
    cep VARCHAR(10),
    logradouro VARCHAR(150),
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    uf VARCHAR(2),
    pais VARCHAR(50) DEFAULT 'Brasil',
    codigo_ibge VARCHAR(10),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    
    observacoes_administrativas TEXT,
    
    -- LGPD
    aceitou_lgpd BOOLEAN DEFAULT FALSE NOT NULL,
    data_aceite_lgpd TIMESTAMP WITH TIME ZONE,
    ip_aceite VARCHAR(50),
    user_agent TEXT,
    versao_termo VARCHAR(20),
    data_revogacao TIMESTAMP WITH TIME ZONE,
    motivo_revogacao TEXT,
    
    status VARCHAR(20) DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo', 'Arquivado')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE TRIGGER trg_patient_audit AFTER INSERT OR UPDATE OR DELETE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.trigger_audit_log();

-- 6. Convênios do Paciente
CREATE TABLE public.patient_health_insurances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  health_insurance_id UUID REFERENCES public.health_insurances(id) ON DELETE RESTRICT,
  numero_carteirinha VARCHAR(50) NOT NULL,
  plano VARCHAR(100),
  categoria_plano VARCHAR(50),
  acomodacao VARCHAR(30),
  validade DATE,
  titular BOOLEAN DEFAULT TRUE,
  is_primary BOOLEAN DEFAULT FALSE,
  observacoes TEXT
);
CREATE UNIQUE INDEX idx_patient_primary_insurance ON public.patient_health_insurances(patient_id) WHERE is_primary = TRUE;

-- 7. Contatos Familiares
CREATE TABLE public.patient_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  nome VARCHAR(150) NOT NULL,
  parentesco VARCHAR(50) NOT NULL CHECK (parentesco IN ('PAI','MAE','RESPONSAVEL','CONJUGE','FILHO','CUIDADOR','OUTRO')),
  telefone VARCHAR(20),
  whatsapp VARCHAR(20),
  email VARCHAR(150),
  responsavel_financeiro BOOLEAN DEFAULT FALSE,
  contato_emergencia BOOLEAN DEFAULT FALSE,
  autorizado_informacoes BOOLEAN DEFAULT FALSE
);

-- 8. Alertas
CREATE TABLE public.patient_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  descricao TEXT NOT NULL,
  prioridade SMALLINT DEFAULT 2 CHECK (prioridade BETWEEN 1 AND 4),
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE TRIGGER trg_alert_audit AFTER INSERT OR UPDATE OR DELETE ON public.patient_alerts FOR EACH ROW EXECUTE FUNCTION public.trigger_audit_log();

-- 9. Documentos (Soft Delete & Versionamento)
CREATE TABLE public.patient_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  nome_arquivo VARCHAR(255) NOT NULL,
  descricao TEXT,
  mime_type VARCHAR(100),
  tamanho BIGINT,
  bucket VARCHAR(100) DEFAULT 'patient_docs',
  storage_path TEXT NOT NULL,
  hash VARCHAR(255),
  versao INTEGER DEFAULT 1,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES auth.users(id)
);

-- 10. Atualizações Críticas em Appointments
ALTER TABLE public.appointments
ADD CONSTRAINT fk_appointment_patient FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE RESTRICT,
ADD COLUMN procedure_id UUID REFERENCES public.procedures(id) ON DELETE RESTRICT,
ADD COLUMN valor_cobrado DECIMAL(10,2),
ADD COLUMN duracao_real INTEGER,
ADD COLUMN desconto DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN observacao_financeira TEXT;
CREATE TRIGGER trg_appointment_audit AFTER INSERT OR UPDATE OR DELETE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.trigger_audit_log();

-- 11. Financeiro (Com Taxas e Gateways)
CREATE TABLE public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES public.clinics(id) DEFAULT (SELECT id FROM public.clinics LIMIT 1),
    patient_id UUID REFERENCES public.patients(id) ON DELETE RESTRICT,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    tipo VARCHAR(20) CHECK (tipo IN ('RECEITA', 'DESPESA', 'ESTORNO')),
    valor DECIMAL(10,2) NOT NULL,
    forma_pagamento VARCHAR(50),
    parcelas INTEGER DEFAULT 1,
    gateway VARCHAR(50),
    taxa DECIMAL(10,2) DEFAULT 0.00,
    numero_documento VARCHAR(100),
    status VARCHAR(20) DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PAGO', 'CANCELADO')),
    observacao TEXT,
    data_vencimento DATE,
    data_pagamento DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE TRIGGER trg_finance_audit AFTER INSERT OR UPDATE OR DELETE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.trigger_audit_log();

-- 12. View Financeira Profunda
CREATE OR REPLACE VIEW public.patient_financial_summary AS
SELECT 
    p.id AS patient_id,
    p.nome,
    COUNT(a.id) AS total_consultas,
    COUNT(a.id) FILTER (WHERE a.status = 'cancelada') AS qtd_cancelamentos,
    COUNT(a.id) FILTER (WHERE a.status = 'nao_compareceu') AS qtd_faltas,
    COALESCE(SUM(f.valor) FILTER (WHERE f.status = 'PAGO'), 0.00) AS total_pago,
    COALESCE(SUM(f.valor) FILTER (WHERE f.status = 'PENDENTE'), 0.00) AS total_em_aberto,
    COALESCE(AVG(f.valor) FILTER (WHERE f.status = 'PAGO'), 0.00) AS ticket_medio,
    MAX(a.data) FILTER (WHERE a.data <= CURRENT_DATE AND a.status IN ('concluida', 'faturada', 'paga')) AS ultima_consulta,
    MIN(a.data) FILTER (WHERE a.data > CURRENT_DATE AND a.status IN ('solicitada', 'confirmada', 'aguardando_aprovacao')) AS proxima_consulta
FROM public.patients p
LEFT JOIN public.appointments a ON a.patient_id = p.id
LEFT JOIN public.financial_transactions f ON f.patient_id = p.id
GROUP BY p.id;

-- 13. Otimizações de Busca
ALTER TABLE public.patients ADD COLUMN text_search tsvector 
GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(nome, '') || ' ' || coalesce(cpf, '') || ' ' || coalesce(email, ''))) STORED;
CREATE INDEX idx_patients_search ON public.patients USING GIN(text_search);
CREATE INDEX idx_patients_cpf ON public.patients(cpf);
CREATE INDEX idx_patients_email ON public.patients(email);
CREATE INDEX idx_patients_auth ON public.patients(auth_user_id);

-- RLS (Habilitação para todas as novas tabelas com a mesma regra padrão ADMIN = ALL, PROF = WHERE EXIST APPOINTMENT)
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinics open read" ON public.clinics FOR SELECT USING (true);
CREATE POLICY "Admin pac all" ON public.patients FOR ALL USING (public.is_admin());
CREATE POLICY "Recep pac all" ON public.patients FOR ALL USING (public.has_role('RECEPCIONISTA'));
CREATE POLICY "Prof pac select" ON public.patients FOR SELECT USING (EXISTS (SELECT 1 FROM public.appointments a WHERE a.patient_id = patients.id AND a.professional_id = public.get_current_professional_id()));
