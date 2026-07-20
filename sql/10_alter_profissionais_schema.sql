-- 10_alter_profissionais_schema.sql
-- Etapa 6: Ajuste para separar Usuário de Profissional (permitindo Profissionais sem acesso)

ALTER TABLE profissionais ALTER COLUMN usuario_id DROP NOT NULL;

ALTER TABLE profissionais 
ADD COLUMN nome VARCHAR(255) NOT NULL DEFAULT 'Profissional Temporário',
ADD COLUMN cpf VARCHAR(20),
ADD COLUMN rg VARCHAR(20),
ADD COLUMN data_nascimento DATE,
ADD COLUMN sexo VARCHAR(20),
ADD COLUMN foto TEXT,
ADD COLUMN telefone VARCHAR(20),
ADD COLUMN whatsapp VARCHAR(20),
ADD COLUMN email VARCHAR(255),
ADD COLUMN biografia TEXT,
ADD COLUMN tempo_experiencia INT,
ADD COLUMN status VARCHAR(50) DEFAULT 'Ativo',
ADD COLUMN data_admissao DATE,
ADD COLUMN valor_cartao NUMERIC(10,2),
ADD COLUMN valor_sessao NUMERIC(10,2),
ADD COLUMN percentual_comissao NUMERIC(5,2);

-- Atualiza restrição de exclusão de horários para incluir status Inativo se aplicável
-- Índices
CREATE INDEX idx_profissionais_cpf ON profissionais(cpf);
CREATE INDEX idx_profissionais_status ON profissionais(status);
