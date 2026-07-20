-- 06_schema_auditoria.sql

CREATE TABLE auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID,
    tabela VARCHAR(100) NOT NULL,
    operacao VARCHAR(20) NOT NULL,
    registro_id UUID,
    valor_anterior JSONB,
    valor_novo JSONB,
    ip VARCHAR(50),
    dispositivo TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para log
CREATE INDEX idx_auditoria_tabela ON auditoria(tabela);
CREATE INDEX idx_auditoria_registro ON auditoria(registro_id);
