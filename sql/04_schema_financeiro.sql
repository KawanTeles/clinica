-- 04_schema_financeiro.sql

CREATE TABLE formas_pagamento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE financeiro (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE RESTRICT,
    paciente_id UUID REFERENCES pacientes(id) ON DELETE RESTRICT,
    profissional_id UUID REFERENCES profissionais(id) ON DELETE RESTRICT,
    consulta_id UUID REFERENCES consultas(id) ON DELETE SET NULL,
    valor_total NUMERIC(10,2) NOT NULL,
    desconto NUMERIC(10,2) DEFAULT 0,
    acrescimo NUMERIC(10,2) DEFAULT 0,
    data_vencimento DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Em aberto',
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE pagamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financeiro_id UUID NOT NULL REFERENCES financeiro(id) ON DELETE RESTRICT,
    forma_pagamento_id UUID NOT NULL REFERENCES formas_pagamento(id) ON DELETE RESTRICT,
    valor_pago NUMERIC(10,2) NOT NULL,
    data_pagamento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    comprovante_url TEXT
);

CREATE TABLE financeiro_movimentacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financeiro_id UUID NOT NULL REFERENCES financeiro(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    acao VARCHAR(255) NOT NULL,
    valor_anterior NUMERIC(10,2),
    valor_novo NUMERIC(10,2),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_financeiro_clinica ON financeiro(clinica_id);
CREATE INDEX idx_financeiro_paciente ON financeiro(paciente_id);
CREATE INDEX idx_financeiro_status ON financeiro(status);
