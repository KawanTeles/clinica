-- =================================================================================
-- Migration: 024_crm_whatsapp_providers.sql
-- Descrição: Integrações WhatsApp e extensão de messages
-- =================================================================================

-- 1. Tabela de Integrações de WhatsApp
CREATE TABLE public.crm_whatsapp_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- EVOLUTION, CLOUD_API, MOCK
    api_url TEXT,
    phone_number_id TEXT,
    access_token_encrypted TEXT,
    webhook_secret TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(clinic_id) -- Apenas uma integração ativa por clínica (por enquanto)
);

CREATE INDEX idx_crm_whatsapp_clinic ON public.crm_whatsapp_integrations(clinic_id);

CREATE TRIGGER trg_crm_whatsapp_updated_at
BEFORE UPDATE ON public.crm_whatsapp_integrations
FOR EACH ROW EXECUTE FUNCTION public.set_crm_updated_at();


-- 2. Atualizar crm_messages para suportar external_message_id
ALTER TABLE public.crm_messages ADD COLUMN external_message_id TEXT;
CREATE INDEX idx_crm_messages_external_id ON public.crm_messages(external_message_id);

-- Atualizar RPC create_crm_message para aceitar external_message_id (opcional)
-- Embora o external_message_id geralmente venha no retorno da API (após PENDING) e seja inserido via UPDATE.


-- =================================================================================
-- Row Level Security (RLS)
-- =================================================================================
ALTER TABLE public.crm_whatsapp_integrations ENABLE ROW LEVEL SECURITY;

-- ADMIN: Acesso Total
CREATE POLICY "Admin whatsapp configs all" ON public.crm_whatsapp_integrations 
  FOR ALL USING (public.is_admin() AND clinic_id = public.current_clinic_id())
  WITH CHECK (public.is_admin() AND clinic_id = public.current_clinic_id());

-- SERVICE ROLE ou funcoes com SECURITY DEFINER vão acessar ignorando RLS
