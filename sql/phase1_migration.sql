-- ═══════════════════════════════════════════════════════════════
--  Clínica Zoe — FASE 1: Banco de Dados e Segurança (Migration)
--  Arquivo: sql/phase1_migration.sql
--
--  PROPÓSITO:
--   Criar APENAS novas tabelas de CRM/gestão clínica.
--   NÃO altera nenhuma tabela existente (pacientes, agendamentos,
--   profissionais, especialidades, etc.).
--
--  COMPATIBILIDADE:
--   Este script é idempotente (CREATE TABLE IF NOT EXISTS + ADD COLUMN
--   IF NOT EXISTS). Ele reconcilia o schema da Fase 1 com o modelo já
--   utilizado pelos módulos JS construídos (sql/crm_schema.sql),
--   adicionando os campos nominais pedidos na Fase 1 como colunas
--   complementares — sem remover nada que o código já usa.
--
--  ORDEM DE EXECUÇÃO NO SUPABASE:
--   1) sql/database.sql
--   2) sql/policies.sql
--   3) sql/crm_schema.sql   (modelo dos módulos)
--   4) sql/phase1_migration.sql  (este arquivo — reforça campos Fase 1)
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════
--  1. PRONTUÁRIOS
--  Fase 1 pede: observacoes, diagnostico, anexos
--  Já existe (crm_schema.sql): historico_clinico, anotacoes,
--    medicamentos, alergias, exames
--  → Garantimos as colunas da Fase 1 como complementares.
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='prontuarios'
  ) THEN
    CREATE TABLE public.prontuarios (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
      profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE RESTRICT,
      historico_clinico TEXT,
      observacoes TEXT,
      anotacoes TEXT,
      medicamentos TEXT,
      alergias TEXT,
      exames TEXT,
      diagnostico TEXT,
      anexos TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (paciente_id, profissional_id)
    );
  ELSE
    ALTER TABLE public.prontuarios
      ADD COLUMN IF NOT EXISTS diagnostico TEXT,
      ADD COLUMN IF NOT EXISTS anexos TEXT,
      ADD COLUMN IF NOT EXISTS observacoes TEXT;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
--  2. FINANCEIRO
--  Fase 1 pede: tipo, descricao, valor, status, vencimento
--  Já existe (crm_schema.sql): descricao, valor, status, forma,
--    data_vencimento, agendamento_id, profissional_id
--  → Mapeamos tipo = forma; vencimento = data_vencimento.
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='financeiro'
  ) THEN
    CREATE TABLE public.financeiro (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
      agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
      profissional_id UUID REFERENCES public.profissionais(id) ON DELETE SET NULL,
      tipo VARCHAR(30) DEFAULT 'receita',
      descricao VARCHAR(255) NOT NULL,
      valor NUMERIC(10,2) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'pendente',
      forma forma_pagamento DEFAULT 'pendente',
      vencimento DATE,
      data_vencimento DATE,
      data_pagamento DATE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  ELSE
    ALTER TABLE public.financeiro
      ADD COLUMN IF NOT EXISTS tipo VARCHAR(30) DEFAULT 'receita',
      ADD COLUMN IF NOT EXISTS vencimento DATE;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
--  3. LEADS
--  Fase 1 pede: ultimo_contato, proximo_followup
--  Já existe (crm_schema.sql): followup, observacoes, origem, status
--  → Mapeamos proximo_followup = followup.
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='leads'
  ) THEN
    CREATE TABLE public.leads (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
      nome VARCHAR(150) NOT NULL,
      telefone VARCHAR(20),
      email VARCHAR(100),
      origem VARCHAR(50) DEFAULT 'site',
      status lead_status DEFAULT 'novo',
      ultimo_contato DATE,
      proximo_followup DATE,
      followup DATE,
      observacoes TEXT,
      profissional_id UUID REFERENCES public.profissionais(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  ELSE
    ALTER TABLE public.leads
      ADD COLUMN IF NOT EXISTS ultimo_contato DATE,
      ADD COLUMN IF NOT EXISTS proximo_followup DATE;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
--  4. AUDITORIA
--  Fase 1 pede: usuario, acao, tabela, registro_id,
--    dados_antigos, dados_novos
--  Já existe (crm_schema.sql): usuario_email, entidade, entidade_id,
--    detalhes
--  → Adicionamos os campos nominais da Fase 1 como complementares.
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='auditoria'
  ) THEN
    CREATE TABLE public.auditoria (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      usuario_email VARCHAR(150),
      usuario VARCHAR(150),
      acao VARCHAR(50) NOT NULL,
      entidade VARCHAR(50),
      tabela VARCHAR(50),
      entidade_id UUID,
      registro_id UUID,
      detalhes TEXT,
      dados_antigos JSONB,
      dados_novos JSONB,
      ip VARCHAR(45),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  ELSE
    ALTER TABLE public.auditoria
      ADD COLUMN IF NOT EXISTS usuario VARCHAR(150),
      ADD COLUMN IF NOT EXISTS tabela VARCHAR(50),
      ADD COLUMN IF NOT EXISTS registro_id UUID,
      ADD COLUMN IF NOT EXISTS dados_antigos JSONB,
      ADD COLUMN IF NOT EXISTS dados_novos JSONB;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
--  5. CLINIC_CONFIG
--  Fase 1 pede: nome_clinica, telefone, endereco, configuracoes_json
--  Já existe (crm_schema.sql): nome, telefone, endereco, whatsapp,
--    email, redes_sociais, horario_funcionamento
--  → Adicionamos os campos nominais da Fase 1 como complementares.
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='clinic_config'
  ) THEN
    CREATE TABLE public.clinic_config (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      nome VARCHAR(150) DEFAULT 'Clínica Zoe',
      nome_clinica VARCHAR(150) DEFAULT 'Clínica Zoe',
      logo_url TEXT,
      telefone VARCHAR(20),
      whatsapp VARCHAR(20),
      email VARCHAR(100),
      endereco TEXT,
      horario_funcionamento TEXT,
      redes_sociais JSONB DEFAULT '{}'::jsonb,
      configuracoes_json JSONB DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  ELSE
    ALTER TABLE public.clinic_config
      ADD COLUMN IF NOT EXISTS nome_clinica VARCHAR(150) DEFAULT 'Clínica Zoe',
      ADD COLUMN IF NOT EXISTS configuracoes_json JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Seed inicial de configuração (apenas se vazia)
INSERT INTO public.clinic_config (nome, nome_clinica, telefone, whatsapp, email, endereco)
SELECT 'Clínica Zoe', 'Clínica Zoe', '(11) 99999-9999', '5511999999999', 'contato@clinicazoe.com', 'Av. Paulista, 1000 - São Paulo - SP'
WHERE NOT EXISTS (SELECT 1 FROM public.clinic_config);

-- ═══════════════════════════════════════════════════════════════
--  6. HISTÓRICO
--  Fase 1 pede: paciente_id, tipo_evento, descricao
--  Já existe (crm_schema.sql): historico_paciente (tipo, descricao,
--    profissional_id, referencia_id)
--  → Criamos a tabela 'historico' complementar pedida na Fase 1.
--  Mantemos historico_paciente (usado pelos módulos JS).
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.historico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE,
  tipo_evento VARCHAR(50) NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Gatilho para manter prontuarios.updated_at atualizado
CREATE OR REPLACE FUNCTION public.touch_prontuario()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_prontuario ON public.prontuarios;
CREATE TRIGGER trg_touch_prontuario
  BEFORE UPDATE ON public.prontuarios
  FOR EACH ROW EXECUTE FUNCTION public.touch_prontuario();

-- ═══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
--  Admin: acesso completo.
--  Profissional: acesso somente aos dados permitidos (vinculados a ele).
--  Não autenticado: sem acesso.
--  Reutiliza as funções helper já definidas em policies.sql:
--    public.is_admin(), public.my_professional_id(), public.is_professional()
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.prontuarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_paciente ENABLE ROW LEVEL SECURITY;

-- Função helper: paciente tem agendamento com o profissional logado
CREATE OR REPLACE FUNCTION public.paciente_do_profissional(p_pid UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.agendamentos a
    WHERE a.paciente_id = p_pid AND a.profissional_id = public.my_professional_id()
  );
END;
$$ LANGUAGE plpgsql;

-- ── PRONTUÁRIOS ──
DROP POLICY IF EXISTS "prontuarios_select" ON public.prontuarios;
CREATE POLICY "prontuarios_select" ON public.prontuarios
  FOR SELECT USING (public.is_admin() OR profissional_id = public.my_professional_id());
DROP POLICY IF EXISTS "prontuarios_write" ON public.prontuarios;
CREATE POLICY "prontuarios_write" ON public.prontuarios
  FOR ALL USING (public.is_admin() OR profissional_id = public.my_professional_id());

-- ── FINANCEIRO ──
DROP POLICY IF EXISTS "financeiro_select" ON public.financeiro;
CREATE POLICY "financeiro_select" ON public.financeiro
  FOR SELECT USING (public.is_admin() OR profissional_id = public.my_professional_id());
DROP POLICY IF EXISTS "financeiro_write" ON public.financeiro;
CREATE POLICY "financeiro_write" ON public.financeiro
  FOR ALL USING (public.is_admin() OR profissional_id = public.my_professional_id());

-- ── LEADS ──
DROP POLICY IF EXISTS "leads_select" ON public.leads;
CREATE POLICY "leads_select" ON public.leads
  FOR SELECT USING (public.is_admin() OR profissional_id = public.my_professional_id());
DROP POLICY IF EXISTS "leads_write" ON public.leads;
CREATE POLICY "leads_write" ON public.leads
  FOR ALL USING (public.is_admin() OR profissional_id = public.my_professional_id());

-- ── AUDITORIA ── (admin lê tudo; qualquer autenticado pode inserir log)
DROP POLICY IF EXISTS "auditoria_select" ON public.auditoria;
CREATE POLICY "auditoria_select" ON public.auditoria FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "auditoria_insert" ON public.auditoria;
CREATE POLICY "auditoria_insert" ON public.auditoria FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── CLINIC_CONFIG ── (todos leem; só admin escreve)
DROP POLICY IF EXISTS "clinic_config_select" ON public.clinic_config;
CREATE POLICY "clinic_config_select" ON public.clinic_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "clinic_config_write" ON public.clinic_config;
CREATE POLICY "clinic_config_write" ON public.clinic_config FOR ALL USING (public.is_admin());

-- ── HISTORICO ──
DROP POLICY IF EXISTS "historico_select" ON public.historico;
CREATE POLICY "historico_select" ON public.historico
  FOR SELECT USING (public.is_admin() OR public.paciente_do_profissional(paciente_id));
DROP POLICY IF EXISTS "historico_write" ON public.historico;
CREATE POLICY "historico_write" ON public.historico
  FOR ALL USING (public.is_admin() OR public.paciente_do_profissional(paciente_id));

-- ── HISTORICO_PACIENTE (usado pelos módulos) ──
DROP POLICY IF EXISTS "historico_paciente_select" ON public.historico_paciente;
CREATE POLICY "historico_paciente_select" ON public.historico_paciente
  FOR SELECT USING (public.is_admin() OR profissional_id = public.my_professional_id() OR public.paciente_do_profissional(paciente_id));
DROP POLICY IF EXISTS "historico_paciente_write" ON public.historico_paciente;
CREATE POLICY "historico_paciente_write" ON public.historico_paciente
  FOR INSERT WITH CHECK (public.is_admin() OR profissional_id = public.my_professional_id());
