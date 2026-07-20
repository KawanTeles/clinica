import { supabase } from './supabase.js';
import { SessionService } from './session.service.js';
import { UserService } from './user.service.js';

export class AuthService {
  static async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      console.error("ERRO DO SUPABASE AUTH:", error);
      await UserService.logAudit('TENTATIVA_INVALIDA');
      throw new Error('Credenciais inválidas ou conta bloqueada.');
    }
    
    try {
      // O sistema nunca deverá confiar apenas no JWT. 
      // Busca dados na tabela de usuários para validar status, clínica e cargo.
      const profile = await UserService.getFullUserProfile(data.user.id);
      
      // Salva a sessão na memória (LocalStorage sem tokens sensíveis)
      SessionService.setSession(profile.usuario, profile.clinica, profile.cargo, profile.permissoes);
      
      await UserService.logAudit('LOGIN_REALIZADO', profile.usuario.id);
      return { success: true, profile };
      
    } catch (profileError) {
      // Se não encontrar na tabela pública, desloga imediatamente por segurança
      await supabase.auth.signOut();
      throw new Error('Usuário autenticado, mas sem perfil ativo na Clínica.');
    }
  }

  static async logout() {
    const session = SessionService.getSession();
    if (session) {
      await UserService.logAudit('LOGOUT', session.id);
    }
    await supabase.auth.signOut();
    SessionService.clearSession();
    window.location.href = '/pages/crm/login.html';
  }

  static async recoverPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/pages/crm/reset-password.html'
    });
    
    if (error) throw error;
    await UserService.logAudit('REDEFINICAO_SOLICITADA');
  }
}
