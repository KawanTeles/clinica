-- 13_schema_notificacoes.sql
-- Etapa 10: Integração com WhatsApp (Notification Engine)

-- LGPD Consentimento de Pacientes
CREATE TABLE pacientes_consentimento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    aceita_whatsapp BOOLEAN DEFAULT FALSE,
    aceita_email BOOLEAN DEFAULT FALSE,
    aceita_sms BOOLEAN DEFAULT FALSE,
    data_aceite TIMESTAMPTZ DEFAULT NOW(),
    ip_origem VARCHAR(50),
    UNIQUE(paciente_id)
);

-- Templates de Mensagens
CREATE TABLE notificacoes_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL, -- Ex: 'consulta_confirmada'
    canal VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP', -- WHATSAPP, EMAIL, SMS
    conteudo TEXT NOT NULL, -- Contém variáveis como {{paciente}}, {{data}}
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinica_id, nome, canal)
);

-- Fila de Notificações
CREATE TABLE notificacoes_fila (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    paciente_id UUID REFERENCES pacientes(id) ON DELETE SET NULL,
    profissional_id UUID REFERENCES profissionais(id) ON DELETE SET NULL,
    consulta_id UUID REFERENCES consultas(id) ON DELETE SET NULL,
    canal VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP',
    template_nome VARCHAR(100),
    destinatario VARCHAR(100) NOT NULL,
    conteudo TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDENTE', -- PENDENTE, ENVIANDO, ENVIADA, FALHA
    tentativas INT DEFAULT 0,
    max_tentativas INT DEFAULT 3,
    erro_mensagem TEXT,
    provedor_usado VARCHAR(50), -- Ex: 'meta_cloud', 'evolution'
    agendado_para TIMESTAMPTZ DEFAULT NOW(),
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de Otimização
CREATE INDEX idx_notificacoes_fila_clinica ON notificacoes_fila(clinica_id);
CREATE INDEX idx_notificacoes_fila_status ON notificacoes_fila(status) WHERE status IN ('PENDENTE', 'FALHA');
CREATE INDEX idx_notificacoes_fila_consulta ON notificacoes_fila(consulta_id);

-- Triggers de atualização
CREATE TRIGGER update_notificacoes_templates_modtime 
BEFORE UPDATE ON notificacoes_templates 
FOR EACH ROW EXECUTE PROCEDURE update_atualizado_em();

CREATE TRIGGER update_notificacoes_fila_modtime 
BEFORE UPDATE ON notificacoes_fila 
FOR EACH ROW EXECUTE PROCEDURE update_atualizado_em();

-- Inserir permissões básicas para o módulo (Pode ser ajustado)
INSERT INTO permissoes (slug, descricao) VALUES 
('notificacoes.visualizar', 'Pode visualizar fila de notificações e configurações de envio'),
('notificacoes.gerenciar', 'Pode gerenciar templates e reenviar mensagens')
ON CONFLICT DO NOTHING;
