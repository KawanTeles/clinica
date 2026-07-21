-- =================================================================================
-- Migration: 002_module_professionals.sql
-- Descrição: Criação da tabela professionals, ajustes de RLS, funções e índices.
-- =================================================================================

-- 1. Funções de Apoio (Security Definer)
CREATE OR REPLACE FUNCTION public.get_current_user_profile_id()
RETURNS UUID AS $$
  SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Tabela professionals
CREATE TABLE public.professionals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_profile_id UUID REFERENCES public.user_profiles(id) ON DELETE RESTRICT UNIQUE NOT NULL,
    nome VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE,
    descricao TEXT,
    foto TEXT,
    especialidade VARCHAR(100),
    especialidade_id UUID, -- Referência futura para tabela de especialidades
    registro_profissional VARCHAR(50),
    telefone VARCHAR(20),
    whatsapp VARCHAR(20),
    valor_avista DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    valor_cartao DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    ativo BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Índices de Performance
CREATE INDEX idx_professionals_user_profile_id ON public.professionals(user_profile_id);
CREATE INDEX idx_professionals_especialidade ON public.professionals(especialidade);
CREATE INDEX idx_professionals_ativo ON public.professionals(ativo);

-- 4. Gatilho para updated_at
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_professionals
BEFORE UPDATE ON public.professionals
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- =================================================================================
-- 5. Row Level Security (RLS)
-- =================================================================================
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

-- A. ADMIN: Acesso Total
CREATE POLICY "Admin gerencia profissionais" 
ON public.professionals FOR ALL 
USING (public.is_admin());

-- B. RECEPCIONISTA: Visualização restrita a ativos
CREATE POLICY "Recepcionista visualiza profissionais" 
ON public.professionals FOR SELECT 
USING (public.has_role('RECEPCIONISTA') AND ativo = true);

-- C. PROFISSIONAL: Vê apenas os seus próprios dados de negócio
CREATE POLICY "Profissional vê os próprios dados" 
ON public.professionals FOR SELECT 
USING (
  user_profile_id = public.get_current_user_profile_id()
);
