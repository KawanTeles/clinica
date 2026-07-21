-- =================================================================================
-- Migration: 012_cash_register.sql
-- Descrição: PDV, Fechamento Diário e Movimentações Avulsas de Caixa.
-- =================================================================================

-- 1. Sessão de Caixa
CREATE TABLE public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  opened_by UUID REFERENCES auth.users(id),
  closed_by UUID REFERENCES auth.users(id),
  
  data_abertura TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_fechamento TIMESTAMP WITH TIME ZONE,
  
  saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  saldo_final_esperado NUMERIC(14,2) DEFAULT 0.00,
  saldo_final_real NUMERIC(14,2) DEFAULT 0.00,
  diferenca NUMERIC(14,2) DEFAULT 0.00,
  motivo_diferenca TEXT,
  
  status VARCHAR(20) DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'FECHADO'))
);

-- 2. Movimentos Avulsos ou Vinculados (Sangria, Suprimento, Pgto)
CREATE TABLE public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL, -- Se originado por pagamento
  
  tipo VARCHAR(20) CHECK (tipo IN ('ENTRADA', 'SAIDA', 'SANGRIA', 'SUPRIMENTO')),
  valor NUMERIC(14,2) NOT NULL,
  descricao TEXT NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_cash_reg_clinic ON public.cash_registers(clinic_id);
CREATE INDEX idx_cash_mov_register ON public.cash_movements(cash_register_id);
