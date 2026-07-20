-- 17_views_dashboard.sql
-- Etapa 14: Views agregadas e Materialized Views para o Dashboard Executivo

-- 1. View de Consultas por Dia (Ocupação e Status)
CREATE OR REPLACE VIEW view_dash_consultas_status AS
SELECT 
    clinica_id,
    data_consulta,
    COUNT(*) as total_consultas,
    SUM(CASE WHEN status_id = (SELECT id FROM status_consulta WHERE nome = 'Confirmada') THEN 1 ELSE 0 END) as confirmadas,
    SUM(CASE WHEN status_id = (SELECT id FROM status_consulta WHERE nome = 'Cancelada') THEN 1 ELSE 0 END) as canceladas,
    SUM(CASE WHEN status_id = (SELECT id FROM status_consulta WHERE nome = 'Solicitada') THEN 1 ELSE 0 END) as pendentes
FROM consultas
WHERE deleted_at IS NULL
GROUP BY clinica_id, data_consulta;

-- 2. View Financeira Mensal (DRE Simplificado)
CREATE OR REPLACE VIEW view_dash_financeiro_mensal AS
SELECT 
    clinica_id,
    TO_CHAR(data_vencimento, 'YYYY-MM') as mes_ano,
    SUM(CASE WHEN tipo = 'RECEITA' AND status IN ('Pago', 'Parcialmente Pago') THEN valor_liquido ELSE 0 END) as recebido,
    SUM(CASE WHEN tipo = 'RECEITA' AND status = 'Em Aberto' THEN valor_liquido ELSE 0 END) as pendente,
    SUM(CASE WHEN tipo = 'RECEITA' AND status = 'Vencido' THEN valor_liquido ELSE 0 END) as vencido,
    SUM(CASE WHEN tipo = 'RECEITA' AND status IN ('Pago', 'Parcialmente Pago') THEN comissao_valor ELSE 0 END) as comissao_paga,
    SUM(CASE WHEN tipo = 'DESPESA' AND status = 'Pago' THEN valor_liquido ELSE 0 END) as despesas_pagas,
    -- Lucro Líquido Realizado (Recebido - Despesas Pagas - Comissões Pagas)
    (
        SUM(CASE WHEN tipo = 'RECEITA' AND status IN ('Pago', 'Parcialmente Pago') THEN repasse_liquido ELSE 0 END) -
        SUM(CASE WHEN tipo = 'DESPESA' AND status = 'Pago' THEN valor_liquido ELSE 0 END)
    ) as lucro_liquido_realizado
FROM financeiro
WHERE deleted_at IS NULL
GROUP BY clinica_id, TO_CHAR(data_vencimento, 'YYYY-MM');

-- 3. View de Desempenho de Leads
CREATE OR REPLACE VIEW view_dash_leads AS
SELECT 
    clinica_id,
    status,
    COUNT(*) as quantidade
FROM leads
WHERE deleted_at IS NULL
GROUP BY clinica_id, status;

-- 4. View de Notificações (Marketing)
CREATE OR REPLACE VIEW view_dash_notificacoes AS
SELECT 
    clinica_id,
    status,
    COUNT(*) as quantidade
FROM notificacoes_fila
WHERE DATE(criado_em) = CURRENT_DATE
GROUP BY clinica_id, status;

-- 5. View Desempenho Profissionais (Mês Atual)
CREATE OR REPLACE VIEW view_dash_profissionais_mes AS
SELECT 
    f.clinica_id,
    f.profissional_id,
    p.nome,
    SUM(CASE WHEN f.tipo = 'RECEITA' AND f.status IN ('Pago', 'Parcialmente Pago') THEN f.valor_liquido ELSE 0 END) as faturado,
    SUM(CASE WHEN f.tipo = 'RECEITA' AND f.status IN ('Pago', 'Parcialmente Pago') THEN f.comissao_valor ELSE 0 END) as comissao_gerada
FROM financeiro f
JOIN profissionais p ON p.id = f.profissional_id
WHERE f.deleted_at IS NULL 
  AND TO_CHAR(f.data_vencimento, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
GROUP BY f.clinica_id, f.profissional_id, p.nome;

-- Permissões para leitura das Views
GRANT SELECT ON view_dash_consultas_status TO authenticated;
GRANT SELECT ON view_dash_financeiro_mensal TO authenticated;
GRANT SELECT ON view_dash_leads TO authenticated;
GRANT SELECT ON view_dash_notificacoes TO authenticated;
GRANT SELECT ON view_dash_profissionais_mes TO authenticated;
