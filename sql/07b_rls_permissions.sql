-- ============================================================================
-- 07b_rls_permissions.sql
-- Complemento da Etapa 4 - Backend RBAC
-- ============================================================================

-- ============================================================================
-- Função auxiliar: retorna a clínica do usuário autenticado
-- ============================================================================

CREATE OR REPLACE FUNCTION current_clinica_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT clinica_id
    FROM usuarios
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
$$;

-- ============================================================================
-- Função auxiliar: verifica permissão RBAC
-- ============================================================================

CREATE OR REPLACE FUNCTION user_has_permission(p_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN

    SELECT id
      INTO v_user_id
      FROM usuarios
     WHERE auth_user_id = auth.uid()
     LIMIT 1;

    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (

        SELECT 1
          FROM usuario_cargos uc
          JOIN cargo_permissoes cp
            ON cp.cargo_id = uc.cargo_id
          JOIN permissoes p
            ON p.id = cp.permissao_id
         WHERE uc.usuario_id = v_user_id
           AND p.slug = p_slug

        UNION

        SELECT 1
          FROM usuario_permissoes up
          JOIN permissoes p
            ON p.id = up.permissao_id
         WHERE up.usuario_id = v_user_id
           AND p.slug = p_slug

    );

END;
$$;

-- ============================================================================
-- CONSULTAS
-- ============================================================================

DROP POLICY IF EXISTS "Isolamento de tenant - Consultas" ON consultas;
DROP POLICY IF EXISTS "Permissao Agenda Select" ON consultas;
DROP POLICY IF EXISTS "Permissao Agenda Insert" ON consultas;
DROP POLICY IF EXISTS "Permissao Agenda Update" ON consultas;
DROP POLICY IF EXISTS "Permissao Agenda Delete" ON consultas;

CREATE POLICY "Permissao Agenda Select"
ON consultas
FOR SELECT
USING (

    clinica_id = current_clinica_id()

    AND

    user_has_permission('agenda.visualizar')

);

CREATE POLICY "Permissao Agenda Insert"
ON consultas
FOR INSERT
WITH CHECK (

    clinica_id = current_clinica_id()

    AND

    user_has_permission('agenda.criar')

);

CREATE POLICY "Permissao Agenda Update"
ON consultas
FOR UPDATE
USING (

    clinica_id = current_clinica_id()

    AND

    user_has_permission('agenda.editar')

)
WITH CHECK (

    clinica_id = current_clinica_id()

    AND

    user_has_permission('agenda.editar')

);

CREATE POLICY "Permissao Agenda Delete"
ON consultas
FOR DELETE
USING (

    clinica_id = current_clinica_id()

    AND

    user_has_permission('agenda.excluir')

);

-- ============================================================================
-- FINANCEIRO
-- ============================================================================

DROP POLICY IF EXISTS "Isolamento de tenant - Financeiro" ON financeiro;
DROP POLICY IF EXISTS "Permissao Financeiro Select" ON financeiro;
DROP POLICY IF EXISTS "Permissao Financeiro Insert" ON financeiro;
DROP POLICY IF EXISTS "Permissao Financeiro Update" ON financeiro;
DROP POLICY IF EXISTS "Permissao Financeiro Delete" ON financeiro;

CREATE POLICY "Permissao Financeiro Select"
ON financeiro
FOR SELECT
USING (

    clinica_id = current_clinica_id()

    AND

    user_has_permission('financeiro.visualizar')

);

CREATE POLICY "Permissao Financeiro Insert"
ON financeiro
FOR INSERT
WITH CHECK (

    clinica_id = current_clinica_id()

    AND

    user_has_permission('financeiro.criar')

);

CREATE POLICY "Permissao Financeiro Update"
ON financeiro
FOR UPDATE
USING (

    clinica_id = current_clinica_id()

    AND

    user_has_permission('financeiro.editar')

)
WITH CHECK (

    clinica_id = current_clinica_id()

    AND

    user_has_permission('financeiro.editar')

);

CREATE POLICY "Permissao Financeiro Delete"
ON financeiro
FOR DELETE
USING (

    clinica_id = current_clinica_id()

    AND

    user_has_permission('financeiro.excluir')

);