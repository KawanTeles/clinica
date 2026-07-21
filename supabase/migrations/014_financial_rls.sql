-- =================================================================================
-- Migration: 014_financial_rls.sql
-- Descrição: Segurança total isolando clínica e papéis no núcleo financeiro.
-- =================================================================================

ALTER TABLE public.financial_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

-- 1. ADMIN - Acesso Total (Se pertence à clínica ativa)
CREATE POLICY "Admin Finance Docs" ON public.financial_documents FOR ALL 
USING (public.is_admin() AND clinic_id = public.current_clinic_id());

CREATE POLICY "Admin Finance Items" ON public.financial_document_items FOR ALL 
USING (public.is_admin() AND document_id IN (SELECT id FROM public.financial_documents WHERE clinic_id = public.current_clinic_id()));

CREATE POLICY "Admin Payments" ON public.payments FOR ALL 
USING (public.is_admin() AND clinic_id = public.current_clinic_id());

CREATE POLICY "Admin Cash Reg" ON public.cash_registers FOR ALL 
USING (public.is_admin() AND clinic_id = public.current_clinic_id());

CREATE POLICY "Admin Cash Mov" ON public.cash_movements FOR ALL 
USING (public.is_admin() AND cash_register_id IN (SELECT id FROM public.cash_registers WHERE clinic_id = public.current_clinic_id()));

-- 2. RECEPCIONISTA - Pode operar o PDV e lançar pagamentos/receitas (Não deleta)
CREATE POLICY "Recep Finance Select Insert" ON public.financial_documents FOR SELECT 
USING (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());

CREATE POLICY "Recep Finance Insert" ON public.financial_documents FOR INSERT 
WITH CHECK (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());

CREATE POLICY "Recep Payments Select Insert" ON public.payments FOR SELECT 
USING (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());

CREATE POLICY "Recep Payments Insert" ON public.payments FOR INSERT 
WITH CHECK (public.has_role('RECEPCIONISTA') AND clinic_id = public.current_clinic_id());

-- Assegurando operações seguras (sem permissão de DELETE para Recepcionistas)
