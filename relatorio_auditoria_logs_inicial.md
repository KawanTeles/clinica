# Relatório de Auditoria: Sistema de Logs (Etapa 13)
**Painel Administrativo - Clínica Zoe**

## 1. Avaliação de Tabelas Existentes
O banco de dados já possui tabelas de auditoria nativas provenientes de migrations anteriores:
- `security_logs` (Migration 001): Voltada primariamente para login e eventos de autenticação.
- **`audit_logs`** (Migration 005): Criada especificamente como um motor universal de tracking de CRUD via *Triggers*. Ela monitora `patients`, `appointments`, `finance`, gravando `old_data` e `new_data`.

**Decisão Arquitetural:**
Seguindo a regra rigorosa de **"Caso exista: reutilizar. Não criar tabela duplicada"**, vamos utilizar a tabela **`audit_logs`**. 
Contudo, constatamos que ela carece nativamente das colunas `clinic_id` (para isolamento RLS Multi-Tenant seguro) e `description` (para o sumário legível humano). Portanto, uma nova migration (`032_admin_audit_logs.sql`) será criada para aplicar um `ALTER TABLE` nela, mantendo todo o legado intacto e provendo suporte à nova UI.

## 2. Permissões e Roles (RBAC e RLS)
- Atualmente, as triggers rodam como *SECURITY DEFINER*, ignorando o RLS para inserir os logs com sucesso (o que é o correto).
- Habilitaremos RLS rigoroso para a instrução de `SELECT` na tabela `audit_logs`, permitindo a leitura apenas se: `clinic_id = current_clinic_id()` **E** se o usuário possuir a Role `ADMIN` (`is_admin()`).
- O `guard.js` no frontend vetará o acesso a `auditoria.html` para `RECEPCIONISTA` e `PROFISSIONAL`.

## 3. Repositories
- Será criado o `repositories/audit.repository.js` exportando o método `AuditRepository.getLogs()` e `AuditRepository.logAction()`.
- Modificaremos as rotinas estratégicas nos outros repositories (ex: `professionals.repository.js`, `settings.repository.js`) para engatilhar um registro customizado sempre que um cadastro importante for efetivado. 

Podemos seguir com a implementação mantendo o padrão *Vanilla JS*.
