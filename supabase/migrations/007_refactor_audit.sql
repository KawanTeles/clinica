-- =================================================================================
-- Migration: 007_refactor_audit.sql
-- Descrição: Sistema Genérico e Incremental de Auditoria (Transição do modelo JSON)
-- =================================================================================

-- 1. Atualização da Tabela de Auditoria Unificada (Criada na Migration 005)
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id),
ADD COLUMN IF NOT EXISTS modulo VARCHAR(50);

-- 2. Trigger Universal para Rastreio Dinâmico (Diff campo a campo)
CREATE OR REPLACE FUNCTION public.trigger_audit_log_incremental()
RETURNS TRIGGER AS $$
DECLARE
  v_old_json JSONB := '{}'::jsonb;
  v_new_json JSONB := '{}'::jsonb;
  v_diff JSONB := '{}'::jsonb;
  k TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Calcula diff iterando chaves do novo estado
    FOR k IN SELECT key FROM jsonb_each(to_jsonb(NEW))
    LOOP
      IF to_jsonb(NEW)->>k IS DISTINCT FROM to_jsonb(OLD)->>k THEN
        v_diff := jsonb_set(v_diff, ARRAY[k], to_jsonb(NEW)->k);
        v_old_json := jsonb_set(v_old_json, ARRAY[k], to_jsonb(OLD)->k);
      END IF;
    END LOOP;
    
    -- Apenas loga se houver mudanças reais
    IF v_diff <> '{}'::jsonb THEN
      INSERT INTO public.audit_logs (entity_type, entity_id, action, old_data, new_data, changed_by)
      VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', v_old_json, v_diff, auth.uid());
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Injetar a auditoria em tabelas críticas (convivendo com patient_history até descontinuação final)
DROP TRIGGER IF EXISTS trg_audit_prof_inc ON public.professionals;
CREATE TRIGGER trg_audit_prof_inc 
AFTER INSERT OR UPDATE OR DELETE ON public.professionals 
FOR EACH ROW EXECUTE FUNCTION public.trigger_audit_log_incremental();

DROP TRIGGER IF EXISTS trg_audit_pat_inc ON public.patients;
CREATE TRIGGER trg_audit_pat_inc 
AFTER INSERT OR UPDATE OR DELETE ON public.patients 
FOR EACH ROW EXECUTE FUNCTION public.trigger_audit_log_incremental();
