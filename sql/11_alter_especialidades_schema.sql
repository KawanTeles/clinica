-- 11_alter_especialidades_schema.sql
-- Etapa 7: Enriquecimento da Entidade Especialidades como Configuração Matriz

ALTER TABLE especialidades 
ADD COLUMN categoria VARCHAR(100),
ADD COLUMN status VARCHAR(50) DEFAULT 'Ativa',
ADD COLUMN icone VARCHAR(50) DEFAULT 'fas fa-stethoscope',
ADD COLUMN intervalo_recomendado INT DEFAULT 0, -- minutos
ADD COLUMN permite_retorno BOOLEAN DEFAULT FALSE,
ADD COLUMN tempo_retorno INT, -- dias para retorno
ADD COLUMN valor_vista NUMERIC(10,2),
ADD COLUMN valor_cartao NUMERIC(10,2),
ADD COLUMN valor_retorno NUMERIC(10,2),
ADD COLUMN valor_promocional NUMERIC(10,2),
ADD COLUMN comissao_padrao NUMERIC(10,2),
ADD COLUMN percentual_repasse NUMERIC(5,2),
ADD COLUMN deleted_at TIMESTAMPTZ,
ADD COLUMN atualizado_em TIMESTAMPTZ DEFAULT NOW();

-- Trigger para atualizar data
CREATE TRIGGER update_especialidades_modtime 
BEFORE UPDATE ON especialidades 
FOR EACH ROW EXECUTE PROCEDURE update_atualizado_em();

-- Otimização de Busca
CREATE INDEX idx_especialidades_clinica_status ON especialidades(clinica_id, status);
