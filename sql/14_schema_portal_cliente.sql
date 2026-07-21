-- 14_schema_portal_cliente.sql
-- Etapa 11: Área do Cliente

-- Tokens de Acesso Seguro (Magic Link)
CREATE TABLE portal_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expira_em TIMESTAMPTZ NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_portal_tokens_hash ON portal_tokens(token);
CREATE INDEX idx_portal_tokens_paciente ON portal_tokens(paciente_id);

-- Preparação para Documentos (Futuro)
CREATE TABLE paciente_documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    consulta_id UUID REFERENCES consultas(id) ON DELETE SET NULL, -- Se atrelado a uma consulta
    tipo VARCHAR(50) NOT NULL, -- 'RECEITA', 'EXAME', 'TERMO', 'RECIBO'
    nome_arquivo VARCHAR(255) NOT NULL,
    url_arquivo TEXT NOT NULL,
    tamanho_bytes INT,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_paciente_documentos_modtime 
BEFORE UPDATE ON paciente_documentos 
FOR EACH ROW EXECUTE PROCEDURE update_atualizado_em();

-- O paciente_consentimento (criado na Etapa 10) será manipulável pelo portal.
