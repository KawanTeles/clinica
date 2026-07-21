# Fase 7 - Readiness de Produção & Deployment (SRE/DevOps)
**Projeto:** Clínica Zoe - CRM Multi-Tenant e Automações WhatsApp

---

## 1. Validação do Estado das Migrações (017 a 028)
- As migrações formam uma cadeia íntegra (`017_crm_relationship_engine` até `028_crm_patient_reactivation`).
- Todas possuem verificação `IF NOT EXISTS` na criação de tabelas e índices.
- Regras de RLS, triggers de notificação e functions SQL (ex: `find_inactive_patients`) não geram bloqueios (locks severos) em tabelas legadas.
- **Veredito:** Prontas para rodar no ambiente de produção (via CLI do Supabase: `supabase db push`).

## 2. Tabelas, RLS, Policies e Functions
- **Tratamento Multi-Tenant:** Centralizado na function `public.current_clinic_id()`. Essa função provou-se essencial para isolar acessos lendo direto da *claim* de JWT `request.jwt.claim.clinic_id`.
- **Functions:** As functions que exigem alto nível de leitura (`SECURITY DEFINER` nas automações) foram limitadas estritamente a uso em repositórios controlados.
- **Policies:** Auditadas. Tabelas como `crm_events` e `crm_jobs` dependem de gatilhos automáticos do banco e RLS fechado contra vazamentos laterais.
- **Veredito:** Alta aderência às práticas recomendadas de segurança pelo Supabase.

## 3. Mapeamento de Variáveis de Ambiente (.env)
Para garantir a escalabilidade segura na nuvem (ex: Vercel, Node, Supabase Edge Functions), a aplicação deve conter as seguintes variáveis declaradas em produção:
```env
# Banco de Dados
SUPABASE_URL="https://<YOUR_PROJECT>.supabase.co"
SUPABASE_ANON_KEY="<YOUR_ANON_KEY>"
SUPABASE_SERVICE_ROLE_KEY="<YOUR_SERVICE_KEY>" # (Apenas para Workers/Back-end confiável. JAMAIS expor no front-end)

# Webhooks (Validação Hmac/Tokens)
EVOLUTION_API_URL="<OPCIONAL - Para integrações globais se não estiverem no DB>"
META_CLOUD_API_TOKEN="<OPCIONAL>"
```
*Nota: A maioria das chaves das clínicas é salva de forma Multi-Tenant no banco de dados (`crm_whatsapp_integrations`), criptografada de forma isolada, diminuindo a carga sobre o `.env` global.*

## 4. Auditoria de Segredos Expostos
- **Não há chaves fixas no código:** Nos Providers (`Evolution`, `Cloud API`), a obtenção de API Keys advém da base de dados baseada no contexto do Webhook / Worker atual.
- Nenhum token Supabase foi hardcoded nos arquivos HTML, CSS ou JS repassados durante estas fases de CRM. O client JS extrai da arquitetura já existente.
- **Veredito:** Sem ameaças de *hardcoded secrets* identificadas nas fases de automação.

## 5. Checklist de Subida para Produção
- [ ] Realizar backup completo do banco de produção (Snapshot point-in-time).
- [ ] Subir as migrações 017-028 via CI/CD ou `supabase db push`.
- [ ] Conferir privilégios da Function `current_clinic_id()`.
- [ ] Aplicar as variáveis de ambiente necessárias nas plataformas de hospedagem.
- [ ] Executar deploy do front-end/assets no provedor de preferência (Vercel/Netlify/S3).
- [ ] Ligar os CronJobs / Schedulers em ambiente Cloud.
- [ ] Redirecionar DNS dos Webhooks do provedor WhatsApp para os novos *endpoints* de Produção.
- [ ] Fazer 1 simulação *End-to-End* real (com clínica fictícia) garantindo fluxo de Mensagens e NPS no celular.

## 6. Arquitetura do Scheduler e Worker
- **Scheduler:** Atualmente o `CrmSchedulerService.generateTimeBasedEvents()` precisa ser invocado periodicamente. Em produção, ele não deve rodar via `setInterval()` num frontend. **Ação Necessária:** Alocar a chamada para esta função em um ambiente de *Serverless Cron Job* (ex: Vercel Cron, Supabase pg_cron, Node/PM2 Cron), ativando-se a cada hora ou dia, conforme o fluxo de inativos e 24h exija.
- **Worker:** Semelhante ao Scheduler, a rotina `CrmMessageWorkerService.processPendingJobs()` requer um loop ativo que deve rodar de maneira isolada em um *Worker Dyno/Instance* ou acionado via Edge Function para não congelar e travar o processamento da UI na arquitetura *Serverless*.

## 7. Endpoints de Webhooks WhatsApp
- O `whatsapp-webhook.service.js` já decodifica payloads independentes da Meta ou Evolution.
- Em produção, esse serviço precisa de uma rota exposta publicamente na API (ex: `POST /api/webhooks/whatsapp`). 
- Essa rota precisa garantir tratamento de timeout de 200/Ok imediato para que o Meta/Evolution não reenviem chamadas repetidas enquanto nossa lógica do CRM gera Tasks internas. As retentivas de idempotência no banco vão barrar duplicidade de feedback.

## 8. Plano de Rollback (Se ocorrerem falhas graves)
1. **Frontend / Node:** Reverter o build / commit na hospedagem para a tag pré-CRM.
2. **Desativar Automações:** Executar query de emergência para suspender os jobs via painel Admin ou SQL puro:
   ```sql
   UPDATE public.crm_automation_rules SET active = false;
   ```
3. **Database Drop (Último caso):** 
   Caso haja corrupção acidental em cascata devido às novas migrações, isolar/dropar tabelas na ordem inversa de criação:
   - `crm_reactivation_campaigns`
   - `crm_feedbacks`
   - `crm_whatsapp_integrations`
   - `crm_messages` e `crm_message_templates`
   - `crm_jobs` e `crm_events`
   - Restaurar de Snapshot se afetar agendas e pacientes nativos.
