-- 07_rls_policies.sql

-- Enable RLS (Security)
ALTER TABLE clinicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;

-- Tenants Isolation
CREATE POLICY "Isolamento de tenant - Usuarios" ON usuarios
    FOR ALL USING (clinica_id IN (SELECT clinica_id FROM usuarios WHERE auth_user_id = auth.uid()));

CREATE POLICY "Isolamento de tenant - Pacientes" ON pacientes
    FOR ALL USING (clinica_id IN (SELECT clinica_id FROM usuarios WHERE auth_user_id = auth.uid()));

CREATE POLICY "Isolamento de tenant - Consultas" ON consultas
    FOR ALL USING (clinica_id IN (SELECT clinica_id FROM usuarios WHERE auth_user_id = auth.uid()));

CREATE POLICY "Isolamento de tenant - Financeiro" ON financeiro
    FOR ALL USING (clinica_id IN (SELECT clinica_id FROM usuarios WHERE auth_user_id = auth.uid()));
