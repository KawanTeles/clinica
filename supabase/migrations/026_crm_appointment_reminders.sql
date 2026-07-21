-- =================================================================================
-- Migration: 026_crm_appointment_reminders.sql
-- Descrição: Insere templates base e regras de automação para Lembrete 24h
-- =================================================================================

-- 1. Inserir o Template Padrão
DELETE FROM public.crm_message_templates WHERE name = 'Lembrete de consulta 24h' AND trigger_event = 'APPOINTMENT_REMINDER_24H';

INSERT INTO public.crm_message_templates (clinic_id, name, trigger_event, channel, content, active)
SELECT 
    id AS clinic_id,
    'Lembrete de consulta 24h',
    'APPOINTMENT_REMINDER_24H',
    'WHATSAPP',
    'Olá {{patient_name}}!\n\nPassando para lembrar que sua consulta na Clínica Zoe está marcada para amanhã:\n\n📅 {{appointment_date}}\n⏰ {{appointment_time}}\n👩‍⚕️ Profissional: {{professional_name}}\n\nPor favor, responda SIM para confirmar, ou CANCELAR caso não possa comparecer.',
    true
FROM public.clinics;

-- 2. Inserir a Regra Automática
DELETE FROM public.crm_automation_rules WHERE name = 'Lembrete automático 24h' AND trigger_event = 'APPOINTMENT_REMINDER_24H';

INSERT INTO public.crm_automation_rules (clinic_id, name, description, trigger_event, action_type, action_config, active)
SELECT 
    id AS clinic_id,
    'Lembrete automático 24h',
    'Envia lembrete 24 horas antes da consulta',
    'APPOINTMENT_REMINDER_24H',
    'SEND_MESSAGE',
    '{"channel": "WHATSAPP", "template": "Lembrete de consulta 24h"}'::jsonb,
    true
FROM public.clinics;

-- 3. Idempotência / Unique constraint para não enviar duplicado
-- Cria uma constraint única garantindo que o mesmo evento não ocorra para o mesmo appointment
-- O payload precisa ter o appointment_id na raiz JSON ou faremos isso via app code?
-- Por via das dúvidas, criamos um índice condicional.
-- Como event_type não tem payload.appointment_id acessível por SQL fácil sem funções imutáveis, 
-- gerenciaremos no backend.
