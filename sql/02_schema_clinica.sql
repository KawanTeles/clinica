-- 02_schema_clinica.sql

CREATE TABLE pacientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE RESTRICT,
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(20),
    data_nascimento DATE,
    telefone VARCHAR(20),
    email VARCHAR(255),
    endereco TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE profissionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE RESTRICT,
    registro_conselho VARCHAR(50),
    valor_consulta NUMERIC(10, 2),
    pix VARCHAR(255),
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE especialidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    cor_agenda VARCHAR(20) DEFAULT '#000000',
    tempo_padrao INT DEFAULT 60
);

CREATE TABLE profissional_especialidade (
    profissional_id UUID REFERENCES profissionais(id) ON DELETE CASCADE,
    especialidade_id UUID REFERENCES especialidades(id) ON DELETE CASCADE,
    valor_vista NUMERIC(10,2),
    valor_cartao NUMERIC(10,2),
    PRIMARY KEY (profissional_id, especialidade_id)
);

-- Índices
CREATE INDEX idx_pacientes_clinica ON pacientes(clinica_id);
CREATE INDEX idx_profissionais_clinica ON profissionais(clinica_id);
CREATE INDEX idx_pacientes_email ON pacientes(email);
