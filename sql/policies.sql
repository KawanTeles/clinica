-- Row Level Security (RLS) policies for Clinica Zoe
-- Recommended to run in the Supabase SQL Editor

-- 1. Enable RLS on all tables
ALTER TABLE public.especialidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_bloqueados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

-- Helper Function to determine if logged-in user is an Admin
-- Admins can be designated by having a meta-data role in auth.users or by email pattern
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  -- Check if user is authenticated and is an admin
  -- In Supabase auth.jwt() contains the user claims. 
  -- We check if raw_user_meta_data has role = 'admin' or email is clinic admin
  RETURN (
    auth.role() = 'authenticated' AND (
      coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
      OR auth.email() LIKE '%@clinicazoe.com' -- Simple fallback
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Helper Function to check if logged-in user is a specific Professional
CREATE OR REPLACE FUNCTION public.is_professional(professional_email TEXT)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN (
    auth.role() = 'authenticated' AND 
    auth.email() = professional_email
  );
END;
$$ LANGUAGE plpgsql;


-- =====================================================================
-- POLICIES FOR: especialidades
-- =====================================================================
CREATE POLICY "Especialidades are readable by everyone" ON public.especialidades
    FOR SELECT USING (true);

CREATE POLICY "Especialidades are writeable only by Admins" ON public.especialidades
    FOR ALL USING (public.is_admin());


-- =====================================================================
-- POLICIES FOR: profissionais
-- =====================================================================
CREATE POLICY "Profissionais are readable by everyone" ON public.profissionais
    FOR SELECT USING (ativo = true OR public.is_admin());

CREATE POLICY "Profissionais are writeable only by Admins" ON public.profissionais
    FOR ALL USING (public.is_admin());


-- =====================================================================
-- POLICIES FOR: pacientes
-- =====================================================================
CREATE POLICY "Pacientes read own data or Admin reads all" ON public.pacientes
    FOR SELECT USING (
        (auth.role() = 'authenticated' AND auth.email() = email)
        OR public.is_admin()
    );

CREATE POLICY "Pacientes insert own data (public/anonymous)" ON public.pacientes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Pacientes update own data or Admin updates all" ON public.pacientes
    FOR UPDATE USING (
        (auth.role() = 'authenticated' AND auth.email() = email)
        OR public.is_admin()
    );

CREATE POLICY "Pacientes delete only by Admins" ON public.pacientes
    FOR DELETE USING (public.is_admin());


-- =====================================================================
-- POLICIES FOR: agendamentos
-- =====================================================================
-- Anyone can select to check availability (or we check based on professional ID and date)
CREATE POLICY "Agendamentos readable by public (for slots checking), professional, or Admin" ON public.agendamentos
    FOR SELECT USING (
        true -- Allow public read of date/time/professional_id for checking free slots
    );

-- Anyone can book an appointment
CREATE POLICY "Agendamentos can be inserted by public" ON public.agendamentos
    FOR INSERT WITH CHECK (true);

-- Professional can update status, Admin has full rights
CREATE POLICY "Agendamentos can be updated by Admin or associated Professional" ON public.agendamentos
    FOR UPDATE USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.profissionais p 
            WHERE p.id = profissional_id AND public.is_professional(p.email)
        )
    );

CREATE POLICY "Agendamentos can be deleted by Admin" ON public.agendamentos
    FOR DELETE USING (public.is_admin());


-- =====================================================================
-- POLICIES FOR: horarios_bloqueados
-- =====================================================================
CREATE POLICY "Horários bloqueados are readable by everyone (for slots checking)" ON public.horarios_bloqueados
    FOR SELECT USING (true);

CREATE POLICY "Horários bloqueados writeable by Admin or associated Professional" ON public.horarios_bloqueados
    FOR ALL USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.profissionais p 
            WHERE p.id = profissional_id AND public.is_professional(p.email)
        )
    );


-- =====================================================================
-- POLICIES FOR: ferias
-- =====================================================================
CREATE POLICY "Ferias are readable by everyone" ON public.ferias
    FOR SELECT USING (true);

CREATE POLICY "Ferias writeable by Admin or associated Professional" ON public.ferias
    FOR ALL USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.profissionais p 
            WHERE p.id = profissional_id AND public.is_professional(p.email)
        )
    );


-- =====================================================================
-- POLICIES FOR: avaliacoes
-- =====================================================================
CREATE POLICY "Avaliacoes are readable by everyone" ON public.avaliacoes
    FOR SELECT USING (true);

CREATE POLICY "Avaliacoes can be inserted by anyone" ON public.avaliacoes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Avaliacoes can be deleted/updated by Admins" ON public.avaliacoes
    FOR ALL USING (public.is_admin());
