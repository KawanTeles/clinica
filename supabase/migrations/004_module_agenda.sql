-- =================================================================================
-- Migration: 004_module_agenda.sql
-- Descrição: Núcleo de Agendamento, Configurações, Double Booking e Notificações
-- =================================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Função de Apoio
CREATE OR REPLACE FUNCTION public.get_current_professional_id()
RETURNS UUID AS $$
  SELECT id FROM public.professionals 
  WHERE user_profile_id = (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1);
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Configurações de Disponibilidade Avançadas
CREATE TABLE public.professional_availability_settings (
    professional_id UUID PRIMARY KEY REFERENCES public.professionals(id) ON DELETE CASCADE,
    permite_agendamento_online BOOLEAN DEFAULT TRUE,
    antecedencia_minima_agendamento INTEGER DEFAULT 24, -- horas
    limite_maximo_agendamento INTEGER DEFAULT 30, -- dias
    tempo_intervalo_consulta INTEGER DEFAULT 0, -- minutos entre uma e outra
    aceita_remarcacao BOOLEAN DEFAULT TRUE,
    aceita_cancelamento BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Horário Fixo Semanal
CREATE TABLE public.professional_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE NOT NULL,
    dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    intervalo_inicio TIME,
    intervalo_fim TIME,
    duracao_consulta INTEGER DEFAULT 60 NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    UNIQUE(professional_id, dia_semana)
);

-- 4. Bloqueios (Férias, Folgas)
CREATE TABLE public.schedule_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('FERIAS', 'FOLGA', 'BLOQUEIO')),
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    motivo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Consultas (Appointments)
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professional_id UUID REFERENCES public.professionals(id) ON DELETE RESTRICT NOT NULL,
    patient_id UUID, -- Referência futura na próxima migration
    data DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'solicitada' 
        CHECK (status IN (
            'solicitada', 'aguardando_aprovacao', 'confirmada', 
            'em_andamento', 'concluida', 'faturada', 'paga', 
            'recusada', 'cancelada', 'remarcada', 'nao_compareceu'
        )),
    observacao_interna TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Estrutura Matemática Contra Conflitos (Double Booking EXCLUDE)
ALTER TABLE public.appointments
ADD CONSTRAINT no_overlapping_appointments
EXCLUDE USING gist (
    professional_id WITH =,
    tsrange(
        (data + hora_inicio)::timestamp, 
        (data + hora_fim)::timestamp
    ) WITH &&
)
WHERE (status IN ('solicitada', 'aguardando_aprovacao', 'confirmada', 'em_andamento'));

-- 7. Histórico de Auditoria da Consulta
CREATE TABLE public.appointment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE NOT NULL,
    status_anterior VARCHAR(50),
    status_novo VARCHAR(50) NOT NULL,
    alterado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. Tabela de Notificações (Preparação WhatsApp)
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id), -- Opcional, caso o cliente não tenha login
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
        'NOVA_SOLICITACAO', 'CONSULTA_APROVADA', 'CONSULTA_RECUSADA', 
        'CONSULTA_CANCELADA', 'CONSULTA_REMARCADA', 'LEMBRETE_CONSULTA'
    )),
    canal VARCHAR(20) DEFAULT 'WHATSAPP',
    mensagem TEXT NOT NULL,
    status_envio VARCHAR(20) DEFAULT 'PENDENTE',
    enviado_em TIMESTAMP WITH TIME ZONE,
    erro TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =================================================================================
-- TRIGGERS E FUNÇÕES OBRIGATÓRIAS
-- =================================================================================

-- 9. Trigger: Gerar histórico automático ao alterar status via banco
CREATE OR REPLACE FUNCTION public.trigger_appointment_status_history()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.appointment_history (appointment_id, status_anterior, status_novo, alterado_por)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_appointment_status_change
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_appointment_status_history();

-- 10. RPC: Função segura e única para atualizar status com observação (usada pelo Frontend)
CREATE OR REPLACE FUNCTION public.update_appointment_status(
    p_appointment_id UUID, 
    p_new_status VARCHAR, 
    p_observacao TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_old_status VARCHAR;
    v_prof_id UUID;
BEGIN
    SELECT status, professional_id INTO v_old_status, v_prof_id 
    FROM public.appointments WHERE id = p_appointment_id;

    -- Validação de Permissão (Básica: Admin pode tudo, Recepcionista pode, Profissional apenas os seus)
    IF NOT (
        public.is_admin() OR 
        public.has_role('RECEPCIONISTA') OR 
        (public.has_role('PROFISSIONAL') AND v_prof_id = public.get_current_professional_id())
    ) THEN
        RAISE EXCEPTION 'Acesso negado para alterar este agendamento.';
    END IF;

    -- Atualiza (Isso dispara a trigger que insere na history)
    UPDATE public.appointments 
    SET status = p_new_status, updated_at = now() 
    WHERE id = p_appointment_id;

    -- Como a trigger insere o histórico sem a observação do frontend, vamos 
    -- dar um UPDATE no registro recém-criado na trigger inserindo a observação,
    -- garantindo 100% de rastreabilidade num único evento.
    IF p_observacao IS NOT NULL THEN
        UPDATE public.appointment_history 
        SET observacao = p_observacao 
        WHERE appointment_id = p_appointment_id 
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- Criar notificação para o pipeline do WhatsApp
    IF p_new_status = 'confirmada' THEN
        INSERT INTO public.notifications (appointment_id, tipo, mensagem)
        VALUES (p_appointment_id, 'CONSULTA_APROVADA', 'Sua consulta foi confirmada.');
    ELSIF p_new_status = 'cancelada' THEN
        INSERT INTO public.notifications (appointment_id, tipo, mensagem)
        VALUES (p_appointment_id, 'CONSULTA_CANCELADA', 'Sua consulta foi cancelada.');
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =================================================================================
-- ÍNDICES E RLS
-- =================================================================================
CREATE INDEX idx_appointments_prof_data ON public.appointments(professional_id, data);
CREATE INDEX idx_blocks_prof_data ON public.schedule_blocks(professional_id, data_inicio);
CREATE INDEX idx_hist_appointment ON public.appointment_history(appointment_id);

ALTER TABLE public.professional_availability_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas ADMIN
CREATE POLICY "Admin All Settings" ON public.professional_availability_settings FOR ALL USING (public.is_admin());
CREATE POLICY "Admin All Schedule" ON public.professional_schedule FOR ALL USING (public.is_admin());
CREATE POLICY "Admin All Blocks" ON public.schedule_blocks FOR ALL USING (public.is_admin());
CREATE POLICY "Admin All Appointments" ON public.appointments FOR ALL USING (public.is_admin());
CREATE POLICY "Admin All History" ON public.appointment_history FOR ALL USING (public.is_admin());
CREATE POLICY "Admin All Notifications" ON public.notifications FOR ALL USING (public.is_admin());

-- Políticas RECEPCIONISTA (Leitura em blocos/horários, ALL em consultas)
CREATE POLICY "Recep Le Settings" ON public.professional_availability_settings FOR SELECT USING (public.has_role('RECEPCIONISTA'));
CREATE POLICY "Recep Le Schedule" ON public.professional_schedule FOR SELECT USING (public.has_role('RECEPCIONISTA'));
CREATE POLICY "Recep Le Blocks" ON public.schedule_blocks FOR SELECT USING (public.has_role('RECEPCIONISTA'));
CREATE POLICY "Recep All Appointments" ON public.appointments FOR ALL USING (public.has_role('RECEPCIONISTA'));
CREATE POLICY "Recep All History" ON public.appointment_history FOR ALL USING (public.has_role('RECEPCIONISTA'));

-- Políticas PROFISSIONAL (Apenas sua própria agenda)
CREATE POLICY "Prof Prof Settings" ON public.professional_availability_settings FOR ALL USING (professional_id = public.get_current_professional_id());
CREATE POLICY "Prof Prof Schedule" ON public.professional_schedule FOR ALL USING (professional_id = public.get_current_professional_id());
CREATE POLICY "Prof Prof Blocks" ON public.schedule_blocks FOR ALL USING (professional_id = public.get_current_professional_id());
CREATE POLICY "Prof Prof Appointments" ON public.appointments FOR ALL USING (professional_id = public.get_current_professional_id());
CREATE POLICY "Prof Prof History" ON public.appointment_history FOR SELECT USING (
    appointment_id IN (SELECT id FROM public.appointments WHERE professional_id = public.get_current_professional_id())
);
