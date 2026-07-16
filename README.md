# Clínica Zoe — Painel Administrativo & CRM Clínico

Sistema de gestão clínica evoluído a partir do painel administrativo da **Clínica Zoe**,
com módulos de CRM, prontuário, agenda inteligente, financeiro, relatórios, mensagens,
configurações, auditoria e backup.

> Este repositório contém o **frontend** (HTML/CSS/JS puro) e os **scripts SQL** de
> banco de dados/RLS para o Supabase. O banco, autenticação e backend são executados
> no Supabase; o deploy estático é feito no Netlify.

## Objetivo

Oferecer aos administradores e profissionais da clínica uma ferramenta unificada para
gestão de pacientes, agendamentos, financeiro e comunicação — sem recriar o painel
existente, reaproveitando toda a estrutura e identidade visual.

## Tecnologias

- **Frontend**: HTML5, CSS3, JavaScript puro (vanilla, sem build)
- **Backend / DB / Auth**: Supabase (PostgreSQL + Row Level Security + Auth)
- **Hospedagem**: Netlify (site estático)
- **Modo DEMO**: mock de banco em `localStorage` (sem Supabase) para testes locais

## Estrutura de Pastas

```
.
├── index.html              # Landing page / site institucional
├── pages/                  # Páginas administrativas (dashboard, pacientes, crm, ...)
├── js/                     # Lógica do frontend (supabase.js, auth.js, permissions.js, módulos)
├── css/                    # style.css (design system)
├── sql/                    # Migrations e documentação do banco
│   ├── database.sql        # Schema base
│   ├── policies.sql        # RLS base + helper functions
│   ├── fix_profissionais_columns.sql
│   ├── crm_schema.sql      # Tabelas CRM/gestão
│   ├── phase1_migration.sql# Campos complementares da Fase 1
│   ├── README.md           # Ordem de execução das migrations
│   └── PERFORMANCE.md      # Análise de índices recomendados
├── netlify.toml            # Config de deploy (headers, cache, redirects)
├── _redirects              # Fallback 404
└── .gitignore
```

## Modo DEMO_MODE

O sistema roda em **MODO DEMO** por padrão (`DEMO_MODE: true` em `js/config.js`),
utilizando um banco simulado no `localStorage`. Assim é possível testar todo o sistema
localmente sem configurar o Supabase.

- Nenhuma chave privada é necessária em DEMO.
- O cliente real do Supabase só é usado quando `DEMO_MODE === false`.

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. Aplique as migrations na ordem documentada em [`sql/README.md`](sql/README.md):
   `database.sql` → `policies.sql` → `fix_profissionais_columns.sql` → `crm_schema.sql` → `phase1_migration.sql`.
3. As credenciais **não são hardcoded** em `js/config.js`. Em produção, forneça a
   URL e a chave **anon** pública via variável global injetada no deploy. No Netlify,
   use **Site settings → Snippet Injection** (ou equivalente) no `<head>`:
   ```html
   <script>
     window.ZOE_SUPABASE = {
       url: "https://SEU-PROJETO.supabase.co",
       key: "SUA-CHAVE-ANON-PUBLICA"
     };
   </script>
   ```
   (Também é possível servir um `config.prod.js` antes do `config.js` que define
   `window.ZOE_SUPABASE`.) Quando ausentes, o sistema roda em **MODO DEMO** automaticamente.
4. Vincule `profissionais.auth_user_id` aos `auth.users` (ver `sql/policies.sql`).

> ⚠️ **Nunca** coloque a `service_role` key no frontend. Apenas a chave anon é usada no cliente.
> ⚠️ Mantenha `DEMO_MODE: true` em `config.js` — ele é desativado automaticamente quando
> as credenciais de produção estão presentes.

## Como executar localmente

**Opção A — Servidor estático simples (incluso):**
```bash
node server.js
# abre em http://localhost:3000
```

**Opção B — Qualquer servidor estático:**
Basta servir a pasta raiz (ex.: `npx serve .` ou extensão "Live Server" do VS Code).
Abra `index.html` e navegue para `pages/login.html`
(admin demo: `admin@clinicazoe.com` / `admin123`; profissional: e-mail institucional / `123456`).

## Deploy (Netlify)

O arquivo `netlify.toml` já define o diretório de publicação (raiz), headers de
segurança e cache de assets estáticos. Basta conectar o repositório ao Netlify.

## Licença

Uso interno Clínica Zoe.
