import { SessionService } from './session.service.js';
import { UserService } from './user.service.js';

export class PermissionsService {
  /**
   * Valida UI: Apenas retorna booleano para mostrar/esconder elementos.
   * Não gera log de auditoria, para não flodar o banco no carregamento da tela.
   */
  static can(permissionSlug) {
    const session = SessionService.getSession();
    if (!session || !Array.isArray(session.permissoes)) return false;
    return session.permissoes.includes(permissionSlug);
  }

  /**
   * Valida Acesso Crítico de Módulo.
   * Gera auditoria obrigatória de acesso negado.
   */
  static async checkAccess(permissionSlug, moduleName) {
    if (!this.can(permissionSlug)) {
      const session = SessionService.getSession();
      const userId = session ? session.id : null;
      
      await UserService.logAudit('ACESSO_NEGADO', userId, {
        permissao_solicitada: permissionSlug,
        modulo: moduleName,
        resultado: 'negado'
      });
      
      console.warn(`[RBAC] Acesso negado. Módulo: ${moduleName}`);
      window.location.href = '/pages/crm/dashboard.html?erro=acesso_negado';
      return false;
    }
    return true;
  }

  static hasRole(roleName) {
    const session = SessionService.getSession();
    if (!session || !session.cargo) return false;
    return session.cargo.toLowerCase() === roleName.toLowerCase();
  }
}
