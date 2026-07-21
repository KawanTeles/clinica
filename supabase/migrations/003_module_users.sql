-- =================================================================================
-- Migration: 003_module_users.sql
-- Descrição: Rastros avançados, contagem de acessos, permissões e proteção.
-- =================================================================================

-- 1. Melhoria da tabela de auditoria
ALTER TABLE public.security_logs 
ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Controle Analítico de Acesso
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- 3. Função automatizada: Contagem de Logins
CREATE OR REPLACE FUNCTION public.update_last_login_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.acao = 'LOGIN' THEN
    UPDATE public.user_profiles 
    SET last_login_at = NEW.created_at,
        login_count = COALESCE(login_count, 0) + 1
    WHERE auth_user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_login ON public.security_logs;
CREATE TRIGGER on_user_login
AFTER INSERT ON public.security_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_last_login_profile();

-- =================================================================================
-- 4. Permissões
-- =================================================================================
INSERT INTO public.permissions (nome, descricao) 
VALUES ('gerenciar_administradores', 'Autoriza a criação ou promoção de usuários para o cargo de ADMIN.')
ON CONFLICT (nome) DO NOTHING;

-- 5. Vincular a permissão ao ADMIN
DO $$
DECLARE
  admin_role_id UUID;
  gerenciar_admin_perm_id UUID;
BEGIN
  SELECT id INTO admin_role_id FROM public.roles WHERE nome = 'ADMIN';
  SELECT id INTO gerenciar_admin_perm_id FROM public.permissions WHERE nome = 'gerenciar_administradores';
  
  IF admin_role_id IS NOT NULL AND gerenciar_admin_perm_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id) 
    VALUES (admin_role_id, gerenciar_admin_perm_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
