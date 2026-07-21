-- =================================================================================
-- Migration: 013_financial_views.sql
-- Descrição: Preparação dos KPIs executivos para o Dashboard (Analytics).
-- =================================================================================

-- 1. Daily Cash (Caixa Diário de Entradas Reais)
CREATE OR REPLACE VIEW public.vw_daily_cash AS
SELECT 
    clinic_id,
    data_pagamento AS data,
    SUM(valor_pago) FILTER (WHERE status = 'CONCLUIDO') AS total_recebido,
    COUNT(id) FILTER (WHERE status = 'CONCLUIDO') AS transacoes_sucesso
FROM public.payments
GROUP BY clinic_id, data_pagamento;

-- 2. Monthly Revenue (Receita Mensal)
CREATE OR REPLACE VIEW public.vw_monthly_revenue AS
SELECT 
    clinic_id,
    date_trunc('month', data_emissao) AS mes,
    SUM(valor_total) AS total_faturado,
    SUM(valor_total - saldo_devedor) AS total_recebido,
    SUM(saldo_devedor) AS total_em_aberto
FROM public.financial_documents
WHERE tipo = 'RECEITA' AND status NOT IN ('CANCELADO', 'ESTORNADO')
GROUP BY clinic_id, date_trunc('month', data_emissao);

-- 3. Professional Revenue (Rateio de Produção por Profissional via Appointments)
CREATE OR REPLACE VIEW public.vw_professional_revenue AS
SELECT 
    d.clinic_id,
    a.professional_id,
    date_trunc('month', d.data_emissao) AS mes,
    SUM(d.valor_total) AS producao_bruta,
    SUM(d.valor_total - d.saldo_devedor) AS producao_recebida
FROM public.financial_documents d
JOIN public.appointments a ON a.id = d.appointment_id
WHERE d.tipo = 'RECEITA' AND d.status NOT IN ('CANCELADO', 'ESTORNADO')
GROUP BY d.clinic_id, a.professional_id, date_trunc('month', d.data_emissao);

-- 4. Accounts Receivable (Contas a Receber Agrupadas)
CREATE OR REPLACE VIEW public.vw_accounts_receivable AS
SELECT 
    clinic_id,
    status,
    COUNT(id) AS qtd_documentos,
    SUM(saldo_devedor) AS total_esperado
FROM public.financial_documents
WHERE tipo = 'RECEITA' AND saldo_devedor > 0 AND status NOT IN ('CANCELADO', 'ESTORNADO')
GROUP BY clinic_id, status;

-- 5. Accounts Payable (Contas a Pagar Agrupadas)
CREATE OR REPLACE VIEW public.vw_accounts_payable AS
SELECT 
    clinic_id,
    status,
    COUNT(id) AS qtd_documentos,
    SUM(saldo_devedor) AS total_devido
FROM public.financial_documents
WHERE tipo = 'DESPESA' AND saldo_devedor > 0 AND status NOT IN ('CANCELADO', 'ESTORNADO')
GROUP BY clinic_id, status;
