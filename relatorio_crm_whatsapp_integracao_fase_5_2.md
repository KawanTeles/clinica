# Auditoria Fase 5.2 — Integração WhatsApp Real + Webhooks de Retorno

## 1. Mapeamento Arquitetural (Migration 024)
A nova migração `024_crm_whatsapp_providers.sql` não altera ou destrói a base anterior. Ela acrescenta:
- **Tabela `crm_whatsapp_integrations`**: Mantém as credenciais isoladas por tenant (`clinic_id`), protegidas pela flag `active` e com suporte a tokens encriptados. Adicionado `UNIQUE(clinic_id)` para garantir uma conexão primária por clínica.
- **Coluna `external_message_id`**: Inserida em `crm_messages` para viabilizar o recebimento de callbacks assíncronos e recibos de leitura.

## 2. Camada Provider Implementada
As três estratégias exigidas pela Fase 5.1 e 5.2 operam em harmonia pelo `Provider Pattern`:
- **`MockWhatsAppProvider`**: Intacto, atua como fallback simulando envio via timeout.
- **`EvolutionProvider` (Evolution API)**: Estrutura funcional de POST mapeando o envio dinâmico do `api_url` e `access_token` extraídos das configs da respectiva clínica.
- **`CloudApiProvider` (Meta Cloud API)**: Estrutura oficial utilizando o `Graph API`, requerindo um array estruturado (`messaging_product: 'whatsapp'`) com fallback amarrado em um token bearer.

## 3. Worker de Mensagens Atualizado
O `crm-message-worker.service.js` agora não usa mais mocks hardcoded de fallback de imediato:
1. Ele faz a leitura (via `CrmMessagesRepository.getIntegrationConfig`) da tabela de integrações ativas daquela clínica.
2. Injeta o Provider correspondente (EVOLUTION, CLOUD_API, MOCK).
3. Obtém a resposta do webhook com o `external_message_id` em caso de sucesso (`SENT`) e salva no banco de dados.

## 4. Webhooks de Retorno e Segurança
Criamos a classe `WhatsappWebhookService` dentro do diretório `services/webhooks/` prevendo sua orquestração futura por uma **Edge Function** ou Node.js server.
- **Validação Rigorosa**: Ao receber os pacotes do tipo `POST /webhooks/whatsapp`, verificamos a integridade do `clinic_id`, bem como a compatibilidade da `signature` (Secret da Clínica) antes de qualquer manipulação de dados.
- **Normalize Payload**: A abstração traduz retornos da Evolution (upsert/update) e da Cloud API em dois padrões universais para a Zoe: `STATUS_UPDATE` e `MESSAGE_RECEIVED`.
- **Interação Automática**: Ao identificar o `MESSAGE_RECEIVED`, buscamos o paciente por telefone (`findPatientByContact`) e injetamos um registro em `crm_interactions`. Essa interação fica prontamente visível para os recepcionistas ou médicos no prontuário do paciente de forma reativa.

## 5. Próximos Passos (Liberação)
**Aprovado.** Toda a base real de comunicação assíncrona está entregue mantendo o Multi-Tenant protegido, isolado e as chaves prontas para ficarem guardadas (criptografadas no backend) em vez de expostas na URL. 
A arquitetura do CRM agora dispõe de um Funil Reativo End-to-End. 
