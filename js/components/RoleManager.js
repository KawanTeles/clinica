import { PermissionsService } from '../permissions.service.js';

export class RoleManager {
  /**
   * Aplica a restrição visual varrendo o DOM por atributos data-permission.
   * Esta classe atua como Controlador Visual, não toma decisões de segurança.
   */
  static applyPermissions(containerElement = document) {
    // 1. Processar elementos genéricos (botões, cards, divs)
    const elements = containerElement.querySelectorAll('[data-permission]');
    
    elements.forEach(el => {
      const requiredPermission = el.getAttribute('data-permission');
      
      if (!PermissionsService.can(requiredPermission)) {
        const action = el.getAttribute('data-permission-action') || 'hide';
        
        if (action === 'hide') {
          el.style.display = 'none';
        } else if (action === 'disable') {
          el.setAttribute('disabled', 'true');
          el.style.opacity = '0.4';
          el.style.pointerEvents = 'none';
          el.title = 'Você não tem permissão para esta ação';
        }
      }
    });

    // 2. Processar menus estruturais (li > a)
    const secureLinks = containerElement.querySelectorAll('a[data-module-permission]');
    secureLinks.forEach(link => {
      const requiredPermission = link.getAttribute('data-module-permission');
      if (!PermissionsService.can(requiredPermission)) {
        // Oculta a li wrapper inteira
        if (link.parentElement && link.parentElement.tagName === 'LI') {
          link.parentElement.style.display = 'none';
        } else {
          link.style.display = 'none';
        }
      }
    });
  }
}
