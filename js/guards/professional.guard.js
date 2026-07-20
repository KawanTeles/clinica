import { PermissionsService } from '../permissions.service.js';

export function professionalGuard() {
  if (!PermissionsService.hasRole('Profissional') && !PermissionsService.hasRole('Owner')) {
    window.location.href = '/pages/crm/dashboard.html?erro=acesso_negado';
    return false;
  }
  return true;
}
