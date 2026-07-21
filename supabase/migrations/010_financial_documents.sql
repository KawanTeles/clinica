-- =================================================================================
-- Migration: 010_financial_documents.sql
-- Descrição: Estrutura Base de Contas (Documents e Items) desvinculada de Appointments
-- =================================================================================

-- 1. Documento Financeiro Principal (Fatura / Conta)
CREATE TABLE public.financial_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL, -- Opcional
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
  status VARCHAR(20) DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'PARCIAL', 'PAGO', 'CANCELADO', 'ESTORNADO', 'EM_NEGOCIACAO', 'INADIMPLENTE')),
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  saldo_devedor NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. Itens do Documento (Serviços, Produtos, Retornos)
CREATE TABLE public.financial_document_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.financial_documents(id) ON DELETE CASCADE,
  procedure_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL,
  descricao VARCHAR(255) NOT NULL,
  quantidade INTEGER DEFAULT 1,
  valor_unitario NUMERIC(14,2) NOT NULL,
  desconto NUMERIC(14,2) DEFAULT 0.00,
  acrescimo NUMERIC(14,2) DEFAULT 0.00,
  valor_final NUMERIC(14,2) GENERATED ALWAYS AS ((valor_unitario * quantidade) - desconto + acrescimo) STORED
);

-- Índices de Alta Performance
CREATE INDEX idx_fin_docs_clinic ON public.financial_documents(clinic_id);
CREATE INDEX idx_fin_docs_patient ON public.financial_documents(patient_id);
CREATE INDEX idx_fin_docs_status ON public.financial_documents(status);
CREATE INDEX idx_fin_docs_due_date ON public.financial_documents(data_vencimento);
