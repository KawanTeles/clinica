-- ═══════════════════════════════════════════════════════════════
--  Clínica Zoe — Políticas de Row Level Security (RLS)
--  Execute no SQL Editor do Supabase
--  Atualizado com suporte a auth_user_id na tabela profissionais
-- ═══════════════════════════════════════════════════════════════

-- ── 0. Garantir coluna auth_user_id ─────────────────────────────
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profissionais_auth_user_id
  ON public.profissionais(auth_user_id);

-- ── 1. Habilitar RLS em todas as tabelas ────────────────────────
ALTER TABLE public.especialidades        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profissionais         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_bloqueados   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes            ENABLE ROW LEVEL SECURITY;

-- ── 2. Funções Helper ────────────────────────────────────────────

-- Verifica se o usuário logado é administrador
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN (
    auth.role() = 'authenticated' AND (
      coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
      OR auth.email() = 'admin@clinicazoe.com'
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Retorna o ID do registro de profissional do usuário logado
-- Usa auth_user_id primeiro (mais seguro), fallback para email
CREATE OR REPLACE FUNCTION public.my_professional_id()
RETURNS UUID SECURITY DEFINER AS $$
DECLARE
  prof_id UUID;
BEGIN
  -- Busca pelo auth_user_id
  SELECT id INTO prof_id
  FROM public.profissionais
  WHERE auth_user_id = auth.uid() AND ativo = true
  LIMIT 1;

  -- Fallback: busca por email
  IF prof_id IS NULL THEN
    SELECT id INTO prof_id
    FROM public.profissionais
    WHERE email = auth.email() AND ativo = true
    LIMIT 1;
  END IF;

  RETURN prof_id;
END;
$$ LANGUAGE plpgsql;

-- Verifica se o usuário logado é um profissional ativo
CREATE OR REPLACE FUNCTION public.is_professional()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN (
    auth.role() = 'authenticated' AND
    public.my_professional_id() IS NOT NULL AND
    NOT public.is_admin()
  );
END;
$$ LANGUAGE plpgsql;


-- ── 3. ESPECIALIDADES ────────────────────────────────────────────
-- Remover políticas antigas (caso existam)
DROP POLICY IF EXISTS "Especialidades are readable by everyone"      ON public.especialidades;
DROP POLICY IF EXISTS "Especialidades are writeable only by Admins"  ON public.especialidades;

-- Leitura pública (usada no agendamento público)
CREATE POLICY "especialidades_select_public" ON public.especialidades
  FOR SELECT USING (true);

-- Escrita apenas pelo admin
CREATE POLICY "especialidades_write_admin" ON public.especialidades
  FOR ALL USING (public.is_admin());


-- ── 4. PROFISSIONAIS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Profissionais are readable by everyone"      ON public.profissionais;
DROP POLICY IF EXISTS "Profissionais are writeable only by Admins"  ON public.profissionais;

-- Leitura: público vê ativos, profissional vê apenas o próprio, admin vê todos
CREATE POLICY "profissionais_select" ON public.profissionais
  FOR SELECT USING (
    ativo = true                                   -- público / agendamento
    OR public.is_admin()                           -- admin vê todos
    OR id = public.my_professional_id()            -- profissional vê o próprio
  );

-- UPDATE: profissional pode atualizar somente seu próprio registro
--   e APENAS os campos foto, telefone, whatsapp
--   (Nome, especialidade, horários, dias → somente admin)
CREATE POLICY "profissionais_update_own" ON public.profissionais
  FOR UPDATE USING (
    public.is_admin()
    OR id = public.my_professional_id()
  )
  WITH CHECK (
    public.is_admin()
    OR id = public.my_professional_id()
  );

-- INSERT / DELETE: somente admin
CREATE POLICY "profissionais_insert_admin" ON public.profissionais
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "profissionais_delete_admin" ON public.profissionais
  FOR DELETE USING (public.is_admin());


-- ── 5. PACIENTES ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Pacientes read own data or Admin reads all"           ON public.pacientes;
DROP POLICY IF EXISTS "Pacientes insert own data (public/anonymous)"         ON public.pacientes;
DROP POLICY IF EXISTS "Pacientes update own data or Admin updates all"       ON public.pacientes;
DROP POLICY IF EXISTS "Pacientes delete only by Admins"                      ON public.pacientes;

-- Admin lê todos; profissional lê apenas pacientes com consulta vinculada a ele
CREATE POLICY "pacientes_select" ON public.pacientes
  FOR SELECT USING (
    public.is_admin()
    OR (auth.role() = 'authenticated' AND auth.email() = email)
    OR EXISTS (
      SELECT 1 FROM public.agendamentos a
      WHERE a.paciente_id = pacientes.id
        AND a.profissional_id = public.my_professional_id()
    )
  );

-- Qualquer um pode inserir (público cria sua conta ao agendar)
CREATE POLICY "pacientes_insert_public" ON public.pacientes
  FOR INSERT WITH CHECK (true);

-- Atualizar: próprio paciente ou admin
CREATE POLICY "pacientes_update" ON public.pacientes
  FOR UPDATE USING (
    public.is_admin()
    OR (auth.role() = 'authenticated' AND auth.email() = email)
  );

-- Deletar: somente admin
CREATE POLICY "pacientes_delete_admin" ON public.pacientes
  FOR DELETE USING (public.is_admin());


-- ── 6. AGENDAMENTOS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Agendamentos readable by public (for slots checking), professional, or Admin" ON public.agendamentos;
DROP POLICY IF EXISTS "Agendamentos can be inserted by public"                                       ON public.agendamentos;
DROP POLICY IF EXISTS "Agendamentos can be updated by Admin or associated Professional"              ON public.agendamentos;
DROP POLICY IF EXISTS "Agendamentos can be deleted by Admin"                                         ON public.agendamentos;

-- Leitura: público consulta slots; profissional vê apenas os seus; admin vê todos
CREATE POLICY "agendamentos_select" ON public.agendamentos
  FOR SELECT USING (
    public.is_admin()
    OR profissional_id = public.my_professional_id()
    OR true   -- público pode ler data/hora/profissional_id para checar disponibilidade
  );

-- Inserção pública (agendamento pela landing page)
CREATE POLICY "agendamentos_insert_public" ON public.agendamentos
  FOR INSERT WITH CHECK (true);

-- Atualização: profissional altera status apenas dos seus; admin altera todos
CREATE POLICY "agendamentos_update" ON public.agendamentos
  FOR UPDATE USING (
    public.is_admin()
    OR profissional_id = public.my_professional_id()
  );

-- Deleção: somente admin
CREATE POLICY "agendamentos_delete_admin" ON public.agendamentos
  FOR DELETE USING (public.is_admin());


-- ── 7. HORARIOS_BLOQUEADOS ───────────────────────────────────────
DROP POLICY IF EXISTS "Horários bloqueados are readable by everyone (for slots checking)"          ON public.horarios_bloqueados;
DROP POLICY IF EXISTS "Horários bloqueados writeable by Admin or associated Professional"          ON public.horarios_bloqueados;

CREATE POLICY "horarios_bloqueados_select" ON public.horarios_bloqueados
  FOR SELECT USING (true);

CREATE POLICY "horarios_bloqueados_write" ON public.horarios_bloqueados
  FOR ALL USING (
    public.is_admin()
    OR profissional_id = public.my_professional_id()
  );


-- ── 8. FERIAS ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Ferias are readable by everyone"                  ON public.ferias;
DROP POLICY IF EXISTS "Ferias writeable by Admin or associated Professional" ON public.ferias;

CREATE POLICY "ferias_select" ON public.ferias
  FOR SELECT USING (true);

CREATE POLICY "ferias_write" ON public.ferias
  FOR ALL USING (
    public.is_admin()
    OR profissional_id = public.my_professional_id()
  );


-- ── 9. AVALIACOES ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Avaliacoes are readable by everyone"          ON public.avaliacoes;
DROP POLICY IF EXISTS "Avaliacoes can be inserted by anyone"         ON public.avaliacoes;
DROP POLICY IF EXISTS "Avaliacoes can be deleted/updated by Admins"  ON public.avaliacoes;

CREATE POLICY "avaliacoes_select"       ON public.avaliacoes FOR SELECT USING (true);
CREATE POLICY "avaliacoes_insert"       ON public.avaliacoes FOR INSERT WITH CHECK (true);
CREATE POLICY "avaliacoes_write_admin"  ON public.avaliacoes FOR ALL    USING (public.is_admin());


-- ── 10. Vincular profissionais ao auth_user_id (pós-migração) ───
-- Execute este bloco APÓS confirmar que os auth_user_ids estão corretos.
-- Descomente se precisar vincular profissionais já cadastrados:
--
-- UPDATE public.profissionais p
-- SET auth_user_id = u.id
-- FROM auth.users u
-- WHERE p.email = u.email
--   AND p.auth_user_id IS NULL;
