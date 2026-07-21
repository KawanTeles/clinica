-- 03_schema_agenda.sql

CREATE TABLE agenda_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    dia_semana INT NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    intervalo_inicio TIME,
    intervalo_fim TIME
);

CREATE TABLE agenda_bloqueios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    data_inicio TIMESTAMPTZ NOT NULL,
    data_fim TIMESTAMPTZ NOT NULL,
    motivo VARCHAR(255)
);

CREATE TABLE agenda_disponibilidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    ocupado BOOLEAN DEFAULT FALSE
);

CREATE TABLE status_consulta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE consultas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE RESTRICT,
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
    profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE RESTRICT,
    especialidade_id UUID NOT NULL REFERENCES especialidades(id) ON DELETE RESTRICT,
    status_id UUID NOT NULL REFERENCES status_consulta(id) ON DELETE RESTRICT,
    data_consulta DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    observacoes TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
    -- Para ativar exclusão de horários concorrentes (precisa btree_gist carregado)
    -- EXCLUDE USING gist (
    --    profissional_id WITH =,
    --    data_consulta WITH =,
    --    tsrange(
    --        data_consulta + hora_inicio,
    --        data_consulta + hora_fim
    --    ) WITH &&
    -- ) WHERE (deleted_at IS NULL AND status_id NOT IN (SELECT id FROM status_consulta WHERE nome IN ('Cancelada', 'Recusada', 'Não compareceu')))
);

-- Índices
CREATE INDEX idx_consultas_clinica ON consultas(clinica_id);
CREATE INDEX idx_consultas_paciente ON consultas(paciente_id);
CREATE INDEX idx_consultas_profissional ON consultas(profissional_id);
CREATE INDEX idx_consultas_data ON consultas(data_consulta);
