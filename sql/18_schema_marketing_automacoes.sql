-- 18_schema_marketing_automacoes.sql
-- Etapa 15 e 16: Marketing e Automações

-- 1. Templates de Marketing
CREATE TABLE marketing_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'WHATSAPP', -- WHATSAPP, EMAIL, SMS
    categoria VARCHAR(50), -- Lembrete, Aniversário, Promocional, Retorno
    conteudo TEXT NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_mkt_templates_modtime 
BEFORE UPDATE ON marketing_templates 
FOR EACH ROW EXECUTE PROCEDURE update_atualizado_em();

-- 2. Campanhas de Marketing
CREATE TABLE marketing_campanhas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    nome VARCHAR(150) NOT NULL,
    objetivo VARCHAR(100),
    template_id UUID REFERENCES marketing_templates(id),
    filtro_publico JSONB, -- Critérios de segmentação salvos (ex: { status: 'Ativo', tags: ['VIP'] })
    status VARCHAR(50) DEFAULT 'RASCUNHO', -- RASCUNHO, AGENDADA, EM_EXECUCAO, PAUSADA, CONCLUIDA
    data_agendamento TIMESTAMPTZ,
    criado_por UUID REFERENCES usuarios(id),
    total_disparos INT DEFAULT 0,
    total_falhas INT DEFAULT 0,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_mkt_campanhas_modtime 
BEFORE UPDATE ON marketing_campanhas 
FOR EACH ROW EXECUTE PROCEDURE update_atualizado_em();

-- O Histórico de Envios já existe na tabela `notificacoes_fila` (Etapa 10), vamos adicionar um vinculo
ALTER TABLE notificacoes_fila 
ADD COLUMN campanha_id UUID REFERENCES marketing_campanhas(id) ON DELETE SET NULL;

-- 3. Motor de Automações (Event-Driven)
CREATE TABLE automacoes_regras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    evento_gatilho VARCHAR(100) NOT NULL, -- CONSULTA_APROVADA, NOVO_LEAD, PAGAMENTO_RECEBIDO, ANIVERSARIO
    condicoes JSONB, -- Condições extras (ex: valor > 100)
    acao_tipo VARCHAR(50) NOT NULL, -- ENVIAR_MENSAGEM, CRIAR_TAREFA, MOVER_LEAD
    acao_payload JSONB NOT NULL, -- Dados da ação (ex: template_id para mensagens)
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Permissões
INSERT INTO permissoes (slug, descricao) VALUES 
('marketing.gerenciar', 'Pode criar e enviar campanhas de marketing'),
('automacoes.gerenciar', 'Pode configurar regras de automação')
ON CONFLICT DO NOTHING;
