-- =================================================================================
-- Migration: 031_clinic_settings.sql
-- Descrição: Evolução da tabela clinics adicionando campos de configurações gerais.
-- =================================================================================

ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS telefone VARCHAR(20),
ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS endereco VARCHAR(255),
ADD COLUMN IF NOT EXISTS cidade VARCHAR(100),
ADD COLUMN IF NOT EXISTS estado VARCHAR(2),
ADD COLUMN IF NOT EXISTS informacoes_publicas TEXT,
ADD COLUMN IF NOT EXISTS dias_atendimento JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS horario_abertura TIME DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS horario_fechamento TIME DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS intervalo_inicio TIME DEFAULT '12:00',
ADD COLUMN IF NOT EXISTS intervalo_fim TIME DEFAULT '13:00';

-- Garantir que apenas o Administrador possa alterar a tabela de clinics.
-- (Verificando RLS existente)
-- O arquivo 006 não aplicou RLS explícito com FOR UPDATE limitando a admins.
-- Iremos reforçar agora para a tabela clinics.

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins podem atualizar sua clinica') THEN
        CREATE POLICY "Admins podem atualizar sua clinica" ON public.clinics
        FOR UPDATE USING (
            id = public.current_clinic_id() AND public.is_admin()
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Qualquer usuario le sua clinica') THEN
        CREATE POLICY "Qualquer usuario le sua clinica" ON public.clinics
        FOR SELECT USING (
            id = public.current_clinic_id()
        );
    END IF;
END $$;
