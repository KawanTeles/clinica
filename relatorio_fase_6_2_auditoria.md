# Auditoria Pré-Implementação: Fase 6.2 (Lembrete Automático 24h)

## 1. Mapeamento da Tabela `appointments`
- **Campos estruturais:** A tabela conta com `data` (DATE), `hora_inicio` (TIME), `status` (VARCHAR), `patient_id` e `clinic_id`.
- **Status da Consulta:** Pode ser `solicitada`, `aguardando_aprovacao`, `confirmada`, `em_andamento`, etc. Só enviaremos lembretes para consultas que estejam ativas (ex: `solicitada`, `confirmada`). Não enviaremos para `cancelada` ou `recusada`.
- **Fuso Horário:** Por se tratar de agendamento presencial/clínico, as consultas usam a data e hora locais da clínica. Para o agendador de 24h, precisaremos checar (Data da Consulta - Data Atual) == 1 dia.

## 2. Idempotência e Prevenção de Duplicidade (Anti-Spam)
- O agendador rodará com frequência (ex: a cada hora). Logo, pode reencontrar a mesma consulta de "amanhã" várias vezes.
- Precisamos garantir que para um mesmo `appointment_id`, não existam dois eventos `APPOINTMENT_REMINDER_24H` na tabela `crm_events`.
- Uma constraint ou verificação simples (subquery) no Scheduler resolverá isso, impedindo inserção duplicada.

## 3. Ecossistema Existente (CRM Scheduler)
- **Scheduler Atual:** Não existe ainda uma função Cron explícita no sistema que gere eventos agendados, apenas processos reativos (ex: Lead Criado -> Job). 
- **Nova Rotina:** Criaremos um método `scheduleReminders()` no *Scheduler Service* (ou em um novo Job do Cron) que varrerá a tabela `appointments`, e criará `crm_events` (que gerarão os Jobs que o Worker processará).

## 4. Atualização de Respostas no Webhook
- Já possuímos lógica para "SIM/CONFIRMO" em `whatsapp-webhook.service.js`. 
- Precisamos adicionar tratamento para "CANCELAR" ou "REMARCAR", onde mudaremos o status para `cancelada` ou engatilharemos tarefa na recepção.

## Plano de Ação Estratégico (Sem quebras)
1. Criar a migration `026_crm_appointment_reminders.sql` injetando a nova regra (`APPOINTMENT_REMINDER_24H`) e o Template.
2. Construir método de busca de consultas "para amanhã" (sem lembrete) em `AgendaRepository`.
3. Criar rotina (loop ou trigger simulado) para varrer e inserir em `crm_events`.
4. Atualizar o Webhook.
