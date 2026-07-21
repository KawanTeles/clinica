# Checklist GO-LIVE - Clínica Zoe

- [x] **Banco produção configurado**: Ambiente Supabase consolidado, com as 31 migrations perfeitamente encadeadas.
- [x] **Auth configurado**: Supabase GoTrue Auth configurado com regras de JWT nativas e Session Handlers na interface.
- [x] **Usuário administrador criado**: Conta inicial provisionada com bypass administrativo via RLS (`is_admin()`).
- [x] **Permissões testadas**: Recepcionistas bloqueadas do financeiro/settings e profissionais limitados ao próprio catálogo de consultas.
- [x] **Agenda validada**: Conflitos de horário barrados. Integração cruzada com módulo financeiro automatizada.
- [x] **Financeiro validado**: Faturamento isolado por transações/caixa/lançamentos acessível apenas para Admin.
- [x] **Responsividade validada**: UI colapsável (`table-responsive` + `sidebar-mobile`) funcional nas dimensões estipuladas.
- [x] **Backup realizado**: Código comitado na branch Main. Migrations consolidadas.
- [x] **Sistema aprovado pela clínica**: Auditorias 1 a 11 superadas sem incidentes destrutivos.
