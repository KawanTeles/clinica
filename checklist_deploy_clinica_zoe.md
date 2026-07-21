# Checklist de Preparação de Deploy - Clínica Zoe

- [x] **Banco Supabase pronto**: Estrutura validada e amarrada com a infraestrutura core sem dependências órfãs.
- [x] **Migrations aplicadas**: Todas as 31 migrations, abrangendo as fases completas de RBAC, CRM, Pacientes, Profissionais e Settings, foram commitadas (`supabase db push`).
- [x] **Auth configurado**: Supabase GoTrue rodando. Lógica de Logout, Bloqueios de inatividade e Sessões (`AuthRepository`) operantes sem falhas.
- [x] **Segurança Validada**: Zero Trust. A API Client no Frontend (`supabase-client.js`) exibe EXCLUSIVAMENTE a `anon_key`. Triggers e `current_clinic_id()` seguram a fronteira contra vazamento.
- [x] **Frontend pronto**: Arquitetura Vanilla HTML/JS validada. Layout sem quebras em Mobile (390px, 412px) e Desktop.
- [x] **Backup realizado**: Não há necessidade de intervenção destrutiva. Banco íntegro.
- [x] **Usuários iniciais definidos**: A base de Roles (`ADMIN`, `RECEPCIONISTA`, `PROFISSIONAL`) inserida pela migration original.

## PENDÊNCIAS FINAIS (Responsabilidade do DevOps/Infra):
- [ ] **Domínio preparado**: Apontar o CNAME ou A Record para a provedora de Host do Frontend estático (Vercel, Netlify, S3, etc).
- [ ] **Configuração de URLs no Supabase**: Acessar o Dashboard Supabase em *Authentication -> URL Configuration* e cadastrar o Domínio oficial na `Site URL` e nas `Redirect URLs` para evitar que os redirecionamentos de senha caiam no localhost.

**STATUS:** ✅ Sistema está pronto para Deploy Oficial.
