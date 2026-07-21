-- =================================================================================
-- Migration: 016_update_appointment_status.sql
-- Descrição: Evolução do pipeline de status da Agenda para suportar o fluxo clínico/financeiro.
-- =================================================================================

-- 1. Remover a restrição atual de status
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

-- 2. Recriar a restrição com o novo pipeline exigido pela Etapa 8
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check 
CHECK (status IN (
    'agendada', 
    'aguardando_aprovacao', 
    'confirmada', 
    'aguardando_atendimento', 
    'em_atendimento', 
    'aguardando_pagamento', 
    'pago', 
    'concluida', 
    'recusada', 
    'cancelada', 
    'remarcada', 
    'nao_compareceu'
));

-- (Se desejar migrar dados existentes 'solicitada' -> 'agendada', 'em_andamento' -> 'em_atendimento')
UPDATE public.appointments SET status = 'agendada' WHERE status = 'solicitada';
UPDATE public.appointments SET status = 'em_atendimento' WHERE status = 'em_andamento';
UPDATE public.appointments SET status = 'aguardando_pagamento' WHERE status = 'faturada';
