-- SQL Schema for Clinica Zoe Database
-- Recommended to run in the Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM for Booking Status
CREATE TYPE agendamento_status AS ENUM ('Agendado', 'Confirmado', 'Cancelado', 'Finalizado');

-- 1. Especialidades Table
CREATE TABLE IF NOT EXISTS public.especialidades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) UNIQUE NOT NULL,
    descricao TEXT NOT NULL,
    icone VARCHAR(50) NOT NULL, -- FontAwesome class name
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Profissionais Table
CREATE TABLE IF NOT EXISTS public.profissionais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(150) NOT NULL,
    foto TEXT, -- Base64 representation or URL
    especialidade_id UUID NOT NULL REFERENCES public.especialidades(id) ON DELETE RESTRICT,
    mini_curriculo TEXT NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    dias_atendimento VARCHAR(10)[] NOT NULL, -- e.g. {'seg', 'ter', 'qua', 'qui', 'sex'}
    horario_inicio TIME NOT NULL DEFAULT '08:00:00',
    horario_fim TIME NOT NULL DEFAULT '18:00:00',
    ativo BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Pacientes Table
CREATE TABLE IF NOT EXISTS public.pacientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(150) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    data_cadastro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Agendamentos Table
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE RESTRICT,
    data DATE NOT NULL,
    horario TIME NOT NULL,
    observacoes TEXT,
    status agendamento_status DEFAULT 'Agendado'::agendamento_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Prevent double bookings for same professional, date and time
    CONSTRAINT unique_profissional_data_horario UNIQUE (profissional_id, data, horario)
);

-- 5. Horários Bloqueados Table
CREATE TABLE IF NOT EXISTS public.horarios_bloqueados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    horario_inicio TIME NOT NULL,
    horario_fim TIME NOT NULL,
    motivo VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Férias Table
CREATE TABLE IF NOT EXISTS public.ferias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
    inicio DATE NOT NULL,
    fim DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_dates CHECK (inicio <= fim)
);

-- 7. Avaliações Table
CREATE TABLE IF NOT EXISTS public.avaliacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente VARCHAR(150) NOT NULL,
    nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
    comentario TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seeding Default Specialties
INSERT INTO public.especialidades (nome, descricao, icone) VALUES
('Psicologia', 'Apoio emocional e tratamento de distúrbios comportamentais e mentais.', 'fa-brain'),
('Nutrição', 'Planos alimentares personalizados para saúde, bem-estar e performance.', 'fa-apple-alt'),
('Fisioterapia', 'Reabilitação física, alívio de dores corporais e melhora de mobilidade.', 'fa-running'),
('Pediatria', 'Acompanhamento do desenvolvimento e saúde de crianças e adolescentes.', 'fa-child'),
('Clínica Geral', 'Consultas preventivas, diagnósticos gerais e encaminhamentos.', 'fa-stethoscope'),
('Dermatologia', 'Cuidados com a saúde e estética da pele, unhas e cabelos.', 'fa-spa'),
('Psiquiatria', 'Diagnóstico e tratamento médico de transtornos mentais complexos.', 'fa-user-md'),
('Odontologia', 'Saúde bucal completa, estética dentária e tratamentos preventivos.', 'fa-tooth'),
('Fonoaudiologia', 'Prevenção, avaliação e reabilitação da voz, fala e audição.', 'fa-volume-up'),
('Terapia Ocupacional', 'Auxílio na autonomia e inclusão em atividades do cotidiano.', 'fa-hand-holding-heart')
ON CONFLICT (nome) DO NOTHING;

-- Seeding Default Professionals (linking to the newly created specialties)
-- We will write a function to seed to avoid hardcoded IDs failing due to missing records.
DO $$
DECLARE
    psico_id UUID;
    nutri_id UUID;
    ped_id UUID;
    clin_id UUID;
BEGIN
    SELECT id INTO psico_id FROM public.especialidades WHERE nome = 'Psicologia';
    SELECT id INTO nutri_id FROM public.especialidades WHERE nome = 'Nutrição';
    SELECT id INTO ped_id FROM public.especialidades WHERE nome = 'Pediatria';
    SELECT id INTO clin_id FROM public.especialidades WHERE nome = 'Clínica Geral';

    IF psico_id IS NOT NULL THEN
        INSERT INTO public.profissionais (nome, foto, especialidade_id, mini_curriculo, whatsapp, email, dias_atendimento, horario_inicio, horario_fim)
        VALUES (
            'Dra. Helena Souza',
            'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400',
            psico_id,
            'Psicóloga clínica com mais de 8 anos de experiência, especialista em Terapia Cognitivo-Comportamental (TCC) e inteligência emocional.',
            '5511999999999',
            'helena.souza@clinicazoe.com',
            ARRAY['seg', 'ter', 'qua', 'qui', 'sex'],
            '08:00:00',
            '18:00:00'
        ) ON CONFLICT (email) DO NOTHING;
    END IF;

    IF nutri_id IS NOT NULL THEN
        INSERT INTO public.profissionais (nome, foto, especialidade_id, mini_curriculo, whatsapp, email, dias_atendimento, horario_inicio, horario_fim)
        VALUES (
            'Dr. Lucas Alencar',
            'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400',
            nutri_id,
            'Nutricionista esportivo e funcional focado em emagrecimento saudável, performance física e reeducação alimentar duradoura.',
            '5511988888888',
            'lucas.alencar@clinicazoe.com',
            ARRAY['seg', 'qua', 'sex'],
            '09:00:00',
            '17:00:00'
        ) ON CONFLICT (email) DO NOTHING;
    END IF;

    IF ped_id IS NOT NULL THEN
        INSERT INTO public.profissionais (nome, foto, especialidade_id, mini_curriculo, whatsapp, email, dias_atendimento, horario_inicio, horario_fim)
        VALUES (
            'Dra. Mariana Dias',
            'https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=400',
            ped_id,
            'Pediatra humanizada, pós-graduada em neonatologia, dedicada aos cuidados da primeira infância e suporte ao aleitamento materno.',
            '5511977777777',
            'mariana.dias@clinicazoe.com',
            ARRAY['ter', 'qui', 'sab'],
            '08:00:00',
            '12:00:00'
        ) ON CONFLICT (email) DO NOTHING;
    END IF;

    IF clin_id IS NOT NULL THEN
        INSERT INTO public.profissionais (nome, foto, especialidade_id, mini_curriculo, whatsapp, email, dias_atendimento, horario_inicio, horario_fim)
        VALUES (
            'Dr. Roberto Silva',
            'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400',
            clin_id,
            'Médico de família e clínico geral experiente. Dedicado a check-ups completos, diagnósticos iniciais e medicina preventiva.',
            '5511966666666',
            'roberto.silva@clinicazoe.com',
            ARRAY['seg', 'ter', 'qua', 'qui', 'sex'],
            '08:00:00',
            '18:00:00'
        ) ON CONFLICT (email) DO NOTHING;
    END IF;
END $$;

-- Seeding Default reviews
INSERT INTO public.avaliacoes (paciente, nota, comentario) VALUES
('Camila Guimarães', 5, 'Atendimento maravilhoso! A Dra. Helena é extremamente atenciosa e o ambiente da clínica transmite muita paz.'),
('Thiago Mendes', 5, 'O plano alimentar do Dr. Lucas realmente fez a diferença na minha rotina de treinos. Resultados rápidos e consistentes!'),
('Fernanda Costa', 4, 'Excelente atendimento e profissionais capacitados. O agendamento online é muito prático e rápido.'),
('Jonas Santos', 5, 'Dr. Roberto foi muito minucioso no meu check-up. Uma clínica de altíssimo padrão, recomendo fortemente!')
ON CONFLICT DO NOTHING;
