-- =================================================================================
-- Migration: 032_admin_audit_logs.sql
-- Descrição: Evolução da tabela audit_logs para suporte total do Painel Administrativo
-- (Adição de clinic_id para RLS e description legível)
-- =================================================================================

-- 1. Alterar tabela existente audit_logs
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id),
ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Atualizar trigger existente para tentar herdar clinic_id dos registros (quando possível)
CREATE OR REPLACE FUNCTION public.trigger_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_old_json JSONB := '{}'::jsonb;
  v_new_json JSONB := '{}'::jsonb;
  v_diff JSONB := '{}'::jsonb;
  k TEXT;
  v_clinic_id UUID := NULL;
BEGIN
  -- Tentar capturar o clinic_id do registro modificado
  BEGIN
    IF TG_OP = 'DELETE' THEN
      EXECUTE 'SELECT clinic_id FROM ' || TG_TABLE_NAME || ' WHERE id = $1' INTO v_clinic_id USING OLD.id;
    ELSE
      EXECUTE 'SELECT clinic_id FROM ' || TG_TABLE_NAME || ' WHERE id = $1' INTO v_clinic_id USING NEW.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Se a tabela não possuir clinic_id, ignora o erro e deixa NULL
    v_clinic_id := NULL;
  END;

  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT key FROM jsonb_each(to_jsonb(NEW))
    LOOP
      IF to_jsonb(NEW)->>k IS DISTINCT FROM to_jsonb(OLD)->>k THEN
        v_diff := jsonb_set(v_diff, ARRAY[k], to_jsonb(NEW)->k);
        v_old_json := jsonb_set(v_old_json, ARRAY[k], to_jsonb(OLD)->k);
      END IF;
    END LOOP;
    
    IF v_diff <> '{}'::jsonb THEN
      INSERT INTO public.audit_logs (entity_type, entity_id, action, old_data, new_data, changed_by, clinic_id)
      VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', v_old_json, v_diff, auth.uid(), v_clinic_id);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, new_data, changed_by, clinic_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid(), v_clinic_id);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (entity_type, entity_id, action, old_data, changed_by, clinic_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid(), v_clinic_id);
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Habilitar RLS na tabela audit_logs e criar as Policies de leitura (Apenas Admin)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política de leitura: Apenas ADMIN da própria clínica pode ver
CREATE POLICY "Admin read audit_logs" ON public.audit_logs
FOR SELECT 
USING (
    public.is_admin() AND 
    (clinic_id = (SELECT public.get_current_clinic_id()) OR clinic_id IS NULL)
);

-- Política de inserção: Todos logados podem inserir (o repository no client-side, bem como as triggers, precisam inserir)
CREATE POLICY "Users insert audit_logs" ON public.audit_logs
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Adicionar triggers de auditoria em tabelas cr�ticas faltantes
CREATE TRIGGER trg_professional_audit AFTER INSERT OR UPDATE OR DELETE ON public.professionals FOR EACH ROW EXECUTE FUNCTION public.trigger_audit_log();
CREATE TRIGGER trg_clinic_audit AFTER INSERT OR UPDATE OR DELETE ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.trigger_audit_log();

