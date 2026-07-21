-- 01_schema_rbac.sql

CREATE TABLE clinicas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20),
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL UNIQUE,
    clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE RESTRICT,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telefone VARCHAR(20),
    foto TEXT,
    status VARCHAR(50) DEFAULT 'Ativo',
    ultimo_login TIMESTAMPTZ,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE cargos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinica_id UUID REFERENCES clinicas(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT
);

CREATE TABLE permissoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT NOT NULL
);

CREATE TABLE cargo_permissoes (
    cargo_id UUID REFERENCES cargos(id) ON DELETE CASCADE,
    permissao_id UUID REFERENCES permissoes(id) ON DELETE CASCADE,
    PRIMARY KEY (cargo_id, permissao_id)
);

CREATE TABLE usuario_permissoes (
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    permissao_id UUID REFERENCES permissoes(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, permissao_id)
);

CREATE TABLE usuario_cargos (
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    cargo_id UUID REFERENCES cargos(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, cargo_id)
);

-- Índices
CREATE INDEX idx_usuarios_clinica ON usuarios(clinica_id);
CREATE INDEX idx_usuarios_auth ON usuarios(auth_user_id);
