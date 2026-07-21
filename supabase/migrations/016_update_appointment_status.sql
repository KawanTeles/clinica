-- =================================================================================
-- Migration: 016_update_appointment_status.sql
-- Descrição: Evolução do pipeline de status da Agenda para suportar o fluxo clínico/financeiro.
-- =================================================================================

-- 1. Remover a restrição atual de status
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

-- 2. Atualizar o DEFAULT para um status válido
ALTER TABLE public.appointments ALTER COLUMN status SET DEFAULT 'agendada';

-- 3. Atualizar dados existentes ('solicitada' -> 'agendada', 'em_andamento' -> 'em_atendimento')
UPDATE public.appointments SET status = 'agendada' WHERE status = 'solicitada';
UPDATE public.appointments SET status = 'em_atendimento' WHERE status = 'em_andamento';
UPDATE public.appointments SET status = 'aguardando_pagamento' WHERE status = 'faturada';

-- 4. Recriar a restrição com o novo pipeline exigido pela Etapa 8
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

-- 4. Atualizar a constraint de conflitos (Double Booking EXCLUDE)
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS no_overlapping_appointments;
ALTER TABLE public.appointments
ADD CONSTRAINT no_overlapping_appointments
EXCLUDE USING gist (
    professional_id WITH =,
    tsrange(
        (data + hora_inicio)::timestamp, 
        (data + hora_fim)::timestamp
    ) WITH &&
)
WHERE (status IN ('agendada', 'aguardando_aprovacao', 'confirmada', 'aguardando_atendimento', 'em_atendimento'));
