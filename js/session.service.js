export class SessionService {
  static setSession(user, clinic, role, permissions) {
    const sessionData = {
      id: user.id,
      nome: user.nome,
      clinica: clinic,
      cargo: role,
      permissoes: permissions,
      foto: user.foto,
      // Sessão expira em 8 horas localmente, forçando nova validação
      expiracao: new Date().getTime() + 1000 * 60 * 60 * 8 
    };
    // Armazenamento não sensível, apenas para controle de UI. 
    // O backend validará as requisições reais via JWT e RLS.
    localStorage.setItem('zoe_crm_session', JSON.stringify(sessionData));
  }

  static getSession() {
    const data = localStorage.getItem('zoe_crm_session');
    if (!data) return null;
    
    try {
      const session = JSON.parse(data);
      if (new Date().getTime() > session.expiracao) {
        this.clearSession();
        return null;
      }
      return session;
    } catch (e) {
      this.clearSession();
      return null;
    }
  }

  static clearSession() {
    localStorage.removeItem('zoe_crm_session');
  }
}
