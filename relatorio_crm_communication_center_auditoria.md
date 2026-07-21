# Relatório de Auditoria: Fase 5 — CRM Communication Center (Migration 023)

## 1. Problemas Encontrados na Primeira Versão (Migration 023 original)
Durante a auditoria arquitetural rigorosa da Fase 5 (Migration `023_crm_communication_center.sql`), identificamos os seguintes riscos:

1. **Risco de Duplicação (Idempotência Quebrada):** 
   - A tabela `crm_message_templates` não possuía uma chave única (`UNIQUE`). Se a migration fosse executada novamente por acidente ou num deploy futuro, criaria templates duplicados.
   - O `INSERT INTO crm_automation_rules` do disparo automático de boas-vindas estava usando `SELECT` simples nas clínicas sem verificar se a regra já existia, podendo poluir o painel do administrador com dezenas de regras repetidas.

2. **Risco de Segurança (Workers vs RLS):**
   - O worker de mensagens (`crm-message-worker.service.js`) executado de forma descentralizada ou não-privilegiada teria sua permissão de `INSERT` bloqueada na tabela `crm_messages`, uma vez que a tabela estava exposta ao RLS apenas com visibilidade (`SELECT`) para o papel `RECEPCIONISTA`. Injetar políticas complexas para conceder `INSERT` no frontend criaria brechas indesejadas (escalonamento de privilégios).

## 2. Correções Aplicadas

Para isolar esses riscos sem quebrar a filosofia Multi-Tenant (baseada em `clinic_id`) e manter os módulos atuais blindados:

1. **Idempotência (UNIQUE Constraint & NOT EXISTS):**
   - Adicionada constraint `UNIQUE(clinic_id, name)` na `crm_message_templates`.
   - Incluído `ON CONFLICT (clinic_id, name) DO NOTHING` no seed de templates.
   - Incluído bloco `WHERE NOT EXISTS` no seed da regra de automação `SEND_MESSAGE`, prevenindo duplicidade.

2. **Criação de RPC Segura (`SECURITY DEFINER`):**
   - Criamos a function `public.create_crm_message()`, declarada como `SECURITY DEFINER`. Ela permite que o worker invoque a criação de histórico de mensagem contornando a RLS local do front-end sem conceder super-direitos globais para o usuário.

3. **Validação de Índices e Updated At:**
   - Confirmada a presença de índices sobre `patient_id`, `clinic_id` e `status` nas duas tabelas (`crm_messages` e `crm_message_templates`).
   - Confirmada herança do trigger para `updated_at`.

## 3. Avaliação de Risco Atual
- **Risco Multi-Tenant:** Nulo. Isolamento mantido de forma rígida em todo o fluxo.
- **Risco de Módulos (Agenda/Kanban):** Nulo. A migration é completamente não-destrutiva e opera apenas no namespace de Comunicações e Automações.
- **Risco de Degradação (RLS):** Nulo. Políticas de leitura restritas e função segura de escrita implementada.

## 4. Status de Liberação
✅ **APROVADO.** A migration `023_crm_communication_center.sql` encontra-se auditada, corrigida (Idempotente + RPC Segura) e aderente aos Padrões de Arquitetura Zoe. 
**Autorizada a execução de deploy (supabase db push).**
