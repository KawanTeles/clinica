-- =================================================================================
-- Migration: 001_initial_auth_rbac.sql
-- Descrição: Criação das tabelas base para autenticação, RBAC e auditoria.
-- =================================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Roles (Cargos)
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(50) UNIQUE NOT NULL
);

-- 2. Permissions (Permissões)
CREATE TABLE public.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) UNIQUE NOT NULL,
    descricao TEXT
);

-- 3. Role Permissions (Associação)
CREATE TABLE public.role_permissions (
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 4. User Profiles (Perfis de Usuário)
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role_id UUID REFERENCES public.roles(id) ON DELETE RESTRICT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Security Logs (Auditoria)
CREATE TABLE public.security_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    acao VARCHAR(100) NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =================================================================================
-- 6. SECURITY DEFINER Functions (Prevenção de Recursão RLS)
-- Estas funções executam com privilégios de bypass-rls, permitindo validar as roles
-- sem cair em loops de verificação infinita na tabela user_profiles.
-- =================================================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS VARCHAR AS $$
  SELECT r.nome 
  FROM public.user_profiles up
  JOIN public.roles r ON up.role_id = r.id
  WHERE up.auth_user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT public.get_user_role() = 'ADMIN';
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_role(role_name VARCHAR)
RETURNS BOOLEAN AS $$
  SELECT public.get_user_role() = role_name;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_permission(perm_name VARCHAR)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_profiles up
    JOIN public.role_permissions rp ON rp.role_id = up.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE up.auth_user_id = auth.uid() AND p.nome = perm_name
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- =================================================================================
-- 7. Seed Inicial de Dados
-- =================================================================================

INSERT INTO public.roles (nome) VALUES 
('ADMIN'), 
('RECEPCIONISTA'), 
('PROFISSIONAL'), 
('CLIENTE')
ON CONFLICT (nome) DO NOTHING;

-- =================================================================================
-- 8. Enable Row Level Security (RLS)
-- =================================================================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- =================================================================================
-- 9. Policies de Segurança Baseadas nas Funções Definer
-- =================================================================================

-- Leitura básica para qualquer logado
CREATE POLICY "Leitura de roles (auth)" ON public.roles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Leitura de permissions (auth)" ON public.permissions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Leitura de role_permissions (auth)" ON public.role_permissions FOR SELECT USING (auth.role() = 'authenticated');

-- Políticas de Profile
CREATE POLICY "Usuário vê próprio perfil" ON public.user_profiles 
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "Admin gerencia todos perfis" ON public.user_profiles 
  FOR ALL USING (public.is_admin());

-- Políticas de Log de Segurança
CREATE POLICY "Admin vê logs" ON public.security_logs 
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Sistema insere logs do usuário" ON public.security_logs 
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());
