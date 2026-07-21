# Relatório de Auditoria de Segurança: RLS Supabase
**Clínica Zoe - SaaS Multi-Tenant**

## 1. Visão Geral
Foi disparado um alerta pelo Supabase informando que havia tabelas no schema public vulneráveis a acessos não autorizados por falta de Row Level Security (RLS) habilitado. Uma auditoria completa (Etapa 1) foi disparada varrendo todas as tabelas criadas nas _migrations_ 001 até 029.

## 2. Tabelas Vulneráveis Encontradas (Sem RLS)
Identificamos que a **Migration 005 (Module Patients Enterprise)** focou em criar a estrutura de tabelas relacionais de pacientes e procedimentos, mas esqueceu de habilitar o RLS para suas tabelas filhas. Além disso, a **Migration 015** não habilitou RLS na tabela de log financeiro.

### Lista de Tabelas Públicas (Expostas):
1. `audit_logs` (Logs do sistema genérico)
2. `health_insurances` (Convênios)
3. `patient_alerts` (Alertas médicos do paciente)
4. `patient_contacts` (Contatos de emergência do paciente)
5. `patient_documents` (Documentos/anexos do paciente)
6. `patient_health_insurances` (Vínculo paciente-convênio)
7. `procedures` (Procedimentos clínicos)
8. `professional_procedures` (Vínculo profissional-procedimento)
9. `specialties` (Especialidades médicas)
10. `financial_transactions` (Transações financeiras)
11. `financial_audit` (Logs de alterações financeiras - *Migration 015*)

## 3. Risco de Exposição
**CRÍTICO:** Com a tabela exposta (anon key via API), qualquer usuário mal-intencionado possuindo o URL do projeto e a chave anônima (que é pública no frontend) poderia:
- Fazer dump dos documentos, convênios e contatos de **todos os pacientes** (Quebra de LGPD).
- Visualizar transações financeiras e logs de auditoria de todas as clínicas sem filtro de Multi-Tenant.
- Adicionar ou deletar especialidades e procedimentos.

## 4. Estratégia de Correção (Migration 030)
1. Para as tabelas relacionadas a negócios (`health_insurances`, `procedures`, `specialties`, `patient_*`):
   - Habilitar RLS.
   - Restringir leitura e gravação garantindo `clinic_id = public.current_clinic_id()`.
   - Admin: Total. Recepcionista/Profissional: Restrito/Somente Leitura dependendo da tabela.

2. Para tabelas sensíveis de sistema (Logs/Auditoria) (`audit_logs`, `financial_audit`, `financial_transactions`):
   - Habilitar RLS.
   - Criar uma Policy cega: `USING (false)` para que nenhum cliente frontend consiga ler, inserir ou deletar diretamente via `supabase.from()`.
   - Inserções dessas tabelas são feitas estritamente via _Triggers_ ou _RPCs_ com `SECURITY DEFINER` (que ignoram o RLS por operarem como postgres role), garantindo inviolabilidade do rastro de auditoria.

*Nenhuma tabela de CRM estava desprotegida.* O módulo CRM já nasceu seguro.
