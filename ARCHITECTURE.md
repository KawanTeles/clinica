# Arquitetura do Sistema: Clínica SaaS Multi-Tenant

Este documento descreve as decisões arquiteturais, convenções e padrões adotados no projeto, servindo como guia definitivo para o time de engenharia.

## 1. Estrutura de Pastas
O projeto adota uma arquitetura limpa (Clean Architecture / Layered Pattern) para o frontend Vanilla JS, segregando responsabilidades.

```text
/
├── analytics/         # Views, Functions, Materialized e Jobs para Dashboards
├── css/               # Estilos globais e componentes reutilizáveis
├── js/
│   └── admin/         # Controllers baseados em ES Modules
├── pages/
│   └── admin/         # HTML dos módulos operacionais e de gestão (Exclusivo)
├── repositories/      # Camada de abstração de dados pura (Queries Supabase)
├── supabase/
│   ├── migrations/    # Versionamento imutável e incremental do banco
│   └── functions/     # Edge Functions (Deno)
├── types/             # Definições de estruturas (JSDoc/TS)
└── utils/             # Helpers puros (data, dinheiro, validação, formatação)
```

## 2. Escopo Oficial e Fronteira de Desenvolvimento (Regra Permanente)
**O objetivo desta primeira versão é EXCLUSIVAMENTE o CRM / Painel Administrativo da Clínica Zoe.**
- Não devem ser criadas interfaces, páginas, rotas ou fluxos para o Portal do Cliente nesta fase.
- É permitido apenas manter a arquitetura preparada (tabelas, autenticação, RLS, relacionamentos e abstrações) no Banco de Dados para futura expansão, mas NENHUM desenvolvimento de código frontend voltado ao cliente final é autorizado.
- Foco absoluto na homologação, performance e estabilidade do módulo `admin/`.

## 2. Convenções de Nomenclatura
- **Banco de Dados**: `snake_case` para tabelas, colunas, views e funções RPC.
- **HTML/CSS**: `kebab-case` para nomes de arquivos (`caixa-diario.html`) e classes CSS.
- **JavaScript**: `camelCase` para variáveis e funções.
- **Migrations**: Padrão numérico incremental com sufixo descritivo (`001_initial_auth_rbac.sql`). **Migrations já executadas são estritamente imutáveis.**

## 3. Fluxo de Autenticação e Multi-Tenancy
O sistema é um SaaS com isolamento físico de dados no nível do banco via RLS.
- O login ocorre via Supabase Auth (JWT).
- O `clinic_id` é injetado no payload do JWT via custom claims ou verificado dinamicamente no backend.
- A função RPC `current_clinic_id()` abstrai a leitura do JWT para as políticas.
- NENHUMA inserção ou leitura depende do frontend passar o `clinic_id`. O banco impõe o isolamento.

## 4. Fluxo de Permissões (RBAC)
Baseado em `roles`, `permissions` e `role_permissions`:
- **Admin**: Acesso global ao seu Tenant. Pode gerenciar acessos e fechar/reabrir caixas financeiras.
- **Recepcionista**: Acesso operacional. Lida com a Agenda, altera status da consulta para Pago e opera o PDV diário (Entrada/Saída), sem exclusões.
- **Profissional**: Isolamento estrito. Acessa apenas a própria agenda e seus próprios repasses (revenue share).

## 5. Fluxo da Agenda (Pipeline Clínico)
O ciclo de vida da consulta evita ambiguidade e integra o financeiro sem atritos:
1. `agendada` (Paciente agendado)
2. `aguardando_atendimento` (Paciente chegou na clínica)
3. `em_atendimento` (Em sala com o profissional)
4. `aguardando_pagamento` (Profissional encerrou, passou para recepção)
5. `pago` (Pagamento recebido na recepção via modal rápido)
6. `concluida` (Fim absoluto do fluxo)

## 6. Fluxo Financeiro (ERP/CRM)
Desacoplado das consultas para flexibilidade máxima (pacotes, retornos, estornos):
- **Documento Financeiro (`financial_documents`)**: Representa a "Conta" do paciente.
- **Pagamentos (`payments`)**: Lançamentos granulares (ex: split de Pix e Cartão no mesmo documento).
- As atualizações de `saldo_devedor` ocorrem via Triggers automatizadas (`update_document_balance()`).
- O Caixa Diário (`cash_registers`) é isolado e controla aberturas, fechamentos, sangrias e suprimentos da operação física.

## 7. Padrão de Repositories e Controllers
- **Repositories**: Nunca possuem regras de UI. Exclusivos para realizar `supabase.from().select()`, `insert()`, abstraindo a sintaxe do ORM de todas as outras camadas.
- **Controllers**: Consomem repositories e tomam decisões atualizando a UI (ex: `js/admin/pacientes.js`). Realizam validações DOM e controlam modais.
- É ESTRITAMENTE PROIBIDO executar comandos diretos da API do Supabase (`.from()`, `.rpc()`, `.functions.invoke()`) fora do diretório `repositories/`. Todas as páginas de `pages/` interagem indiretamente via controllers em `js/admin/`.

## 8. Como adicionar Novas Clínicas
1. Criação do Tenant na tabela `clinics`.
2. Criação do Usuário Mestre (Admin) em `user_profiles` apontando para o novo `clinic_id`.
3. Todo o sistema automaticamente isola o contexto para o novo ambiente graças ao `current_clinic_id()`.

## 9. Próximos Módulos e Expansões
Para injetar um novo módulo (ex: Prontuário Eletrônico):
- **BD**: Criar Migration Numérica subsequente e injetar auditoria `audit_logs`.
- **UI/Fluxo**: Estruturar pasta específica nos domínios do Admin ou do Portal do Cliente.
