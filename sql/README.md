# Migrations — Clínica Zoe (Supabase)

Execute os scripts **nesta ordem exata** no SQL Editor do Supabase (ou via `supabase db` CLI),
em um projeto **vazio** de produção. Não altere o conteúdo dos scripts existentes.

## Ordem de execução

| # | Arquivo | Objetivo |
|---|---------|----------|
| 1 | `database.sql` | Schema base: `especialidades`, `profissionais`, `pacientes`, `agendamentos`, `horarios_bloqueados`, `ferias`, `avaliacoes` + seed inicial. |
| 2 | `policies.sql` | Row Level Security das tabelas base + funções helper (`is_admin`, `my_professional_id`, `is_professional`) + vínculo `auth_user_id`. |
| 3 | `fix_profissionais_columns.sql` | Ajustes de colunas em `profissionais` (correção de nomes/campos). |
| 4 | `crm_schema.sql` | Módulos CRM/gestão: `prontuarios`, `anexos`, `historico_paciente`, `financeiro`, `leads`, `mensagens`, `clinic_config`, `auditoria`, `backup_log` + ENUMs + RLS. |
| 5 | `phase1_migration.sql` | Garante campos nominais da Fase 1 (`diagnostico`, `tipo`, `vencimento`, `ultimo_contato`, `proximo_followup`, `usuario`, `tabela`, `registro_id`, `dados_antigos`, `dados_novos`, `nome_clinica`, `configuracoes_json`, `tipo_evento`) + tabela `historico` + RLS. Idempotente (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`). |

## Notas

- Todos os scripts usam `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `DROP POLICY IF EXISTS`
  sempre que possível → podem ser re-executados com segurança (idempotente).
- `crm_schema.sql` e `phase1_migration.sql` devem ser aplicados **ambos** (o segundo complementa o primeiro).
- Após aplicar, **vincule** `profissionais.auth_user_id` aos `auth.users` correspondentes
  (bloco comentado ao final de `policies.sql`) para que o RLS de profissional funcione.
- O seed de `clinic_config` e `backup_log` usa `WHERE NOT EXISTS` → não duplica em re-execuções.

## Pós-migração

1. Confirmar RLS ativo em todas as 17 tabelas (`SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relrowsecurity`).
2. Criar índices recomendados (ver `PERFORMANCE.md`).
3. Popular `auth.users` e vincular aos profissionais.
4. Backup inicial antes de abrir para uso.
