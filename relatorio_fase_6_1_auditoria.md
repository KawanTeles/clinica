# Auditoria Pré-Implementação: Fase 6.1 (Confirmação de Consulta)

## 1. Mapeamento da Tabela e Fluxo de Consultas (`appointments`)
- **Criação Atual:** As consultas são criadas via `AgendaRepository.criarAgendamento(payload)` invocado por `js/admin/agenda.js`. Atualmente, essa operação salva a consulta no banco (`appointments`), mas **não gera nenhum evento explícito** para o nosso ecossistema de CRM (que depende da tabela `crm_events`).
- **Campos de Agendamento:** Envolvem `patient_id`, `professional_id`, `data`, e `hora_inicio`.

## 2. Ecossistema de Automação Existente
- **Scheduler e Worker:** Preparados. Qualquer linha adicionada em `crm_events` gera automaticamente um job se existir uma regra de automação correspondente. Esse job já é perfeitamente capturado pelo Scheduler (`crm-scheduler.service.js`) e repassado para envio (`crm-message-worker.service.js`).
- **Webhooks:** `whatsapp-webhook.service.js` já captura `MESSAGE_RECEIVED` e rastreia o `patient_id`. Atualmente ele loga a interação. Para a Fase 6.1, precisaremos interceptar a intenção "SIM" ou "CONFIRMO" e atualizar a tabela `appointments` (status para `CONFIRMADO`).

## 3. Plano de Ação (Arquitetura Não-Invasiva)
Para respeitar estritamente a exigência de "Não reconstruir nada existente" e "Manter MVC":
1. **Geração do Evento:** Em vez de mudar a UI ou a lógica acoplada, o ideal é criar o evento `APPOINTMENT_CREATED` assim que a inserção na tabela `appointments` for concluída, através do próprio `AgendaRepository` delegando para o `CrmEventsRepository`, ou então através de uma **Trigger no Postgres** (mais seguro). Contudo, faremos pelo repositório/JS para mantermos controle flexível do payload ou usaremos trigger semelhante à que já migramos no CRM? Como o sistema prega "Não enviar WhatsApp diretamente", criar o `crm_events` via repositório ao criar a consulta é a opção menos invasiva.
2. **Migration (025):** 
   - Inserir a regra `APPOINTMENT_CREATED` na `crm_automation_rules`.
   - Inserir o template obrigatório na `crm_message_templates`.
3. **Parseamento de Variáveis:** O MessageWorker já sabe parsear `patient_name`. Ele precisará receber as novas keys `appointment_date`, `appointment_time` e `professional_name` advindas do `payload` do evento.

## Conclusão da Auditoria
A infraestrutura das Fases 5.X pavimentou totalmente o caminho. A intervenção será micro-cirúrgica: plugar a criação da consulta na esteira de `crm_events` e turbinar o `whatsapp-webhook.service.js` para agir sobre a agenda. Seguiremos para o código.
