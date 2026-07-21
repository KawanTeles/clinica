-- =================================================================================
-- Migration: 025_crm_appointment_automation.sql
-- Descrição: Insere templates base e regras de automação para Confirmação de Consulta
-- =================================================================================

-- 1. Inserir o Template Padrão
INSERT INTO public.crm_message_templates (clinic_id, name, trigger_event, channel, content, active)
SELECT 
    id AS clinic_id,
    'Confirmação de consulta',
    'APPOINTMENT_CREATED',
    'WHATSAPP',
    'Olá {{patient_name}}!\n\nSua consulta na Clínica Zoe está marcada para:\n\n📅 {{appointment_date}}\n⏰ {{appointment_time}}\n👩‍⚕️ Dr(a). {{professional_name}}\n\nPor favor confirme sua presença respondendo SIM.',
    true
FROM public.clinics
ON CONFLICT ON CONSTRAINT crm_message_templates_clinic_id_name_key DO NOTHING;

-- Nota: Caso a constraint crm_message_templates_clinic_id_name_key não exista,
-- é melhor fazer uma verificação de existência condicional. Como nas fases anteriores usamos DO NOTHING em nome/trigger,
-- vamos usar a lógica WHERE NOT EXISTS.

DELETE FROM public.crm_message_templates WHERE name = 'Confirmação de consulta' AND trigger_event = 'APPOINTMENT_CREATED';

INSERT INTO public.crm_message_templates (clinic_id, name, trigger_event, channel, content, active)
SELECT 
    id AS clinic_id,
    'Confirmação de consulta',
    'APPOINTMENT_CREATED',
    'WHATSAPP',
    'Olá {{patient_name}}!\n\nSua consulta na Clínica Zoe está marcada para:\n\n📅 {{appointment_date}}\n⏰ {{appointment_time}}\n👩‍⚕️ Dr(a). {{professional_name}}\n\nPor favor confirme sua presença respondendo SIM.',
    true
FROM public.clinics;

-- 2. Inserir a Regra Automática
DELETE FROM public.crm_automation_rules WHERE name = 'Confirmação automática de consulta' AND trigger_event = 'APPOINTMENT_CREATED';

INSERT INTO public.crm_automation_rules (clinic_id, name, description, trigger_event, action_type, action_config, active)
SELECT 
    id AS clinic_id,
    'Confirmação automática de consulta',
    'Envia WhatsApp pedindo confirmação logo após agendamento',
    'APPOINTMENT_CREATED',
    'SEND_MESSAGE',
    '{"channel": "WHATSAPP", "template": "Confirmação de consulta"}'::jsonb,
    true
FROM public.clinics;
