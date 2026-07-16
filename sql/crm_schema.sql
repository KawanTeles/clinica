-- ═══════════════════════════════════════════════════════════════
--  Clínica Zoe — Evolução CRM (novas tabelas)
--  Execute no SQL Editor do Supabase. Cria apenas o que não existe.
--  Respeita 100% o schema atual (pacientes, agendamentos, profissionais).
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. PRONTUÁRIO (por profissional) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.prontuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE RESTRICT,
  historico_clinico TEXT,
  observacoes TEXT,
  anotacoes TEXT,
  medicamentos TEXT,
  alergias TEXT,
  exames TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (paciente_id, profissional_id)
);

-- ── 2. ANEXOS (arquivos do prontuário / paciente) ──────────────────
CREATE TABLE IF NOT EXISTS public.anexos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id UUID REFERENCES public.profissionais(id) ON DELETE SET NULL,
  nome_arquivo TEXT NOT NULL,
  url TEXT NOT NULL,
  tipo VARCHAR(50),
  tamanho BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── 3. HISTÓRICO / TIMELINE DO PACIENTE ────────────────────────────
CREATE TABLE IF NOT EXISTS public.historico_paciente (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL, -- agendou, confirmou, realizou, retorno, anexo, etc.
  descricao TEXT,
  profissional_id UUID REFERENCES public.profissionais(id) ON DELETE SET NULL,
  referencia_id UUID, -- id do agendamento / anexo relacionado
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── 4. FINANCEIRO (preparado, sem gateway) ────────────────────────
CREATE TYPE forma_pagamento AS ENUM ('pix', 'cartao', 'dinheiro', 'pendente');
CREATE TABLE IF NOT EXISTS public.financeiro (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  profissional_id UUID REFERENCES public.profissionais(id) ON DELETE SET NULL,
  descricao VARCHAR(255) NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente', -- pago | pendente | cancelado
  forma forma_pagamento DEFAULT 'pendente',
  data_vencimento DATE,
  data_pagamento DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── 5. LEADS / CRM DE PACIENTES ────────────────────────────────────
CREATE TYPE lead_status AS ENUM ('novo', 'recorrente', 'inativo', 'em_contato');
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  nome VARCHAR(150) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(100),
  origem VARCHAR(50) DEFAULT 'site', -- site, whatsapp, indicacao, etc.
  status lead_status DEFAULT 'novo',
  followup DATE,
  observacoes TEXT,
  profissional_id UUID REFERENCES public.profissionais(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── 6. MENSAGENS CENTRALIZADAS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mensagens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canal VARCHAR(20) NOT NULL DEFAULT 'whatsapp', -- whatsapp | email | notificacao
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  assunto VARCHAR(200),
  conteudo TEXT NOT NULL,
  direcao VARCHAR(10) DEFAULT 'enviada', -- enviada | recebida
  lida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── 7. CONFIGURAÇÕES DA CLÍNICA ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinic_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(150) DEFAULT 'Clínica Zoe',
  logo_url TEXT,
  telefone VARCHAR(20),
  whatsapp VARCHAR(20),
  email VARCHAR(100),
  endereco TEXT,
  horario_funcionamento TEXT,
  redes_sociais JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed inicial de configuração (apenas se vazia)
INSERT INTO public.clinic_config (nome, telefone, whatsapp, email, endereco)
SELECT 'Clínica Zoe', '(11) 99999-9999', '5511999999999', 'contato@clinicazoe.com', 'Av. Paulista, 1000 - São Paulo - SP'
WHERE NOT EXISTS (SELECT 1 FROM public.clinic_config);

-- ── 8. AUDITORIA / LOG DO SISTEMA ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auditoria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_email VARCHAR(150),
  acao VARCHAR(50) NOT NULL, -- login, editou, excluiu, confirmou, cancelou
  entidade VARCHAR(50), -- paciente, agendamento, profissional...
  entidade_id UUID,
  detalhes TEXT,
  ip VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── 9. BACKUP (registro informativo) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.backup_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo VARCHAR(30) DEFAULT 'automatico',
  status VARCHAR(20) DEFAULT 'concluido',
  tamanho_mb NUMERIC(10,2),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed informativo de último backup
INSERT INTO public.backup_log (tipo, status, observacoes)
SELECT 'incremental', 'concluido', 'Backup inicial do banco de dados.'
WHERE NOT EXISTS (SELECT 1 FROM public.backup_log);

-- ═══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY — expande o policies.sql existente
--  Mantém regras atuais e adiciona as novas tabelas.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.prontuarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anexos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_paciente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_log        ENABLE ROW LEVEL SECURITY;

-- Função helper: paciente pertence a um agendamento do profissional logado
CREATE OR REPLACE FUNCTION public.paciente_do_profissional(p_pid UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.agendamentos a
    WHERE a.paciente_id = p_pid AND a.profissional_id = public.my_professional_id()
  );
END;
$$ LANGUAGE plpgsql;

-- PRONTUÁRIOS: admin vê tudo; profissional vê apenas os seus
DROP POLICY IF EXISTS "prontuarios_select" ON public.prontuarios;
CREATE POLICY "prontuarios_select" ON public.prontuarios
  FOR SELECT USING (public.is_admin() OR profissional_id = public.my_professional_id());
DROP POLICY IF EXISTS "prontuarios_write" ON public.prontuarios;
CREATE POLICY "prontuarios_write" ON public.prontuarios
  FOR ALL USING (public.is_admin() OR profissional_id = public.my_professional_id());

-- ANEXOS
DROP POLICY IF EXISTS "anexos_select" ON public.anexos;
CREATE POLICY "anexos_select" ON public.anexos
  FOR SELECT USING (public.is_admin() OR profissional_id = public.my_professional_id() OR public.paciente_do_profissional(paciente_id));
DROP POLICY IF EXISTS "anexos_write" ON public.anexos;
CREATE POLICY "anexos_write" ON public.anexos
  FOR ALL USING (public.is_admin() OR profissional_id = public.my_professional_id());

-- HISTÓRICO
DROP POLICY IF EXISTS "historico_select" ON public.historico_paciente;
CREATE POLICY "historico_select" ON public.historico_paciente
  FOR SELECT USING (public.is_admin() OR profissional_id = public.my_professional_id() OR public.paciente_do_profissional(paciente_id));
DROP POLICY IF EXISTS "historico_write" ON public.historico_paciente;
CREATE POLICY "historico_write" ON public.historico_paciente
  FOR INSERT WITH CHECK (public.is_admin() OR profissional_id = public.my_professional_id());

-- FINANCEIRO
DROP POLICY IF EXISTS "financeiro_select" ON public.financeiro;
CREATE POLICY "financeiro_select" ON public.financeiro
  FOR SELECT USING (public.is_admin() OR profissional_id = public.my_professional_id());
DROP POLICY IF EXISTS "financeiro_write" ON public.financeiro;
CREATE POLICY "financeiro_write" ON public.financeiro
  FOR ALL USING (public.is_admin() OR profissional_id = public.my_professional_id());

-- LEADS
DROP POLICY IF EXISTS "leads_select" ON public.leads;
CREATE POLICY "leads_select" ON public.leads
  FOR SELECT USING (public.is_admin() OR profissional_id = public.my_professional_id());
DROP POLICY IF EXISTS "leads_write" ON public.leads;
CREATE POLICY "leads_write" ON public.leads
  FOR ALL USING (public.is_admin() OR profissional_id = public.my_professional_id());

-- MENSAGENS
DROP POLICY IF EXISTS "mensagens_select" ON public.mensagens;
CREATE POLICY "mensagens_select" ON public.mensagens
  FOR SELECT USING (public.is_admin() OR profissional_id = public.my_professional_id());
DROP POLICY IF EXISTS "mensagens_write" ON public.mensagens;
CREATE POLICY "mensagens_write" ON public.mensagens
  FOR ALL USING (public.is_admin() OR profissional_id = public.my_professional_id());

-- CLINIC_CONFIG: todos leem; só admin escreve
DROP POLICY IF EXISTS "clinic_config_select" ON public.clinic_config;
CREATE POLICY "clinic_config_select" ON public.clinic_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "clinic_config_write" ON public.clinic_config;
CREATE POLICY "clinic_config_write" ON public.clinic_config FOR ALL USING (public.is_admin());

-- AUDITORIA: todos leem; só admin escreve
DROP POLICY IF EXISTS "auditoria_select" ON public.auditoria;
CREATE POLICY "auditoria_select" ON public.auditoria FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "auditoria_insert" ON public.auditoria;
CREATE POLICY "auditoria_insert" ON public.auditoria FOR INSERT WITH CHECK (true);

-- BACKUP_LOG: todos leem; só admin escreve
DROP POLICY IF EXISTS "backup_log_select" ON public.backup_log;
CREATE POLICY "backup_log_select" ON public.backup_log FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "backup_log_write" ON public.backup_log;
CREATE POLICY "backup_log_write" ON public.backup_log FOR ALL USING (public.is_admin());
