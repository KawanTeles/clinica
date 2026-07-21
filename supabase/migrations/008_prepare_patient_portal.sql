-- =================================================================================
-- Migration: 008_prepare_patient_portal.sql
-- Descrição: Separação Financeira, Preparação do Portal do Cliente e Refinamentos (TISS).
-- =================================================================================

-- 1. Remoção Segura (Removemos tabelas financeiras da Etapa 7 para respeitar o SRP)
DROP VIEW IF EXISTS public.patient_financial_summary;
DROP TABLE IF EXISTS public.financial_transactions;

-- 2. Área do Cliente: Sessões e Devices
CREATE TABLE IF NOT EXISTS public.patient_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    device_model VARCHAR(100),
    os_version VARCHAR(50),
    push_token TEXT,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patient_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    refresh_token_hash TEXT UNIQUE NOT NULL,
    device_name VARCHAR(100),
    platform VARCHAR(50),
    browser VARCHAR(50),
    ip_address VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Refinamento de Procedures Médicas (Padrão ANS / TISS)
ALTER TABLE public.procedures 
ADD COLUMN IF NOT EXISTS codigo_tiss VARCHAR(20),
ADD COLUMN IF NOT EXISTS gera_retorno BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tempo_retorno INTEGER DEFAULT 0, -- Em minutos, Duração do retorno
ADD COLUMN IF NOT EXISTS limite_dias_retorno INTEGER DEFAULT 15; -- Prazo legal

-- 4. Cores e Layout em Alertas
ALTER TABLE public.patient_alerts 
ADD COLUMN IF NOT EXISTS cor VARCHAR(20) DEFAULT 'AMARELO' 
CHECK (cor IN ('VERMELHO', 'AMARELO', 'AZUL', 'VERDE'));
