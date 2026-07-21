-- 05_schema_crm.sql

CREATE TABLE crm_funil (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    ordem INT NOT NULL
);

CREATE TABLE crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE RESTRICT,
    funil_id UUID NOT NULL REFERENCES crm_funil(id) ON DELETE RESTRICT,
    nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    email VARCHAR(255),
    valor_potencial NUMERIC(10,2),
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE crm_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    nome VARCHAR(50) NOT NULL,
    cor VARCHAR(20) DEFAULT '#cccccc'
);

CREATE TABLE crm_lead_tags (
    lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES crm_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (lead_id, tag_id)
);

CREATE TABLE crm_observacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
    paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    texto TEXT NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crm_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
    paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
    acao VARCHAR(255) NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE anexos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    tipo VARCHAR(50),
    nome_arquivo VARCHAR(255),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    destinatario VARCHAR(255) NOT NULL,
    mensagem TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pendente',
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    enviado_em TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_crm_leads_clinica ON crm_leads(clinica_id);
CREATE INDEX idx_notificacoes_clinica ON notificacoes(clinica_id);
