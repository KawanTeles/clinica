-- 16_schema_erp_financeiro.sql
-- Etapa 13: ERP Financeiro

-- 1. Upgrade na Tabela Financeiro (Não duplicar, apenas enriquecer)
ALTER TABLE financeiro
ADD COLUMN tipo VARCHAR(20) DEFAULT 'RECEITA', -- RECEITA ou DESPESA
ADD COLUMN valor_liquido NUMERIC(10,2) GENERATED ALWAYS AS (valor_total - desconto + acrescimo) STORED,
ADD COLUMN comissao_valor NUMERIC(10,2) DEFAULT 0,
ADD COLUMN repasse_liquido NUMERIC(10,2) GENERATED ALWAYS AS ((valor_total - desconto + acrescimo) - comissao_valor) STORED,
ADD COLUMN quantidade_parcelas INT DEFAULT 1,
ADD COLUMN observacoes TEXT;

-- Garantir constraint de status
ALTER TABLE financeiro 
ADD CONSTRAINT check_financeiro_status 
CHECK (status IN ('Em Aberto', 'Parcialmente Pago', 'Pago', 'Cancelado', 'Estornado', 'Vencido'));

-- 2. Pagamentos e Parcelamento (Enriquecer)
ALTER TABLE pagamentos
ADD COLUMN parcela_numero INT DEFAULT 1,
ADD COLUMN taxa_operadora NUMERIC(10,2) DEFAULT 0;

-- 3. Caixa Diário
CREATE TABLE caixa_diario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    data_caixa DATE NOT NULL,
    saldo_inicial NUMERIC(10,2) DEFAULT 0,
    entradas NUMERIC(10,2) DEFAULT 0,
    saidas NUMERIC(10,2) DEFAULT 0,
    saldo_final NUMERIC(10,2) GENERATED ALWAYS AS (saldo_inicial + entradas - saidas) STORED,
    status VARCHAR(20) DEFAULT 'ABERTO', -- ABERTO, FECHADO
    aberto_por UUID REFERENCES usuarios(id),
    fechado_por UUID REFERENCES usuarios(id),
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinica_id, data_caixa)
);

CREATE TRIGGER update_caixa_diario_modtime 
BEFORE UPDATE ON caixa_diario 
FOR EACH ROW EXECUTE PROCEDURE update_atualizado_em();

-- 4. Contas Recorrentes (Despesas fixas)
CREATE TABLE contas_recorrentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    categoria VARCHAR(50), -- Aluguel, Internet, Energia
    valor NUMERIC(10,2) NOT NULL,
    dia_vencimento INT NOT NULL CHECK(dia_vencimento BETWEEN 1 AND 31),
    ativa BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Regras de Comissionamento e Metas por Profissional
CREATE TABLE comissoes_regras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    especialidade_id UUID NOT NULL REFERENCES especialidades(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL DEFAULT 'PERCENTUAL', -- PERCENTUAL, FIXO
    valor NUMERIC(10,2) NOT NULL,
    UNIQUE(profissional_id, especialidade_id)
);

CREATE TABLE metas_profissionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    mes_ano VARCHAR(7) NOT NULL, -- YYYY-MM
    meta_faturamento NUMERIC(10,2) NOT NULL,
    faturamento_atual NUMERIC(10,2) DEFAULT 0,
    UNIQUE(profissional_id, mes_ano)
);
