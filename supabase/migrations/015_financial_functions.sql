-- =================================================================================
-- Migration: 015_financial_functions.sql
-- Descrição: Auditoria Específica Financeira e Funções Trigadas.
-- =================================================================================

-- 1. Tabela Dedicada à Auditoria Financeira
CREATE TABLE public.financial_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES public.clinics(id),
    document_id UUID REFERENCES public.financial_documents(id) ON DELETE CASCADE,
    campo_alterado VARCHAR(100),
    valor_antigo TEXT,
    valor_novo TEXT,
    motivo TEXT,
    changed_by UUID REFERENCES auth.users(id),
    ip VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Trigger Function: Rastreia mudanças de Valor ou Status no Documento
CREATE OR REPLACE FUNCTION public.trigger_financial_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Analisa Status
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.financial_audit (clinic_id, document_id, campo_alterado, valor_antigo, valor_novo, changed_by)
      VALUES (NEW.clinic_id, NEW.id, 'status', OLD.status, NEW.status, auth.uid());
    END IF;
    
    -- Analisa Valor Total
    IF OLD.valor_total IS DISTINCT FROM NEW.valor_total THEN
      INSERT INTO public.financial_audit (clinic_id, document_id, campo_alterado, valor_antigo, valor_novo, changed_by)
      VALUES (NEW.clinic_id, NEW.id, 'valor_total', OLD.valor_total::TEXT, NEW.valor_total::TEXT, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_fin_doc_audit
AFTER UPDATE ON public.financial_documents
FOR EACH ROW EXECUTE FUNCTION public.trigger_financial_audit();

-- 3. Trigger Function: Atualiza "saldo_devedor" automaticamente quando entra Pagamento
CREATE OR REPLACE FUNCTION public.update_document_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_total_pago NUMERIC(14,2);
  v_doc public.financial_documents;
BEGIN
  -- Calcula a soma de todos os pagamentos concluídos deste documento
  SELECT COALESCE(SUM(valor_pago), 0) INTO v_total_pago 
  FROM public.payments 
  WHERE document_id = NEW.document_id AND status = 'CONCLUIDO';
  
  -- Recupera o documento para calcular a diferença
  SELECT * INTO v_doc FROM public.financial_documents WHERE id = NEW.document_id;
  
  -- Aplica novo Saldo Devedor
  UPDATE public.financial_documents 
  SET saldo_devedor = GREATEST((v_doc.valor_total - v_total_pago), 0.00),
      status = CASE 
                  WHEN v_total_pago >= v_doc.valor_total THEN 'PAGO'
                  WHEN v_total_pago > 0 AND v_total_pago < v_doc.valor_total THEN 'PARCIAL'
                  ELSE status 
               END
  WHERE id = NEW.document_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Quando insere ou atualiza status de pagamento
CREATE TRIGGER trg_payment_inserted
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_document_balance();
