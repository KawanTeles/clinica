-- 08_functions.sql

-- Timestamp autoupdate
CREATE OR REPLACE FUNCTION update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for core tables
CREATE TRIGGER update_usuarios_modtime BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE PROCEDURE update_atualizado_em();
CREATE TRIGGER update_pacientes_modtime BEFORE UPDATE ON pacientes FOR EACH ROW EXECUTE PROCEDURE update_atualizado_em();
CREATE TRIGGER update_consultas_modtime BEFORE UPDATE ON consultas FOR EACH ROW EXECUTE PROCEDURE update_atualizado_em();

-- Audit trigger function
CREATE OR REPLACE FUNCTION log_auditoria()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO auditoria (usuario_id, tabela, operacao, registro_id, valor_anterior, ip)
        VALUES (auth.uid(), TG_TABLE_NAME, TG_OP, OLD.id, row_to_json(OLD)::jsonb, current_setting('request.headers', true)::jsonb->>'x-forwarded-for');
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO auditoria (usuario_id, tabela, operacao, registro_id, valor_anterior, valor_novo, ip)
        VALUES (auth.uid(), TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, current_setting('request.headers', true)::jsonb->>'x-forwarded-for');
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO auditoria (usuario_id, tabela, operacao, registro_id, valor_novo, ip)
        VALUES (auth.uid(), TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(NEW)::jsonb, current_setting('request.headers', true)::jsonb->>'x-forwarded-for');
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Apply Audit to critical tables
CREATE TRIGGER log_financeiro_audit AFTER INSERT OR UPDATE OR DELETE ON financeiro FOR EACH ROW EXECUTE PROCEDURE log_auditoria();
CREATE TRIGGER log_consultas_audit AFTER INSERT OR UPDATE OR DELETE ON consultas FOR EACH ROW EXECUTE PROCEDURE log_auditoria();
