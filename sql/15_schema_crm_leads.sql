-- 15_schema_crm_leads.sql
-- Etapa 12: CRM (Pacientes, Leads, Funil e Histórico)

-- 1. Enriquecer Tabela de Pacientes (Evitar duplicação)
ALTER TABLE pacientes 
ADD COLUMN origem VARCHAR(100), -- Instagram, Google, Indicação, etc
ADD COLUMN tags TEXT[], -- Array de tags: ['VIP', 'Retorno']
ADD COLUMN score INT DEFAULT 100, -- Score do paciente baseado em engajamento/faltas
ADD COLUMN sexo VARCHAR(20);

-- 2. Tabela de Leads (Funil Kanban)
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Novo Lead', -- Novo Lead, Primeiro Contato, Em Negociação, Agendamento Solicitado, Convertido, Perdido
    origem VARCHAR(100),
    especialidade_interesse UUID REFERENCES especialidades(id) ON DELETE SET NULL,
    responsavel_id UUID REFERENCES profissionais(id) ON DELETE SET NULL, -- Quem está atendendo
    proxima_acao TEXT,
    data_prevista TIMESTAMPTZ,
    paciente_convertido_id UUID REFERENCES pacientes(id) ON DELETE SET NULL, -- Preenchido após conversão
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER update_leads_modtime 
BEFORE UPDATE ON leads 
FOR EACH ROW EXECUTE PROCEDURE update_atualizado_em();

CREATE INDEX idx_leads_clinica ON leads(clinica_id);
CREATE INDEX idx_leads_status ON leads(status);

-- 3. Observações Internas de Pacientes (Privado)
CREATE TABLE pacientes_observacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    autor_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    conteudo TEXT NOT NULL,
    fixado BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_pacientes_observacoes_modtime 
BEFORE UPDATE ON pacientes_observacoes 
FOR EACH ROW EXECUTE PROCEDURE update_atualizado_em();

CREATE INDEX idx_pacientes_obs ON pacientes_observacoes(paciente_id);

-- 4. Permissões de Leads
INSERT INTO permissoes (slug, descricao) VALUES 
('leads.visualizar', 'Pode visualizar funil de leads'),
('leads.gerenciar', 'Pode editar, criar e mover leads no funil')
ON CONFLICT DO NOTHING;
