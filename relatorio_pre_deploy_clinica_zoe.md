# Documentação de Pré-Deploy e Arquitetura - Clínica Zoe

## 1. Arquitetura do Sistema
O Painel Administrativo da Clínica Zoe foi construído sobre uma arquitetura estática (HTML/CSS/Vanilla JS) com backend as a service operado pelo **Supabase** (PostgreSQL + GoTrue Auth). 
O projeto foi desenhado no formato **SaaS Multi-Tenant**. Cada clínica opera no mesmo banco de dados isolada exclusivamente pela coluna `clinic_id`, gerenciada através de Row Level Security (RLS) interceptando o token JWT.

## 2. Estrutura de Pastas
- `/css/admin/`: Folhas de estilo segregadas (Admin, Components, Responsividade, Telas).
- `/js/admin/`: Controladores de interface (Dashboard, Profissionais, Financeiro).
- `/pages/admin/`: Views HTML estáticas para o painel.
- `/repositories/`: **Camada Obrigatória**. Todos os acessos a dados (`supabase.from`) estão encapsulados aqui, provendo uma abstração limpa para as Views.
- `/supabase/migrations/`: Receituário SQL sequencial controlando a evolução do banco, triggers e funções.

## 3. Principais Tabelas do Supabase Utilizadas
1. **`clinics`**: Tabela core SaaS (Guarda informações, horários e configs da matriz).
2. **`user_profiles` & `roles`**: Gestão de identidade e permissões cruzadas com `auth.users`.
3. **`professionals`**: Catálogo de médicos e terapeutas.
4. **`patients`**: Base de clientes (CRM/Agenda).
5. **`appointments`**: Motor da Agenda médica.
6. **`financial_documents` & `payments`**: Faturamento automático de consultas e split de pagamentos (Pix, Cartão).
7. **`security_logs`**: Tabela de auditoria restrita aos administradores.

## 4. Controle de Acesso e Permissões (RBAC)
- **ADMINISTRADOR**: Acesso "Deus" restrito ao próprio `clinic_id`.
- **RECEPCIONISTA**: Interage com Agenda, Pacientes e Feedbacks. Blindada (UI e Backend) contra Telas Financeiras e Administrativas (Configurações, Usuários).
- **PROFISSIONAL**: UI e RLS limitados apenas aos seus respectivos pacientes e agenda diária. Não consegue ver faturamento e não cruza dados com outros colegas.

## 5. Fluxo de Autenticação e Roteamento
- A autenticação trafega pela instância global `AuthRepository.getSession()`.
- O script `guard.js` atua na carga de todas as páginas. Ele resgata o perfil (tabela `user_profiles`), averigua se a conta está `.ativa = true`, recupera a `role` e bloqueia o roteamento se a Role tentar acessar um arquivo HTML não listado no seu array de `allowedPages`. O RLS do banco garante que mesmo burlando a UI, nenhum dado é retornado.

## 6. Variáveis de Ambiente e Supabase Client
No arquivo `supabase-client.js`, utilizamos:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
**Auditoria confirmada**: Nenhuma Service Role Key, credenciais de SMTP, senhas hardcoded ou Webhook secrets foram injetadas no JS do frontend. O sistema está seguro para deploy público (CDN, Vercel, Netlify, S3).
