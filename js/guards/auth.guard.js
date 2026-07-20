import { SessionService } from '../session.service.js';
import { supabase } from '../supabase.js';

export async function authGuard() {
  const session = SessionService.getSession();
  
  // 1. Verifica sessão de UI
  if (!session) {
    window.location.href = '/pages/crm/login.html';
    return false;
  }

  // 2. Validação absoluta: verifica token JWT no Supabase
  const { data: { session: supaSession } } = await supabase.auth.getSession();
  if (!supaSession) {
    SessionService.clearSession();
    window.location.href = '/pages/crm/login.html';
    return false;
  }

  return true;
}
