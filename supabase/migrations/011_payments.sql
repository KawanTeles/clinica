-- =================================================================================
-- Migration: 011_payments.sql
-- Descrição: Sistema granular de pagamentos vinculados a documentos financeiros.
-- =================================================================================

-- Pagamentos Individuais (Permite Split: Dinheiro + Pix no mesmo documento)
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.financial_documents(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE RESTRICT,
  
  valor_pago NUMERIC(14,2) NOT NULL,
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  
  status VARCHAR(20) DEFAULT 'CONCLUIDO' CHECK (status IN ('CONCLUIDO', 'ESTORNADO', 'EM_PROCESSAMENTO')),
  comprovante_url TEXT,
  gateway_transaction_id VARCHAR(255),
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices Analíticos
CREATE INDEX idx_payments_clinic ON public.payments(clinic_id);
CREATE INDEX idx_payments_document ON public.payments(document_id);
CREATE INDEX idx_payments_date ON public.payments(data_pagamento);
