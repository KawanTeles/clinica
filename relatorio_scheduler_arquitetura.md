# Relatório de Auditoria — Arquitetura de Automação do CRM

## 1. Fluxo Atual de Eventos

1. **Entrada de Eventos (`crm_events`)**:
   Eventos como `LEAD_CREATED` ou `PIPELINE_CHANGED` são inseridos na tabela `crm_events` pelo frontend (ou backend) associados ao `clinic_id`. Eles nascem com a flag `processed = false`.

2. **Descoberta de Regras (`crm_automation_rules`)**:
   O `CrmAutomationEngine` (atualmente no frontend) lê os eventos pendentes e busca regras ativas na tabela `crm_automation_rules` onde o `trigger_event` corresponde ao tipo de evento.

3. **Execução de Ações**:
   As ações (ex: `CREATE_TASK`, `CREATE_INTERACTION`, `MOVE_PIPELINE`) são executadas chamando os respectivos repositories (`CrmRepository`, etc).

4. **Registro (`automation_logs`)**:
   O resultado da execução (sucesso ou falha) é registrado na tabela `automation_logs`.

## 2. O Problema Atual (O que precisa sair do frontend)

Atualmente, o arquivo `crm-automation-engine.js` contém a classe `CrmAutomationEngine` que inicia um `setInterval` (polling) a cada 30 segundos no navegador do usuário autenticado.

**Problemas gerados:**
- **Dependência do Frontend:** Se o usuário (ex: Recepcionista) fechar o navegador, a automação para completamente.
- **Concorrência:** Se houver 3 recepcionistas com o CRM aberto na mesma clínica, os três navegadores podem tentar processar os mesmos eventos ao mesmo tempo, causando duplicidade ou erros, dependendo da concorrência de leitura no banco.

## 3. Solução Proposta (Fase 4.3)

O frontend deve ser totalmente retirado do fluxo de processamento de regras. O frontend **apenas dispara/cria os eventos**.

1. **Nova Tabela (`crm_jobs`)**: Servirá como uma fila real de processamento. Ao invés de o engine buscar em `crm_events` baseado num booleano, teremos jobs estruturados com status (`pending`, `processing`, `completed`, `failed`), retry, etc.
2. **Scheduler Service Backend**: Um processo assíncrono que irá consumir os jobs pendentes da tabela `crm_jobs` de forma estruturada.
3. **Repository Backend**: Para controlar o fluxo do DB (`crm-jobs.repository.js`).
