import { supabase } from './supabase.js';
import { AuthService } from './auth.service.js';

export class Middleware {
  /**
   * Inicia ouvintes globais de estado de autenticação para proteger o frontend.
   */
  static initialize() {
    supabase.auth.onAuthStateChange((event, session) => {
      // Proteção contra sessão revogada no backend
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        AuthService.logout();
      }
      
      // Renovação automática
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token Supabase renovado via middleware.');
      }
    });
  }
}
