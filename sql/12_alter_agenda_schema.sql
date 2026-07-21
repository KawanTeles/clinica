-- 12_alter_agenda_schema.sql
-- Etapa 8: Agenda Inteligente e Exceções Recorrentes

-- Nova tabela para Bloqueios Recorrentes / Exceções Complexas
CREATE TABLE agenda_excecoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profissional_id UUID REFERENCES profissionais(id) ON DELETE CASCADE, -- Se null, aplica-se a toda clínica (ex: Feriado)
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- 'SEMANAL', 'MENSAL_DIA_SEMANA', 'DATA_ESPECIFICA'
    parametro VARCHAR(255) NOT NULL, -- Ex: '6' (Sabado), '1-MON' (1a Seg), '2026-12-25'
    descricao VARCHAR(255),
    bloqueio_total BOOLEAN DEFAULT TRUE,
    hora_inicio TIME,
    hora_fim TIME,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger de data
CREATE TRIGGER update_agenda_excecoes_modtime 
BEFORE UPDATE ON agenda_excecoes 
FOR EACH ROW EXECUTE PROCEDURE update_atualizado_em();

-- Otimização
CREATE INDEX idx_agenda_excecoes_clinica ON agenda_excecoes(clinica_id);
CREATE INDEX idx_agenda_excecoes_prof ON agenda_excecoes(profissional_id);
