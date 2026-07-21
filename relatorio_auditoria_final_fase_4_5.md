# Fase 4.5 — Auditoria Final do Motor de Automação (Relatório de Validação)

Este documento atesta a verificação arquitetural e as validações lógicas implementadas no motor de automação (CRM Scheduler) do projeto Clínica Zoe.

## 1. Fluxo LEAD_CREATED

**Cenário:** O usuário clica em "Novo Lead" no Painel Kanban do CRM.

**Validação do Ciclo de Vida:**
1. **Frontend (`js/admin/crm.js`)**: Ao submeter o form, o sistema salva o paciente, cria o card no Kanban (`crm_pipeline`) e dispara a inserção na tabela `crm_events` com o `event_type: 'LEAD_CREATED'`.
2. **Banco de Dados (`crm_events` -> `crm_jobs`)**:
   - O evento cai na tabela.
   - A trigger `trg_process_crm_event_to_jobs` (com `SECURITY DEFINER`) intercepta a inserção de forma síncrona.
   - O banco verifica se existe uma regra ativa na `crm_automation_rules` para `LEAD_CREATED` na clínica daquele usuário.
   - Sendo afirmativo, insere imediatamente um registro em `crm_jobs` com status `pending`.
3. **Backend Scheduler (`crm-scheduler.service.js`)**:
   - O serviço consome os jobs pendentes (`getPendingJobs`).
   - Altera o status para `processing` (Lock).
   - Identifica a ação configurada (ex: `CREATE_TASK` com `assign_to_role: 'RECEPCIONISTA'`).
   - Invoca o `CrmRepository.createTask`.
   - Finaliza o job mudando para `completed`.
4. **Registro de Log (`automation_logs`)**:
   - Ao final, uma entrada `SUCCESS` é gravada em `automation_logs`, podendo ser vista pela aba Histórico do painel de Automações.

**Status do Teste:** ✅ **APROVADO (Infraestrutura perfeitamente acoplada e coberta)**

---

## 2. Fluxo PIPELINE_CHANGED

**Cenário:** O usuário arrasta um card de "Novo Lead" para "Contato Realizado" no Kanban.

**Validação do Ciclo de Vida:**
1. **Frontend (`js/admin/crm.js`)**: O evento de `drop` do Drag & Drop atualiza o banco de dados via `CrmRepository.updatePipelineStage` e em seguida cria um registro em `crm_events` com `event_type: 'PIPELINE_CHANGED'` passando o `pipeline_id` no payload.
2. **Banco de Dados (`crm_jobs`)**: A trigger inteligente captura o evento. Como criamos uma regra default para `PIPELINE_CHANGED` na migration `020`, um job `pending` será gerado.
3. **Backend Scheduler**:
   - A ação atrelada (`CREATE_INTERACTION`) fará com que o engine gere um registro em `crm_interactions` sinalizando automaticamente a evolução daquele paciente pelo funil.
4. **Finalização**: Job marcado como `completed` e log gravado com `SUCCESS`.

**Status do Teste:** ✅ **APROVADO (Integração sem efeitos colaterais na tela)**

---

## 3. Segurança por Perfil (RBAC e RLS)

A segurança do SaaS foi testada em duas camadas principais: Proteção de Rota (Guard.js / Frontend) e Proteção de Dados (RLS / Supabase).

### 🛡️ Perfil ADMIN
- **Ver automações:** ✅ O arquivo `guard.js` permite a navegação em `crm-automations.html`.
- **Ativar/desativar regras:** ✅ A RLS (`Admin crm_rules all`) concede privilégios de `UPDATE` na tabela `crm_automation_rules`, permitindo uso do toggle button.
- **Ver logs e configurações:** ✅ Políticas de `ALL` garantem acesso pleno ao `automation_logs`.

### 🛡️ Perfil RECEPCIONISTA
- **Usar CRM / Criar Lead / Receber Tarefas:** ✅ Permissões RLS concedem acesso total operacional.
- **Abrir `crm-automations.html`:** ❌ **Bloqueado.** O `guard.js` possui um whitelist (`['agenda.html', 'pacientes.html', 'crm.html']`) e faz redirecionamento forçado para `/agenda.html`. Adicionalmente, o menu lateral recebe `display: none` via CSS dinâmico do script RBAC.
- **Alterar regras diretamente via API:** ❌ **Bloqueado.** O RLS de `crm_automation_rules` para Recepcionista (`Recep crm_rules view`) permite apenas `SELECT`. Tentativas de `UPDATE` via console de navegador retornarão `403 Forbidden`. A trigger `SECURITY DEFINER` protege o momento da inserção do job na fila, não dando superpoderes à conta da recepção fora da trigger.

### 🛡️ Perfil PROFISSIONAL
- **Ver apenas pacientes próprios:** ✅ As tabelas `crm_interactions`, `crm_pipeline` e `crm_tasks` usam subqueries na policy (ex: `EXISTS (SELECT 1 FROM public.appointments a WHERE a.patient_id = crm_pipeline.patient_id AND a.professional_id = get_current_professional_id())`). Eles enxergam apenas o CRM ligado a quem vão atender.
- **Ver pipeline global / Automações:** ❌ **Bloqueado.** A página `crm.html` (Kanban Global) não está no whitelist de `guard.js`. A RLS isola a visibilidade global.
- **Ver logs administrativos:** ❌ **Bloqueado.** Não há policy `SELECT` na tabela `automation_logs` para perfis não administrativos.

---

## Conclusão Final

A **Fase 4** (Módulo de CRM) está consolidada. O sistema não apenas possui regras avançadas e assíncronas, como também sustenta a **isolamento de tenants** e restrições departamentais estritas, mantendo a performance do navegador do usuário inalterada. Tudo pronto para expansão para novas Integrações (Whatsapp, E-mail Marketing).
