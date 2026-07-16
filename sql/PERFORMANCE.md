# Performance — Índices Recomendados (análise, não aplicado)

> ⚠️ Estes índices **ainda não foram criados**. Aplicar somente após aprovação,
> preferencialmente em migração versionada própria (ex.: `sql/perf_indexes.sql`).

## Por que criar

As colunas abaixo são usadas constantemente em:
- filtros de RLS (`paciente_id`, `profissional_id` em quase todas as policies),
- ordenação de listagens (`auditoria.created_at`, `leads.followup`),
- filtros de módulos (`financeiro.vencimento`).

Sem índices dedicados, o Postgres faz **sequential scan** nessas tabelas conforme o
volume cresce, degradando a performance das telas de Pacientes, Financeiro, CRM e Auditoria.

## Índices recomendados

```sql
-- Ligações de RLS / filtros de módulos
CREATE INDEX IF NOT EXISTS idx_prontuarios_paciente      ON public.prontuarios(paciente_id);
CREATE INDEX IF NOT EXISTS idx_anexos_paciente          ON public.anexos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_historico_paciente_pac   ON public.historico_paciente(paciente_id);
CREATE INDEX IF NOT EXISTS idx_historico_pac           ON public.historico(paciente_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_paciente     ON public.financeiro(paciente_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_profissional ON public.financeiro(profissional_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_vencimento   ON public.financeiro(vencimento);
CREATE INDEX IF NOT EXISTS idx_leads_profissional      ON public.leads(profissional_id);
CREATE INDEX IF NOT EXISTS idx_leads_followup          ON public.leads(followup);
CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente   ON public.agendamentos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_profissional ON public.agendamentos(profissional_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data       ON public.agendamentos(data);

-- Ordenação de logs (tela de Auditoria)
CREATE INDEX IF NOT EXISTS idx_auditoria_created       ON public.auditoria(created_at DESC);
```

## Observações

- `profissionais(auth_user_id)` já possui índice (`idx_profissionais_auth_user_id` em `policies.sql`).
- Chaves estrangeiras declaradas (`REFERENCES`) no Postgres **não** criam índice automático na coluna
  referenciada — daí a necessidade dos índices acima.
- Recomenda-se criar após o populate inicial para o Postgres escolher boas estatísticas.
- Em tabelas pequenas (ex.: `clinic_config`, `backup_log`) índices não são necessários.
