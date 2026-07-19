-- Migração: Adição dos Módulos CRM Médico (PEP), Financeiro e Auditoria
-- Data: 2026-07-18
-- Objetivo: Refinamentos da arquitetura (Auditoria, Histórico, Preços Complexos, Cancelamentos)
-- Modelo: Single-Tenant (Clínica Zoe) - Preparado para evolução futura.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════
-- 1. TABELA DE AUDITORIA (AUDIT LOGS)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tabela VARCHAR(100) NOT NULL,
    registro_id UUID NOT NULL,
    acao VARCHAR(10) NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE')),
    dados_antigos JSONB,
    dados_novos JSONB,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tabela ON public.audit_logs(tabela);
CREATE INDEX IF NOT EXISTS idx_audit_logs_registro ON public.audit_logs(registro_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_admin_only" ON public.audit_logs FOR SELECT USING (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- 2. TABELA DE PREÇOS E DURAÇÃO DE CONSULTAS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tabela_precos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profissional_id UUID REFERENCES public.profissionais(id) ON DELETE CASCADE,
    especialidade_id UUID REFERENCES public.especialidades(id) ON DELETE CASCADE,
    valor_pix DECIMAL(10,2) NOT NULL CHECK (valor_pix >= 0),
    valor_dinheiro DECIMAL(10,2) NOT NULL CHECK (valor_dinheiro >= 0),
    valor_debito DECIMAL(10,2) NOT NULL CHECK (valor_debito >= 0),
    valor_credito DECIMAL(10,2) NOT NULL CHECK (valor_credito >= 0),
    max_parcelas INTEGER DEFAULT 1 NOT NULL CHECK (max_parcelas >= 1),
    duracao_consulta_minutos INTEGER DEFAULT 60 NOT NULL CHECK (duracao_consulta_minutos >= 15),
    duracao_retorno_minutos INTEGER DEFAULT 30 NOT NULL CHECK (duracao_retorno_minutos >= 10),
    ativo BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_preco_regra UNIQUE NULLS NOT DISTINCT (profissional_id, especialidade_id)
);

ALTER TABLE public.tabela_precos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tabela_precos_select" ON public.tabela_precos FOR SELECT USING (true);
CREATE POLICY "tabela_precos_write" ON public.tabela_precos FOR ALL USING (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- 3. EVOLUÇÃO DE PACIENTES E AGENDAMENTOS
-- ═══════════════════════════════════════════════════════════════

-- Status e contatos de emergência para Pacientes
ALTER TABLE public.pacientes 
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Em Tratamento', 'Alta', 'Inativo')),
  ADD COLUMN IF NOT EXISTS contato_emergencia_nome VARCHAR(150),
  ADD COLUMN IF NOT EXISTS contato_emergencia_telefone VARCHAR(20);

-- Detalhamento de Cancelamento e Remarcação em Agendamentos
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS horario_fim TIME, -- Para bloquear apenas o intervalo da consulta, não o dia todo
  ADD COLUMN IF NOT EXISTS agendamento_original_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL, -- Rastreabilidade de remarcação
  ADD COLUMN IF NOT EXISTS motivo_cancelamento VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cancelado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS observacoes_cancelamento TEXT;

-- Ajuste de Enumeração do Status de Agendamento (se necessário, garantindo estados de fluxo aprovação)
-- O PostgreSQL não permite alterar ENUM facilmente com ADD VALUE dentro de transações de forma simples,
-- Mas assumimos que os estados lógicos via VARCHAR ou controle na aplicação contemplam: Solicitado -> Aprovado -> Confirmado.

-- Histórico Imutável do Agendamento (Timeline da Consulta)
CREATE TABLE IF NOT EXISTS public.agendamentos_historico (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
    tipo_evento VARCHAR(50) NOT NULL CHECK (tipo_evento IN ('Solicitado', 'Aprovado', 'Recusado', 'Confirmado', 'Remarcado', 'Cancelado', 'Finalizado')),
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Quem fez a alteração
    detalhes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_hist_agend_id ON public.agendamentos_historico(agendamento_id);
ALTER TABLE public.agendamentos_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agendamentos_hist_select" ON public.agendamentos_historico FOR SELECT USING (public.is_admin() OR public.is_professional());


-- ═══════════════════════════════════════════════════════════════
-- 4. MÓDULO CRM (PRONTUÁRIOS, ANEXOS E FOLLOW-UP)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.prontuarios_registros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE RESTRICT,
    agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
    tipo_registro VARCHAR(50) NOT NULL CHECK (tipo_registro IN ('Anamnese', 'Evolução', 'Receita', 'Exame', 'Atestado', 'Nota Interna')),
    cid VARCHAR(10), 
    tags TEXT[], 
    conteudo TEXT NOT NULL,
    data_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_edited BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE 
);

CREATE TABLE IF NOT EXISTS public.prontuarios_anexos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registro_id UUID REFERENCES public.prontuarios_registros(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE RESTRICT,
    nome_arquivo VARCHAR(255) NOT NULL,
    arquivo_url TEXT NOT NULL, 
    tipo_arquivo VARCHAR(50) NOT NULL,
    tamanho_bytes BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de Follow-up / Lembretes CRM
CREATE TABLE IF NOT EXISTS public.crm_lembretes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    profissional_id UUID REFERENCES public.profissionais(id) ON DELETE SET NULL,
    descricao TEXT NOT NULL,
    data_lembrete TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Concluído', 'Cancelado')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crm_lembretes_paciente ON public.crm_lembretes(paciente_id);
ALTER TABLE public.crm_lembretes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_lembretes_select" ON public.crm_lembretes FOR SELECT USING (public.is_admin() OR public.is_professional());
CREATE POLICY "crm_lembretes_write" ON public.crm_lembretes FOR ALL USING (public.is_admin() OR (public.is_professional() AND profissional_id = public.my_professional_id()));

-- Políticas CRM Principais
ALTER TABLE public.prontuarios_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prontuarios_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prontuarios_select_admin" ON public.prontuarios_registros FOR ALL USING (public.is_admin());
CREATE POLICY "anexos_select_admin" ON public.prontuarios_anexos FOR ALL USING (public.is_admin());
CREATE POLICY "prontuarios_select_prof" ON public.prontuarios_registros FOR SELECT USING (public.is_professional() AND deleted_at IS NULL);
CREATE POLICY "prontuarios_write_prof" ON public.prontuarios_registros FOR ALL USING (public.is_professional() AND profissional_id = public.my_professional_id());


-- ═══════════════════════════════════════════════════════════════
-- 5. MÓDULO FINANCEIRO
-- ═══════════════════════════════════════════════════════════════

-- Em Aberto (Gerado, aguardando), Pago, Parcial, Atrasado, Cancelado, Estornado
CREATE TYPE transacao_status AS ENUM ('Em Aberto', 'Pago', 'Parcial', 'Atrasado', 'Cancelado', 'Estornado');

CREATE TABLE IF NOT EXISTS public.transacoes_financeiras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
    profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE RESTRICT,
    especialidade_id UUID REFERENCES public.especialidades(id) ON DELETE SET NULL,
    descricao VARCHAR(255) NOT NULL,
    valor_base DECIMAL(10,2) NOT NULL CHECK (valor_base >= 0),
    desconto DECIMAL(10,2) DEFAULT 0 NOT NULL CHECK (desconto >= 0),
    valor_final DECIMAL(10,2) NOT NULL CHECK (valor_final >= 0),
    status transacao_status DEFAULT 'Em Aberto'::transacao_status NOT NULL,
    metodo_pagamento VARCHAR(50), 
    data_vencimento DATE NOT NULL,
    data_pagamento TIMESTAMP WITH TIME ZONE,
    gateway_id VARCHAR(255), 
    gateway_link TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_agendamento_transacao UNIQUE (agendamento_id)
);

CREATE INDEX IF NOT EXISTS idx_transacoes_status ON public.transacoes_financeiras(status);
ALTER TABLE public.transacoes_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transacoes_all_admin" ON public.transacoes_financeiras FOR ALL USING (public.is_admin());
CREATE POLICY "transacoes_select_paciente" ON public.transacoes_financeiras FOR SELECT USING (auth.role() = 'authenticated' AND paciente_id = (SELECT id FROM public.pacientes WHERE email = auth.email() LIMIT 1));


-- ═══════════════════════════════════════════════════════════════
-- 6. TRIGGERS AUTOMÁTICOS
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_modified_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_tabela_precos BEFORE UPDATE ON public.tabela_precos FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();
CREATE TRIGGER set_updated_at_prontuarios BEFORE UPDATE ON public.prontuarios_registros FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();
CREATE TRIGGER set_updated_at_transacoes BEFORE UPDATE ON public.transacoes_financeiras FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();
CREATE TRIGGER set_updated_at_lembretes BEFORE UPDATE ON public.crm_lembretes FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

-- Gatilho Genérico de Auditoria
CREATE OR REPLACE FUNCTION public.audit_trigger_func() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (tabela, registro_id, acao, dados_antigos, usuario_id)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::jsonb, auth.uid());
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (tabela, registro_id, acao, dados_antigos, dados_novos, usuario_id)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid());
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (tabela, registro_id, acao, dados_novos, usuario_id)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW)::jsonb, auth.uid());
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Aplica auditoria em tabelas sensíveis
CREATE TRIGGER audit_prontuarios AFTER INSERT OR UPDATE OR DELETE ON public.prontuarios_registros FOR EACH ROW EXECUTE PROCEDURE public.audit_trigger_func();
CREATE TRIGGER audit_financeiro AFTER INSERT OR UPDATE OR DELETE ON public.transacoes_financeiras FOR EACH ROW EXECUTE PROCEDURE public.audit_trigger_func();
CREATE TRIGGER audit_agendamentos AFTER INSERT OR UPDATE OR DELETE ON public.agendamentos FOR EACH ROW EXECUTE PROCEDURE public.audit_trigger_func();
