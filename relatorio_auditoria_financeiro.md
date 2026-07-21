# Relatório de Auditoria: Módulo Financeiro (Etapa 7)
**Painel Administrativo - Clínica Zoe**

## 1. Mapeamento da Estrutura de Banco de Dados
A auditoria revelou que as antigas tabelas únicas (como `financial_transactions`) foram descontinuadas nas *migrations* iniciais e o ecossistema evoluiu para um padrão Enterprise composto pelas seguintes tabelas geradas nas migrations 010 e 011:

- **`financial_documents`**: Representa a "Fatura" ou "Lançamento" principal. 
  - Colunas: `id`, `clinic_id`, `patient_id`, `appointment_id`, `tipo` (RECEITA/DESPESA), `status` (ABERTO, PARCIAL, PAGO, CANCELADO...), `valor_total`, `saldo_devedor`, `data_emissao`, `data_vencimento`.
- **`financial_document_items`**: Itens granulares de um documento (procedimentos/consultas faturadas).
- **`payments`**: Registros reais de pagamento. Permite *split* de pagamento (Ex: Cliente pagou parte em PIX e parte em Dinheiro para o mesmo documento).
- **`payment_methods`**: Formas de pagamento cadastradas por clínica.

## 2. Ligação com a Agenda e Profissionais
O Lançamento (`financial_documents`) liga-se nativamente ao paciente (`patient_id`) e à consulta (`appointment_id`). A partir da consulta, é possível descobrir qual profissional prestou o serviço.

## 3. Avaliação de RLS e Segurança
A migration `014_financial_rls.sql` blindou estritamente o ecossistema financeiro:
- **Administrador**: Detém RLS full access `FOR ALL` condicionado ao seu `clinic_id`.
- **Recepcionista**: Para tabelas de faturamento, possui acesso restrito `FOR SELECT` e `FOR INSERT` (como dar baixa no caixa), porém o `guard.js` na interface Web irá omitir completamente a tela do financeiro global, como solicitado.
- **Profissional**: RLS bloqueado. Nenhuma política de leitura para profissionais existe sobre `financial_documents` (SaaS restrito).

## 4. Status de Auditoria
**Pronto para prosseguir.** 
A base de dados possui as amarrações perfeitas para construir o Repository e renderizar o dashboard sem necessidade de modificação no Schema SQL. Todo o controle de PAGO/PENDENTE/CANCELADO pedido na interface mapeia perfeitamente para a máquina de estados existente (`ABERTO`, `PAGO`, `CANCELADO`).
