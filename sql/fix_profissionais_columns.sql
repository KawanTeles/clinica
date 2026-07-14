-- ══════════════════════════════════════════════════════════════════
--  Clínica Zoe — Correção da tabela profissionais
--  Arquivo: sql/fix_profissionais_columns.sql
--
--  PROBLEMA: O código JavaScript envia os campos 'telefone' e
--  'auth_user_id' para a tabela 'profissionais', mas essas colunas
--  não existem no schema original, gerando o erro:
--  "Could not find the 'telefone' column of 'profissionais' in the schema cache"
--
--  INSTRUÇÃO: Execute este script no SQL Editor do Supabase.
--  Todos os comandos usam ADD COLUMN IF NOT EXISTS para
--  não causar erros caso a coluna já exista.
--  Dados existentes são 100% preservados.
-- ══════════════════════════════════════════════════════════════════

-- 1. Adicionar coluna telefone (campo exibido na tabela e nos cards)
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);

-- 2. Adicionar coluna auth_user_id (vincula com o usuário Supabase Auth)
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────────────────────────
-- Verificação: Listar todas as colunas da tabela profissionais
-- ──────────────────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'profissionais'
ORDER BY ordinal_position;

-- ──────────────────────────────────────────────────────────────────
-- PASSO EXTRA: Após executar, atualize o schema cache do Supabase
-- acessando: Dashboard > Database > API > "Reload Schema"
-- ──────────────────────────────────────────────────────────────────
